import { randomUUID } from "node:crypto";
import { MongoClient, MongoServerError, ObjectId, type Db } from "mongodb";
import type { Fact, FinishedChallenge, LeaderRow, SessionUser, Standing, Store, StoredUser } from "./types";

/*
 * Lưu trữ bằng MongoDB (ví dụ MongoDB Atlas qua Vercel Marketplace).
 *
 * Collection                    Ghi chú
 *   users       { _id, username, usernameKey (unique), passwordHash, createdAt }
 *   sessions    { _id: mã băm token, userId, username, expiresAt }      TTL: tự xoá khi hết hạn
 *   rateLimits  { _id: key, windowStart, count, expiresAt }             TTL: tự xoá khi hết cửa sổ
 *   challenges  { _id: uuid, userId, questions, startedAt, finishedAt, durationMs, mistakes }
 *               TTL theo startedAt: tự xoá sau 30 ngày; đề (questions) xoá ngay khi nộp bài
 *   bests       { _id: userId, username, durationMs, achievedAt }       mỗi người một bản ghi
 *
 * Tên người dùng được chép sẵn vào sessions và bests (tên không bao giờ đổi), nên kiểm tra
 * đăng nhập và đọc bảng xếp hạng chỉ cần MỘT truy vấn, không phải ghép bảng.
 */

type UserDoc = { _id: ObjectId; username: string; usernameKey: string; passwordHash: string; createdAt: Date };
type SessionDoc = { _id: string; userId: string; username: string; expiresAt: Date };
type RateDoc = { _id: string; windowStart: Date; count: number; expiresAt: Date };
type ChallengeDoc = {
  _id: string;
  userId: string;
  questions?: { a: number; n: number }[]; // mỗi câu một đối tượng (dạng chuẩn của MongoDB)
  startedAt?: Date;
  finishedAt: Date | null;
  durationMs?: number;
  mistakes?: number;
};
type BestDoc = { _id: string; username: string; durationMs: number; achievedAt: Date };

type G = typeof globalThis & { __bnMongo?: Promise<MongoClient>; __bnMongoIdx?: Promise<void>; __bnMongoNoTtl?: boolean };
const g = globalThis as G;

const OPEN_WINDOW_MS = 10 * 60 * 1000; // lượt challenge phải nộp trong 10 phút
const HISTORY_DAYS = 30; // giữ lịch sử chơi 30 ngày

export function createMongoStore(uri: string): Store {
  // Một kết nối dùng chung cho mọi yêu cầu trong cùng máy chủ (tối đa 10 kết nối)
  g.__bnMongo ??= MongoClient.connect(uri, {
    maxPoolSize: 10,
    minPoolSize: 0,
    maxIdleTimeMS: 10_000,
    serverSelectionTimeoutMS: 5_000,
    appName: "rolexnomistake",
  });
  g.__bnMongo.catch(() => {
    g.__bnMongo = undefined;
  });

  async function db(): Promise<Db> {
    const client = await g.__bnMongo!;
    const d = client.db(process.env.MONGODB_DB || "rolexnomistake");
    if (!g.__bnMongoIdx) {
      // Tạo index một lần cho mỗi máy chủ; lệnh này an toàn khi chạy lặp lại
      const ttl = async (name: string, field: string, seconds: number) => {
        try {
          await d.collection(name).createIndex({ [field]: 1 }, { expireAfterSeconds: seconds });
        } catch {
          // Dịch vụ tương thích Mongo không có TTL: dùng index thường, housekeeping() sẽ tự xoá
          g.__bnMongoNoTtl = true;
          await d.collection(name).createIndex({ [field]: 1 });
        }
      };
      g.__bnMongoIdx = Promise.all([
        d.collection("users").createIndex({ usernameKey: 1 }, { unique: true }),
        ttl("sessions", "expiresAt", 0),
        ttl("rateLimits", "expiresAt", 0),
        d.collection("challenges").createIndex({ userId: 1, finishedAt: 1 }),
        ttl("challenges", "startedAt", HISTORY_DAYS * 86400),
        d.collection("bests").createIndex({ durationMs: 1, achievedAt: 1 }),
      ]).then(() => undefined);
      g.__bnMongoIdx.catch(() => {
        g.__bnMongoIdx = undefined;
      });
    }
    await g.__bnMongoIdx;
    return d;
  }
  const users = async () => (await db()).collection<UserDoc>("users");
  const sessions = async () => (await db()).collection<SessionDoc>("sessions");
  const rates = async () => (await db()).collection<RateDoc>("rateLimits");
  const challenges = async () => (await db()).collection<ChallengeDoc>("challenges");
  const bests = async () => (await db()).collection<BestDoc>("bests");
  const isDup = (e: unknown) => e instanceof MongoServerError && e.code === 11000;

  return {
    kind: "mongodb",

    async createUser(username, passwordHash) {
      const c = await users();
      try {
        const r = await c.insertOne({
          _id: new ObjectId(),
          username,
          usernameKey: username.toLowerCase(),
          passwordHash,
          createdAt: new Date(),
        });
        return { id: r.insertedId.toHexString() };
      } catch (e) {
        if (isDup(e)) return null; // tên đã có người dùng (index unique)
        throw e;
      }
    },

    async findUserByName(key): Promise<StoredUser | null> {
      const u = await (await users()).findOne({ usernameKey: key });
      return u ? { id: u._id.toHexString(), username: u.username, passwordHash: u.passwordHash } : null;
    },

    async createSession(tokenHash, user, days) {
      await (await sessions()).insertOne({
        _id: tokenHash,
        userId: user.id,
        username: user.username,
        expiresAt: new Date(Date.now() + days * 86400_000),
      });
    },

    async sessionUser(tokenHash): Promise<SessionUser | null> {
      const s = await (await sessions()).findOne({ _id: tokenHash, expiresAt: { $gt: new Date() } });
      return s ? { id: s.userId, username: s.username } : null;
    },

    async deleteSession(tokenHash) {
      await (await sessions()).deleteOne({ _id: tokenHash });
    },

    async hitRateLimit(key, windowSec) {
      const c = await rates();
      const now = Date.now();
      // Còn trong cửa sổ: cộng 1
      let doc = await c.findOneAndUpdate(
        { _id: key, windowStart: { $gt: new Date(now - windowSec * 1000) } },
        { $inc: { count: 1 } },
        { returnDocument: "after" }
      );
      if (!doc) {
        // Hết cửa sổ hoặc chưa có: mở cửa sổ mới
        doc = await c.findOneAndUpdate(
          { _id: key },
          { $set: { windowStart: new Date(now), count: 1, expiresAt: new Date(now + windowSec * 1000) } },
          { upsert: true, returnDocument: "after" }
        );
      }
      const end = doc!.windowStart.getTime() + windowSec * 1000;
      return { count: doc!.count, waitMin: Math.ceil((end - now) / 60_000) };
    },

    async clearRateLimit(key) {
      await (await rates()).deleteOne({ _id: key });
    },

    async startChallenge(userId, questions) {
      const c = await challenges();
      await c.deleteMany({ userId, finishedAt: null });
      const id = randomUUID();
      // $currentDate: giờ bắt đầu lấy theo đồng hồ máy chủ MongoDB
      await c.updateOne(
        { _id: id },
        {
          $setOnInsert: { userId, questions: questions.map(([a, n]) => ({ a, n })), finishedAt: null },
          $currentDate: { startedAt: true },
        },
        { upsert: true }
      );
      return id;
    },

    async openChallenge(id, userId): Promise<Fact[] | null> {
      const ch = await (await challenges()).findOne({
        _id: id,
        userId,
        finishedAt: null,
        startedAt: { $gt: new Date(Date.now() - OPEN_WINDOW_MS) },
      });
      return ch?.questions ? ch.questions.map((q) => [q.a, q.n] as Fact) : null;
    },

    async finishChallenge(id, userId, mistakes): Promise<FinishedChallenge | null> {
      const c = await challenges();
      // Chốt giờ nộp theo đồng hồ MongoDB, chỉ thành công một lần (finishedAt: null), xoá đề cho nhẹ dữ liệu
      const doc = await c.findOneAndUpdate(
        { _id: id, userId, finishedAt: null },
        { $currentDate: { finishedAt: true }, $set: { mistakes }, $unset: { questions: "" } },
        { returnDocument: "after" }
      );
      if (!doc || !doc.finishedAt || !doc.startedAt) return null;
      const durationMs = doc.finishedAt.getTime() - doc.startedAt.getTime();
      await c.updateOne({ _id: id }, { $set: { durationMs } });
      return { durationMs, finishedAt: doc.finishedAt };
    },

    async recordBest(userId, username, durationMs, at) {
      const c = await bests();
      const upd = await c.updateOne(
        { _id: userId, durationMs: { $gt: durationMs } },
        { $set: { durationMs, achievedAt: at, username } }
      );
      if (upd.modifiedCount === 1) return true;
      try {
        await c.insertOne({ _id: userId, username, durationMs, achievedAt: at });
        return true; // lượt đầu tiên của người này
      } catch (e) {
        if (isDup(e)) return false; // đã có kỷ lục tốt hơn hoặc bằng
        throw e;
      }
    },

    async topRows(limitMs, limit): Promise<LeaderRow[]> {
      const rows = await (await bests())
        .find({ durationMs: { $lte: limitMs } })
        .sort({ durationMs: 1, achievedAt: 1 })
        .limit(limit)
        .toArray();
      return rows.map((r, i) => ({
        rank: i + 1,
        username: r.username,
        durationMs: r.durationMs,
        achievedAt: r.achievedAt.toISOString(),
      }));
    },

    async standing(userId, limitMs): Promise<Standing> {
      const c = await bests();
      const b = await c.findOne({ _id: userId });
      if (!b) return { personalBestMs: null, rank: null };
      if (b.durationMs > limitMs) return { personalBestMs: b.durationMs, rank: null };
      const ahead = await c.countDocuments({
        $or: [{ durationMs: { $lt: b.durationMs } }, { durationMs: b.durationMs, achievedAt: { $lt: b.achievedAt } }],
      });
      return { personalBestMs: b.durationMs, rank: ahead + 1 };
    },

    async housekeeping() {
      // MongoDB thật tự dọn bằng TTL index; chỉ tự xoá tay khi dịch vụ không hỗ trợ TTL
      const d = await db();
      if (!g.__bnMongoNoTtl) return;
      const now = new Date();
      await Promise.all([
        d.collection("sessions").deleteMany({ expiresAt: { $lt: now } }),
        d.collection("rateLimits").deleteMany({ expiresAt: { $lt: now } }),
        d.collection("challenges").deleteMany({ startedAt: { $lt: new Date(now.getTime() - HISTORY_DAYS * 86400_000) } }),
      ]);
    },
  };
}


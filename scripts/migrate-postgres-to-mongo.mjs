// Chuyển dữ liệu từ Postgres (Neon) sang MongoDB.
//   DATABASE_URL=postgres://...  MONGODB_URI=mongodb+srv://...  node scripts/migrate-postgres-to-mongo.mjs
//
// Chép: tài khoản (giữ nguyên mật khẩu đã mã hoá) và kỷ lục của từng người (bảng Tôn Giả Vinh Diệu).
// Không chép: phiên đăng nhập (mọi người đăng nhập lại một lần) và lịch sử từng lượt chơi.
// Chạy lại nhiều lần vẫn an toàn: tài khoản đã có thì giữ nguyên, kỷ lục chỉ ghi khi tốt hơn.
import pg from "pg";
import { MongoClient, ObjectId } from "mongodb";

const pgUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const mongoUri = process.env.MONGODB_URI;
if (!pgUrl || !mongoUri) {
  console.error("Cần cả DATABASE_URL (Postgres) và MONGODB_URI (MongoDB).");
  process.exit(1);
}

const src = new pg.Client({ connectionString: pgUrl });
await src.connect();
const client = await MongoClient.connect(mongoUri);
const db = client.db(process.env.MONGODB_DB || "rolexnomistake");
const users = db.collection("users");
const bests = db.collection("bests");
await users.createIndex({ usernameKey: 1 }, { unique: true });
await bests.createIndex({ durationMs: 1, achievedAt: 1 });

const pgUsers = (await src.query("select id, username, username_key, password_hash, created_at from users order by id")).rows;
const idMap = new Map(); // id Postgres -> id MongoDB
let created = 0;
for (const u of pgUsers) {
  const r = await users.findOneAndUpdate(
    { usernameKey: u.username_key },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        username: u.username,
        usernameKey: u.username_key,
        passwordHash: u.password_hash,
        createdAt: new Date(u.created_at),
      },
    },
    { upsert: true, returnDocument: "after", includeResultMetadata: true }
  );
  if (!r.lastErrorObject?.updatedExisting) created++;
  idMap.set(u.id, r.value._id.toHexString());
}

const pgBests = (await src.query("select b.user_id, u.username, b.duration_ms, b.achieved_at from best_times b join users u on u.id = b.user_id")).rows;
let bestCount = 0;
for (const b of pgBests) {
  const _id = idMap.get(b.user_id);
  const doc = { username: b.username, durationMs: b.duration_ms, achievedAt: new Date(b.achieved_at) };
  const upd = await bests.updateOne({ _id, durationMs: { $gt: doc.durationMs } }, { $set: doc });
  if (upd.modifiedCount) { bestCount++; continue; }
  try { await bests.insertOne({ _id, ...doc }); bestCount++; } catch (e) { if (e.code !== 11000) throw e; }
}

console.log(`Tài khoản: ${pgUsers.length} (mới chép ${created}) · Kỷ lục: ${pgBests.length} (ghi ${bestCount})`);
console.log(`MongoDB hiện có ${await users.countDocuments()} tài khoản, ${await bests.countDocuments()} kỷ lục.`);
await src.end();
await client.close();

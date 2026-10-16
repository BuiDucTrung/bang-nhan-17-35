import { Pool } from "pg";
import type { Fact, FinishedChallenge, LeaderRow, SessionUser, Standing, Store, StoredUser } from "./types";

type G = typeof globalThis & { __bnPool?: Pool; __bnSchema?: Promise<void> };
const g = globalThis as G;

const SCHEMA = `
create table if not exists users (
  id serial primary key,
  username text not null,
  username_key text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists sessions (
  token_hash text primary key,
  user_id integer not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references users(id) on delete cascade,
  questions jsonb not null,
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  duration_ms integer,
  mistakes integer
);
create index if not exists challenges_user_idx on challenges (user_id);
drop index if exists challenges_done_idx;

-- Thời gian tốt nhất của mỗi người: bảng xếp hạng chỉ đọc bảng nhỏ này thay vì quét toàn bộ lịch sử
create table if not exists best_times (
  user_id integer primary key references users(id) on delete cascade,
  duration_ms integer not null,
  achieved_at timestamptz not null
);
create index if not exists best_times_rank_idx on best_times (duration_ms, achieved_at);
insert into best_times (user_id, duration_ms, achieved_at)
  select distinct on (user_id) user_id, duration_ms, finished_at from challenges
  where duration_ms is not null and not exists (select 1 from best_times)
  order by user_id, duration_ms, finished_at
on conflict (user_id) do nothing;

-- Đếm số lần thử để chặn dò mật khẩu và spam
create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);
create index if not exists sessions_expiry_idx on sessions (expires_at);
`;

export function createPostgresStore(url: string): Store {
  const pool = (g.__bnPool ??= new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000 }));

  /** Tự tạo bảng ở lần gọi đầu tiên, không cần bước cài đặt riêng. */
  async function db(): Promise<Pool> {
    if (!g.__bnSchema) {
      g.__bnSchema = pool.query(SCHEMA).then(() => undefined);
      g.__bnSchema.catch(() => {
        g.__bnSchema = undefined;
      });
    }
    await g.__bnSchema;
    return pool;
  }

  return {
    kind: "postgres",

    async createUser(username, passwordHash) {
      const p = await db();
      try {
        const r = await p.query(
          "insert into users (username, username_key, password_hash) values ($1, $2, $3) returning id",
          [username, username.toLowerCase(), passwordHash]
        );
        return { id: String(r.rows[0].id) };
      } catch (e) {
        if ((e as { code?: string }).code === "23505") return null;
        throw e;
      }
    },

    async findUserByName(key): Promise<StoredUser | null> {
      const p = await db();
      const r = await p.query("select id, username, password_hash from users where username_key = $1", [key]);
      const u = r.rows[0];
      return u ? { id: String(u.id), username: u.username, passwordHash: u.password_hash } : null;
    },

    async createSession(tokenHash, user, days) {
      const p = await db();
      await p.query(
        "insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(days => $3))",
        [tokenHash, Number(user.id), days]
      );
    },

    async sessionUser(tokenHash): Promise<SessionUser | null> {
      const p = await db();
      const r = await p.query(
        `select u.id, u.username from sessions s join users u on u.id = s.user_id
         where s.token_hash = $1 and s.expires_at > now()`,
        [tokenHash]
      );
      const u = r.rows[0];
      return u ? { id: String(u.id), username: u.username } : null;
    },

    async deleteSession(tokenHash) {
      const p = await db();
      await p.query("delete from sessions where token_hash = $1", [tokenHash]);
    },

    async hitRateLimit(key, windowSec) {
      const p = await db();
      const r = await p.query(
        `insert into rate_limits (key, window_start, count) values ($1, now(), 1)
         on conflict (key) do update set
           count = case when rate_limits.window_start < now() - make_interval(secs => $2) then 1 else rate_limits.count + 1 end,
           window_start = case when rate_limits.window_start < now() - make_interval(secs => $2) then now() else rate_limits.window_start end
         returning count, ceil(extract(epoch from (window_start + make_interval(secs => $2) - now())) / 60)::int as wait_min`,
        [key, windowSec]
      );
      return { count: r.rows[0].count, waitMin: r.rows[0].wait_min };
    },

    async clearRateLimit(key) {
      const p = await db();
      await p.query("delete from rate_limits where key = $1", [key]);
    },

    async startChallenge(userId, questions) {
      const p = await db();
      // Một câu lệnh: huỷ lượt đang dở và tạo lượt mới (máy chủ CSDL ghi giờ bắt đầu)
      const r = await p.query(
        `with gone as (delete from challenges where user_id = $1 and finished_at is null)
         insert into challenges (user_id, questions) values ($1, $2) returning id`,
        [Number(userId), JSON.stringify(questions)]
      );
      return r.rows[0].id;
    },

    async openChallenge(id, userId): Promise<Fact[] | null> {
      const p = await db();
      const r = await p.query(
        `select questions from challenges
         where id = $1 and user_id = $2 and finished_at is null and started_at > now() - interval '10 minutes'`,
        [id, Number(userId)]
      );
      return r.rows[0]?.questions ?? null;
    },

    async finishChallenge(id, userId, mistakes): Promise<FinishedChallenge | null> {
      const p = await db();
      const r = await p.query(
        `update challenges
         set finished_at = clock_timestamp(),
             duration_ms = round(extract(epoch from (clock_timestamp() - started_at)) * 1000)::int,
             mistakes = $3
         where id = $1 and user_id = $2 and finished_at is null
         returning duration_ms, finished_at`,
        [id, Number(userId), mistakes]
      );
      const row = r.rows[0];
      return row ? { durationMs: Number(row.duration_ms), finishedAt: new Date(row.finished_at) } : null;
    },

    async recordBest(userId, _username, durationMs, at) {
      const p = await db();
      const r = await p.query(
        `insert into best_times (user_id, duration_ms, achieved_at) values ($1, $2, $3)
         on conflict (user_id) do update set duration_ms = excluded.duration_ms, achieved_at = excluded.achieved_at
           where excluded.duration_ms < best_times.duration_ms
         returning user_id`,
        [Number(userId), durationMs, at]
      );
      return r.rowCount === 1;
    },

    async topRows(limitMs, limit): Promise<LeaderRow[]> {
      const p = await db();
      const r = await p.query(
        `select row_number() over (order by b.duration_ms, b.achieved_at)::int as rank,
                u.username, b.duration_ms, b.achieved_at
         from best_times b join users u on u.id = b.user_id
         where b.duration_ms <= $1
         order by b.duration_ms, b.achieved_at
         limit $2`,
        [limitMs, limit]
      );
      return r.rows.map((x) => ({
        rank: x.rank,
        username: x.username,
        durationMs: x.duration_ms,
        achievedAt: new Date(x.achieved_at).toISOString(),
      }));
    },

    async standing(userId, limitMs): Promise<Standing> {
      const p = await db();
      const r = await p.query(
        `select b.duration_ms,
                case when b.duration_ms <= $2 then
                  (select count(*)::int + 1 from best_times o
                   where o.duration_ms < b.duration_ms
                      or (o.duration_ms = b.duration_ms and o.achieved_at < b.achieved_at))
                end as rank
         from best_times b where b.user_id = $1`,
        [Number(userId), limitMs]
      );
      const row = r.rows[0];
      return { personalBestMs: row ? row.duration_ms : null, rank: row?.rank ?? null };
    },

    async housekeeping() {
      const p = await db();
      await p.query(`
        delete from sessions where expires_at < now();
        delete from rate_limits where window_start < now() - interval '1 day';
        delete from challenges where finished_at is null and started_at < now() - interval '1 day';
        delete from challenges where finished_at < now() - interval '30 days';
      `);
    },
  };
}

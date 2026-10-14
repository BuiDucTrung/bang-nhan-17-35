import { Pool } from "pg";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

type G = typeof globalThis & { __bnPool?: Pool; __bnSchema?: Promise<void> };
const g = globalThis as G;

export class DbNotConfigured extends Error {}

export function getPool(): Pool {
  if (!url) throw new DbNotConfigured("DATABASE_URL chưa được cấu hình");
  if (!g.__bnPool) {
    g.__bnPool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000 });
  }
  return g.__bnPool;
}

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

/** Tự tạo bảng ở lần gọi đầu tiên, không cần bước cài đặt riêng. */
export async function db(): Promise<Pool> {
  const pool = getPool();
  if (!g.__bnSchema) {
    g.__bnSchema = pool.query(SCHEMA).then(() => undefined);
    g.__bnSchema.catch(() => {
      g.__bnSchema = undefined;
    });
  }
  await g.__bnSchema;
  return pool;
}

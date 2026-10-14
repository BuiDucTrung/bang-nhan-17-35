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
create index if not exists challenges_done_idx on challenges (duration_ms, finished_at) where duration_ms is not null;
create index if not exists challenges_user_idx on challenges (user_id);
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

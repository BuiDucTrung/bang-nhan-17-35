import { createMongoStore } from "./mongo";
import { createPostgresStore } from "./postgres";
import { DbNotConfigured, type Store } from "./types";

export * from "./types";

let cached: Store | null = null;

/**
 * Chọn nơi lưu dữ liệu theo biến môi trường:
 *   MONGODB_URI có giá trị            → MongoDB
 *   DATABASE_URL hoặc POSTGRES_URL     → Postgres (Neon)
 * Có cả hai thì ưu tiên MongoDB; đặt DATA_STORE=postgres để ép dùng Postgres.
 */
export function store(): Store {
  if (cached) return cached;
  const mongo = process.env.MONGODB_URI;
  const pg = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const force = process.env.DATA_STORE;
  if (mongo && force !== "postgres") cached = createMongoStore(mongo);
  else if (pg) cached = createPostgresStore(pg);
  else throw new DbNotConfigured("Chưa cấu hình cơ sở dữ liệu");
  return cached;
}

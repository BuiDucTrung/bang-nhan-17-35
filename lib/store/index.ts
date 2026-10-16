import { createPostgresStore } from "./postgres";
import { DbNotConfigured, type Store } from "./types";

export * from "./types";

let cached: Store | null = null;

/** Nơi lưu dữ liệu: Postgres (Neon), đọc địa chỉ từ DATABASE_URL hoặc POSTGRES_URL. */
export function store(): Store {
  if (cached) return cached;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new DbNotConfigured("Chưa cấu hình cơ sở dữ liệu");
  cached = createPostgresStore(url);
  return cached;
}

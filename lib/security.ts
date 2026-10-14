import { db } from "./db";

/** Lỗi trả thẳng cho người dùng với mã HTTP tương ứng. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** IP của người truy cập (Vercel luôn gắn x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim().slice(0, 64);
}

/**
 * Chặn yêu cầu POST gửi từ website khác (CSRF).
 * Cookie đã có SameSite=Lax; đây là lớp bảo vệ thứ hai.
 */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // trình duyệt cũ hoặc gọi trực tiếp không kèm cookie của người khác
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  let ok = false;
  try {
    ok = new URL(origin).host === host;
  } catch {
    ok = false;
  }
  if (!ok) throw new HttpError(403, "Yêu cầu không hợp lệ.");
}

/** Đọc JSON có giới hạn kích thước (chặn gửi dữ liệu khổng lồ). */
export async function readJson(req: Request, maxBytes = 4096): Promise<Record<string, unknown>> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > maxBytes) throw new HttpError(413, "Dữ liệu gửi lên quá lớn.");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Dữ liệu gửi lên quá lớn.");
  try {
    const v = JSON.parse(text || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/**
 * Giới hạn số lần thử: mỗi `key` tối đa `limit` lần trong `windowSec` giây.
 * Vượt quá thì báo lỗi 429 kèm số phút phải chờ.
 */
export async function rateLimit(key: string, limit: number, windowSec: number, message: string) {
  const pool = await db();
  const r = await pool.query(
    `insert into rate_limits (key, window_start, count) values ($1, now(), 1)
     on conflict (key) do update set
       count = case when rate_limits.window_start < now() - make_interval(secs => $2) then 1 else rate_limits.count + 1 end,
       window_start = case when rate_limits.window_start < now() - make_interval(secs => $2) then now() else rate_limits.window_start end
     returning count, ceil(extract(epoch from (window_start + make_interval(secs => $2) - now())) / 60)::int as wait_min`,
    [key, windowSec]
  );
  const { count, wait_min } = r.rows[0];
  if (count > limit) throw new HttpError(429, `${message} Hãy thử lại sau ${Math.max(1, wait_min)} phút.`);
}

/** Xoá bộ đếm (vd. sau khi đăng nhập đúng). */
export async function clearRateLimit(key: string) {
  const pool = await db();
  await pool.query("delete from rate_limits where key = $1", [key]);
}

/** Dọn dữ liệu hết hạn. Chạy thỉnh thoảng (~2% số lần gọi) để không làm chậm mọi yêu cầu. */
export async function housekeeping() {
  if (Math.random() > 0.02) return;
  const pool = await db();
  await pool.query(`
    delete from sessions where expires_at < now();
    delete from rate_limits where window_start < now() - interval '1 day';
    delete from challenges where finished_at is null and started_at < now() - interval '1 day';
  `);
}

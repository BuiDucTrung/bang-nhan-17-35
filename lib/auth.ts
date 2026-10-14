import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db, DbNotConfigured } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "bn_session";
const SESSION_DAYS = 30;

export type SessionUser = { id: number; username: string };

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [kind, saltB64, hashB64] = stored.split("$");
  if (kind !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(pw, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Tạo phiên đăng nhập và gắn cookie vào response. */
export async function startSession(res: NextResponse, userId: number) {
  const token = randomBytes(32).toString("base64url");
  const pool = await db();
  await pool.query(
    `insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`,
    [sha256(token), userId]
  );
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function endSession(res: NextResponse) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    const pool = await db();
    await pool.query("delete from sessions where token_hash = $1", [sha256(token)]);
  }
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const pool = await db();
  const r = await pool.query(
    `select u.id, u.username from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(token)]
  );
  return r.rows[0] ?? null;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Bọc route: trả lỗi dễ hiểu khi chưa có cơ sở dữ liệu hoặc có lỗi bất ngờ. */
export async function guard(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DbNotConfigured) {
      return jsonError("Website chưa được kết nối cơ sở dữ liệu. Hãy thêm Neon Postgres trong Vercel.", 503);
    }
    console.error(e);
    return jsonError("Có lỗi máy chủ. Hãy thử lại sau ít phút.", 500);
  }
}

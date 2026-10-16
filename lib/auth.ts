import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DbNotConfigured, store, type SessionUser } from "./store";
import { HttpError } from "./security";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const PROD = process.env.NODE_ENV === "production";
/** Tiền tố __Host- buộc cookie chỉ gửi qua HTTPS, đúng tên miền này, không bị website con ghi đè. */
export const SESSION_COOKIE = PROD ? "__Host-bn_session" : "bn_session";
/** Cookie không bí mật, chỉ báo cho trang biết "đang đăng nhập" để khách chưa đăng nhập khỏi phải gọi máy chủ. */
export const HINT_COOKIE = "bn_in";
const SESSION_DAYS = 30;

export type { SessionUser };

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [kind, saltB64, hashB64] = stored.split("$");
  if (kind !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  if (expected.length !== 64) return false;
  const actual = await scrypt(pw, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Băm giả để thời gian trả lời như nhau dù tên có tồn tại hay không (chống dò tên qua thời gian). */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(pw: string) {
  dummyHash ??= hashPassword("khong-ton-tai-" + randomBytes(8).toString("hex"));
  await verifyPassword(pw, await dummyHash);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const cookieBase = { sameSite: "lax" as const, secure: PROD, path: "/", maxAge: SESSION_DAYS * 24 * 3600 };

/** Tạo phiên đăng nhập và gắn cookie vào response. */
export async function startSession(res: NextResponse, user: SessionUser) {
  const token = randomBytes(32).toString("base64url");
  await store().createSession(sha256(token), user, SESSION_DAYS);
  res.cookies.set(SESSION_COOKIE, token, { ...cookieBase, httpOnly: true });
  res.cookies.set(HINT_COOKIE, encodeURIComponent(user.username), { ...cookieBase, httpOnly: false });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { ...cookieBase, httpOnly: true, maxAge: 0 });
  res.cookies.set(HINT_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

export async function endSession(res: NextResponse) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await store().deleteSession(sha256(token));
  clearSessionCookies(res);
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  return store().sessionUser(sha256(token));
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Bọc route: trả lỗi dễ hiểu, và mặc định cấm lưu cache
 * (dữ liệu tài khoản không bao giờ bị lưu ở proxy hay CDN).
 */
export async function guard(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  let res: NextResponse;
  try {
    res = await fn();
  } catch (e) {
    if (e instanceof HttpError) res = jsonError(e.message, e.status);
    else if (e instanceof DbNotConfigured)
      res = jsonError("Website chưa được kết nối cơ sở dữ liệu. Hãy thêm Neon Postgres trong Vercel.", 503);
    else {
      console.error(e);
      res = jsonError("Có lỗi máy chủ. Hãy thử lại sau ít phút.", 500);
    }
  }
  if (!res.headers.has("Cache-Control")) res.headers.set("Cache-Control", "private, no-store");
  return res;
}

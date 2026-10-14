import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guard, jsonError, startSession, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return guard(async () => {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) return jsonError("Hãy nhập tên và mật khẩu.");

    const pool = await db();
    const r = await pool.query(
      "select id, username, password_hash from users where username_key = $1",
      [username.toLowerCase()]
    );
    const u = r.rows[0];
    if (!u || !(await verifyPassword(password, u.password_hash))) {
      return jsonError("Sai tên hoặc mật khẩu.", 401);
    }

    const res = NextResponse.json({ user: { id: u.id, username: u.username } });
    await startSession(res, u.id);
    return res;
  });
}

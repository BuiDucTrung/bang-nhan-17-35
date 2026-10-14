import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guard, hashPassword, jsonError, startSession } from "@/lib/auth";
import { passwordErrors, usernameErrors } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return guard(async () => {
    const body = await req.json().catch(() => ({}));
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";

    const errs = [...usernameErrors(username), ...passwordErrors(password)];
    if (errs.length) return jsonError(errs[0]);

    const pool = await db();
    let userId: number;
    try {
      const r = await pool.query(
        "insert into users (username, username_key, password_hash) values ($1, $2, $3) returning id",
        [username, username.toLowerCase(), await hashPassword(password)]
      );
      userId = r.rows[0].id;
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "23505") {
        return jsonError(`Tên "${username}" đã có người dùng. Hãy chọn tên khác.`, 409);
      }
      throw e;
    }

    const res = NextResponse.json({ user: { id: userId, username } });
    await startSession(res, userId);
    return res;
  });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guard, hashPassword, jsonError, startSession } from "@/lib/auth";
import { assertSameOrigin, clientIp, housekeeping, rateLimit, readJson } from "@/lib/security";
import { passwordErrors, usernameErrors } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return guard(async () => {
    assertSameOrigin(req);
    const body = await readJson(req);
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";

    const errs = [...usernameErrors(username), ...passwordErrors(password)];
    if (errs.length) return jsonError(errs[0]);

    // Mỗi IP tối đa 10 tài khoản mới mỗi giờ (chặn tạo tài khoản rác hàng loạt)
    await rateLimit(`reg:${clientIp(req)}`, 10, 3600, "Bạn đã tạo quá nhiều tài khoản.");

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

    const res = NextResponse.json({ user: { username } });
    await startSession(res, { id: userId, username });
    await housekeeping();
    return res;
  });
}

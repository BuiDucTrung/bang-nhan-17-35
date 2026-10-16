import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { burnPasswordCheck, guard, jsonError, startSession, verifyPassword } from "@/lib/auth";
import { assertSameOrigin, clearRateLimit, clientIp, housekeeping, rateLimit, readJson } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return guard(async () => {
    assertSameOrigin(req);
    const body = await readJson(req);
    const username = typeof body.username === "string" ? body.username.trim().slice(0, 40) : "";
    const password = typeof body.password === "string" ? body.password.slice(0, 100) : "";
    if (!username || !password) return jsonError("Hãy nhập tên và mật khẩu.");

    // Chống dò mật khẩu: tối đa 8 lần sai cho một tên trên một IP, và 40 lần mỗi IP, trong 15 phút
    const ip = clientIp(req);
    const nameKey = `login:${ip}:${username.toLowerCase()}`;
    const msg = "Bạn đã nhập sai quá nhiều lần.";
    await rateLimit(nameKey, 8, 900, msg);
    await rateLimit(`login-ip:${ip}`, 40, 900, msg);

    const u = await store().findUserByName(username.toLowerCase());
    const ok = u ? await verifyPassword(password, u.passwordHash) : (await burnPasswordCheck(password), false);
    if (!ok || !u) return jsonError("Sai tên hoặc mật khẩu.", 401);

    await clearRateLimit(nameKey);
    const res = NextResponse.json({ user: { username: u.username } });
    await startSession(res, { id: u.id, username: u.username });
    await housekeeping();
    return res;
  });
}

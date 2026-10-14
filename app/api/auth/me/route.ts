import { NextResponse } from "next/server";
import { clearSessionCookies, currentUser, guard } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => {
    const user = await currentUser();
    const res = NextResponse.json({ user: user ? { username: user.username } : null });
    if (!user) clearSessionCookies(res); // phiên đã hết hạn: xoá cookie để lần sau không phải hỏi lại
    return res;
  });
}

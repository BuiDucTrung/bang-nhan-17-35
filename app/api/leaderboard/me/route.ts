import { NextResponse } from "next/server";
import { currentUser, guard } from "@/lib/auth";
import { store } from "@/lib/store";
import { CHALLENGE_LIMIT_MS } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hạng và kỷ lục của người đang đăng nhập (riêng tư, không lưu cache). */
export async function GET() {
  return guard(async () => {
    const user = await currentUser();
    if (!user) return NextResponse.json({ me: null });
    return NextResponse.json({ me: { username: user.username, ...(await store().standing(user.id, CHALLENGE_LIMIT_MS)) } });
  });
}

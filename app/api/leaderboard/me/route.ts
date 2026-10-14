import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, guard } from "@/lib/auth";
import { standing } from "@/lib/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hạng và kỷ lục của người đang đăng nhập (riêng tư, không lưu cache). */
export async function GET() {
  return guard(async () => {
    const user = await currentUser();
    if (!user) return NextResponse.json({ me: null });
    const pool = await db();
    return NextResponse.json({ me: { username: user.username, ...(await standing(pool, user.id)) } });
  });
}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, guard } from "@/lib/auth";
import { personalBest, rowForUser, topRows } from "@/lib/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => {
    const pool = await db();
    const user = await currentUser();
    const [rows, mine, best] = await Promise.all([
      topRows(pool, 100),
      user ? rowForUser(pool, user.id) : Promise.resolve(null),
      user ? personalBest(pool, user.id) : Promise.resolve(null),
    ]);
    return NextResponse.json({
      rows: rows.map(({ userId, ...r }) => ({ ...r, isMe: user?.id === userId })),
      me: user ? { rank: mine?.rank ?? null, personalBestMs: best } : null,
    });
  });
}

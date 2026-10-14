import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guard } from "@/lib/auth";
import { topRows } from "@/lib/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bảng xếp hạng công khai, giống nhau với mọi người nên được CDN của Vercel lưu 15 giây.
 * Nhiều người cùng xem chỉ tốn một lần truy vấn cơ sở dữ liệu.
 */
export async function GET() {
  return guard(async () => {
    const pool = await db();
    const res = NextResponse.json({ rows: await topRows(pool, 100) });
    res.headers.set("Cache-Control", "public, max-age=0, s-maxage=15, stale-while-revalidate=60");
    return res;
  });
}

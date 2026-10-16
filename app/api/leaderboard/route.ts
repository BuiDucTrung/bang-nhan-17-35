import { NextResponse } from "next/server";
import { guard } from "@/lib/auth";
import { store } from "@/lib/store";
import { CHALLENGE_LIMIT_MS } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Bảng xếp hạng công khai, giống nhau với mọi người nên được CDN của Vercel lưu 15 giây.
 * Nhiều người cùng xem chỉ tốn một lần truy vấn cơ sở dữ liệu.
 */
export async function GET() {
  return guard(async () => {
    const res = NextResponse.json({ rows: await store().topRows(CHALLENGE_LIMIT_MS, 100) });
    res.headers.set("Cache-Control", "public, max-age=0, s-maxage=15, stale-while-revalidate=60");
    return res;
  });
}

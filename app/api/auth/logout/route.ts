import { NextResponse } from "next/server";
import { endSession, guard } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return guard(async () => {
    const res = NextResponse.json({ ok: true });
    await endSession(res);
    return res;
  });
}

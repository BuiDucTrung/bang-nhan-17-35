import { NextResponse } from "next/server";
import { endSession, guard } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return guard(async () => {
    assertSameOrigin(req);
    const res = NextResponse.json({ ok: true });
    await endSession(res);
    return res;
  });
}

import { NextResponse } from "next/server";
import { currentUser, guard } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return guard(async () => NextResponse.json({ user: await currentUser() }));
}

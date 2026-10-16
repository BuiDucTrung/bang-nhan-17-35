import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { currentUser, guard, jsonError } from "@/lib/auth";
import { assertSameOrigin, housekeeping, rateLimit } from "@/lib/security";
import { CHALLENGE_MULTIPLIERS, CHALLENGE_SIZE, CHALLENGE_TABLES } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 10 phép ngẫu nhiên, không trùng nhau, từ bảng 17 và 35 (bỏ ×1, ×10, ×20). */
function pickQuestions(): [number, number][] {
  const pool: [number, number][] = [];
  for (const a of CHALLENGE_TABLES) for (const n of CHALLENGE_MULTIPLIERS) pool.push([a, n]);
  // Fisher–Yates bằng bộ sinh số ngẫu nhiên mật mã
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, CHALLENGE_SIZE);
}

export async function POST(req: Request) {
  return guard(async () => {
    assertSameOrigin(req);
    const user = await currentUser();
    if (!user) return jsonError("Hãy đăng nhập để tham gia challenge.", 401);
    // Tối đa 60 lượt mỗi 10 phút cho một người (chặn spam làm phình cơ sở dữ liệu)
    await rateLimit(`ch:${user.id}`, 60, 600, "Bạn bắt đầu quá nhiều lượt liên tiếp.");

    const questions = pickQuestions();
    // Huỷ lượt đang dở (mỗi lúc chỉ một lượt) và tạo lượt mới; giờ bắt đầu do cơ sở dữ liệu ghi
    const id = await store().startChallenge(user.id, questions);
    await housekeeping();
    return NextResponse.json({ id, questions });
  });
}

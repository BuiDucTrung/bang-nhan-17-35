import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, guard, jsonError } from "@/lib/auth";
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

export async function POST() {
  return guard(async () => {
    const user = await currentUser();
    if (!user) return jsonError("Hãy đăng nhập để tham gia challenge.", 401);

    const pool = await db();
    // Huỷ các lượt đang dở của người này, mỗi lúc chỉ có một lượt
    await pool.query("delete from challenges where user_id = $1 and finished_at is null", [user.id]);

    const questions = pickQuestions();
    // Máy chủ ghi giờ bắt đầu (clock_timestamp) để tính thời gian chính thức
    const r = await pool.query(
      "insert into challenges (user_id, questions) values ($1, $2) returning id",
      [user.id, JSON.stringify(questions)]
    );
    return NextResponse.json({ id: r.rows[0].id, questions });
  });
}

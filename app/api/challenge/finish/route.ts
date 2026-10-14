import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser, guard, jsonError } from "@/lib/auth";
import { recordBest, standing } from "@/lib/leaderboard";
import { assertSameOrigin, readJson } from "@/lib/security";
import { CHALLENGE_LIMIT_MS, CHALLENGE_SIZE } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  return guard(async () => {
    assertSameOrigin(req);
    const user = await currentUser();
    if (!user) return jsonError("Phiên đăng nhập đã hết. Hãy đăng nhập lại.", 401);

    const body = await readJson(req);
    const id = typeof body.id === "string" && UUID.test(body.id) ? body.id : null;
    const answers = body.answers;
    const m = Number(body.mistakes);
    const mistakes = Number.isInteger(m) && m >= 0 ? Math.min(m, 999) : 0;
    if (!id || !Array.isArray(answers) || answers.length !== CHALLENGE_SIZE) {
      return jsonError("Dữ liệu challenge không hợp lệ.");
    }

    const pool = await db();
    const found = await pool.query(
      `select questions from challenges
       where id = $1 and user_id = $2 and finished_at is null and started_at > now() - interval '10 minutes'`,
      [id, user.id]
    );
    if (!found.rows[0]) return jsonError("Lượt challenge này đã kết thúc hoặc hết hạn. Hãy bắt đầu lượt mới.", 409);

    // Máy chủ tự chấm lại từng câu bằng phép nhân, không tin kết quả do trình duyệt gửi lên
    const questions = found.rows[0].questions as [number, number][];
    const allRight = questions.every(([a, n], i) => Number(answers[i]) === a * n);
    if (!allRight) return jsonError("Có câu trả lời chưa đúng nên lượt này không được tính.");

    // Thời gian chính thức = lúc máy chủ nhận bài − lúc máy chủ phát đề
    const upd = await pool.query(
      `update challenges
       set finished_at = clock_timestamp(),
           duration_ms = round(extract(epoch from (clock_timestamp() - started_at)) * 1000)::int,
           mistakes = $3
       where id = $1 and user_id = $2 and finished_at is null
       returning duration_ms, finished_at`,
      [id, user.id, mistakes]
    );
    if (!upd.rows[0]) return jsonError("Lượt challenge này đã được nộp.", 409);

    const durationMs = Number(upd.rows[0].duration_ms);
    const isNewBest = await recordBest(pool, user.id, durationMs, upd.rows[0].finished_at);
    const st = await standing(pool, user.id);

    return NextResponse.json({
      durationMs,
      qualified: durationMs <= CHALLENGE_LIMIT_MS,
      isNewBest,
      personalBestMs: st.personalBestMs,
      rank: st.rank,
    });
  });
}

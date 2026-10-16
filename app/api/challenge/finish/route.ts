import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { currentUser, guard, jsonError } from "@/lib/auth";
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

    const st = store();
    const questions = await st.openChallenge(id, user.id);
    if (!questions) return jsonError("Lượt challenge này đã kết thúc hoặc hết hạn. Hãy bắt đầu lượt mới.", 409);

    // Máy chủ tự chấm lại từng câu bằng phép nhân, không tin kết quả do trình duyệt gửi lên
    const allRight = questions.every(([a, n], i) => Number(answers[i]) === a * n);
    if (!allRight) return jsonError("Có câu trả lời chưa đúng nên lượt này không được tính.");

    // Thời gian chính thức = lúc máy chủ nhận bài − lúc máy chủ phát đề (đồng hồ của cơ sở dữ liệu)
    const done = await st.finishChallenge(id, user.id, mistakes);
    if (!done) return jsonError("Lượt challenge này đã được nộp.", 409);

    const durationMs = done.durationMs;
    const isNewBest = await st.recordBest(user.id, user.username, durationMs, done.finishedAt);
    const standing = await st.standing(user.id, CHALLENGE_LIMIT_MS);

    return NextResponse.json({
      durationMs,
      qualified: durationMs <= CHALLENGE_LIMIT_MS,
      isNewBest,
      personalBestMs: standing.personalBestMs,
      rank: standing.rank,
    });
  });
}

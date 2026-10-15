import type { Pool } from "pg";
import { CHALLENGE_LIMIT_MS } from "./rules";

export type LeaderRow = { rank: number; username: string; durationMs: number; achievedAt: string };

/**
 * Bảng Tôn Giả Vinh Diệu: thời gian tốt nhất (≤ CHALLENGE_LIMIT_MS) của mỗi người, nhanh nhất lên đầu.
 * Bằng giờ thì ai đạt trước xếp trên. Đọc từ bảng best_times (mỗi người một dòng) nên rất nhanh.
 */
export async function topRows(pool: Pool, limit = 100): Promise<LeaderRow[]> {
  const r = await pool.query(
    `select row_number() over (order by b.duration_ms, b.achieved_at)::int as rank,
            u.username, b.duration_ms, b.achieved_at
     from best_times b join users u on u.id = b.user_id
     where b.duration_ms <= $1
     order by b.duration_ms, b.achieved_at
     limit $2`,
    [CHALLENGE_LIMIT_MS, limit]
  );
  return r.rows.map((x) => ({
    rank: x.rank,
    username: x.username,
    durationMs: x.duration_ms,
    achievedAt: new Date(x.achieved_at).toISOString(),
  }));
}

/** Kỷ lục cá nhân (kể cả khi chưa đạt mốc) và hạng nếu đã vào bảng. */
export async function standing(pool: Pool, userId: number): Promise<{ personalBestMs: number | null; rank: number | null }> {
  const r = await pool.query(
    `select b.duration_ms,
            case when b.duration_ms <= $2 then
              (select count(*)::int + 1 from best_times o
               where o.duration_ms < b.duration_ms
                  or (o.duration_ms = b.duration_ms and o.achieved_at < b.achieved_at))
            end as rank
     from best_times b where b.user_id = $1`,
    [userId, CHALLENGE_LIMIT_MS]
  );
  const row = r.rows[0];
  return { personalBestMs: row ? row.duration_ms : null, rank: row?.rank ?? null };
}

/** Ghi thành tích mới nếu tốt hơn kỷ lục cũ. Trả về true nếu là kỷ lục mới. */
export async function recordBest(pool: Pool, userId: number, durationMs: number, at: Date): Promise<boolean> {
  const r = await pool.query(
    `insert into best_times (user_id, duration_ms, achieved_at) values ($1, $2, $3)
     on conflict (user_id) do update set duration_ms = excluded.duration_ms, achieved_at = excluded.achieved_at
       where excluded.duration_ms < best_times.duration_ms
     returning user_id`,
    [userId, durationMs, at]
  );
  return r.rowCount === 1;
}

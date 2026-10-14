import type { Pool } from "pg";
import { CHALLENGE_LIMIT_MS } from "./rules";

export type LeaderRow = { rank: number; username: string; durationMs: number; achievedAt: string; userId: number };

/** Thời gian tốt nhất (≤ 16 giây) của mỗi người, xếp từ nhanh đến chậm. Bằng giờ thì ai đạt trước xếp trên. */
const RANKED = `
  with best as (
    select distinct on (user_id) user_id, duration_ms, finished_at
    from challenges
    where duration_ms is not null and duration_ms <= ${CHALLENGE_LIMIT_MS}
    order by user_id, duration_ms asc, finished_at asc
  )
  select row_number() over (order by b.duration_ms asc, b.finished_at asc)::int as rank,
         u.id as user_id, u.username, b.duration_ms, b.finished_at
  from best b join users u on u.id = b.user_id
`;

const toRow = (r: Record<string, unknown>): LeaderRow => ({
  rank: Number(r.rank),
  userId: Number(r.user_id),
  username: String(r.username),
  durationMs: Number(r.duration_ms),
  achievedAt: new Date(r.finished_at as string).toISOString(),
});

export async function topRows(pool: Pool, limit = 100): Promise<LeaderRow[]> {
  const r = await pool.query(`${RANKED} order by rank limit $1`, [limit]);
  return r.rows.map(toRow);
}

export async function rowForUser(pool: Pool, userId: number): Promise<LeaderRow | null> {
  const r = await pool.query(`select * from (${RANKED}) t where user_id = $1`, [userId]);
  return r.rows[0] ? toRow(r.rows[0]) : null;
}

/** Thành tích tốt nhất của người dùng, kể cả khi chưa đạt 16 giây. */
export async function personalBest(pool: Pool, userId: number): Promise<number | null> {
  const r = await pool.query(
    "select min(duration_ms) as best from challenges where user_id = $1 and duration_ms is not null",
    [userId]
  );
  return r.rows[0]?.best == null ? null : Number(r.rows[0].best);
}

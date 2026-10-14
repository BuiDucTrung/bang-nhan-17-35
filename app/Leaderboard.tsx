"use client";

import { useEffect, useState } from "react";
import { Auth, api } from "./Account";
import { formatSeconds } from "@/lib/rules";

type Row = { rank: number; username: string; durationMs: number; achievedAt: string; isMe: boolean };
type Data = { rows: Row[]; me: { rank: number | null; personalBestMs: number | null } | null };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function LeaderboardView({ auth, onPlay }: { auth: Auth; onPlay: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api<Data>("/api/leaderboard")
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, [auth.user]);

  return (
    <section className="view lb">
      <header className="lb-head">
        <p className="eyebrow">Bảng xếp hạng</p>
        <h2 className="lb-title">Tôn Giả Vinh Diệu</h2>
        <p className="lb-sub">
          Những người hoàn thành Challenge 10 phép trong 16 giây trở xuống. Mỗi người được tính thời gian tốt
          nhất. Bằng giờ thì ai đạt trước xếp trên.
        </p>
      </header>

      {auth.user && data?.me && (
        <div className="lb-me">
          <span>
            <b>{auth.user.username}</b> ·{" "}
            {data.me.rank ? (
              <>
                Hạng <b>#{data.me.rank}</b>
              </>
            ) : (
              "chưa vào bảng"
            )}
          </span>
          <span>
            Kỷ lục:{" "}
            <b>{data.me.personalBestMs != null ? formatSeconds(data.me.personalBestMs) : "chưa có"}</b>
          </span>
        </div>
      )}

      {error && (
        <p className="form-err" role="alert">
          {error}
        </p>
      )}

      {!data && !error && <p className="lb-empty">Đang tải bảng xếp hạng…</p>}

      {data && data.rows.length === 0 && (
        <div className="lb-empty">
          <p>Chưa có ai vào bảng. Hãy là người đầu tiên.</p>
        </div>
      )}

      {data && data.rows.length > 0 && (
        <ol className="lb-list">
          {data.rows.map((r) => (
            <li key={r.rank} className={`${r.rank <= 3 ? `top top${r.rank}` : ""}${r.isMe ? " me" : ""}`}>
              <span className="lb-rank">{r.rank}</span>
              <span className="lb-name">
                {r.username}
                {r.isMe && <span className="badge">Bạn</span>}
              </span>
              <span className="lb-time">{formatSeconds(r.durationMs)}</span>
              <span className="lb-date">{fmtDate(r.achievedAt)}</span>
            </li>
          ))}
        </ol>
      )}

      <div>
        <button className="primary big" onClick={onPlay}>
          Tham gia Challenge
        </button>
      </div>
    </section>
  );
}

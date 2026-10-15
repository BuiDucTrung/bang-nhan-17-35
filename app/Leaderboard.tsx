"use client";

import { useEffect, useState } from "react";
import { Auth, api } from "./Account";
import { CHALLENGE_LIMIT_S, formatSeconds } from "@/lib/rules";
import { consumeFresh } from "./lbState";

type Row = { rank: number; username: string; durationMs: number; achievedAt: string };
type Me = { username: string; rank: number | null; personalBestMs: number | null } | null;

// Giữ lại bảng đã tải trong phiên này: quay lại tab là thấy ngay, đồng thời tải bản mới ở nền
let cachedRows: Row[] | null = null;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function LeaderboardView({ auth, onPlay }: { auth: Auth; onPlay: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(cachedRows);
  const [me, setMe] = useState<Me>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    const url = consumeFresh() ? `/api/leaderboard?t=${Date.now()}` : "/api/leaderboard";
    api<{ rows: Row[] }>(url)
      .then((d) => {
        cachedRows = d.rows;
        setRows(d.rows);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    if (!auth.user) {
      setMe(null);
      return;
    }
    api<{ me: Me }>("/api/leaderboard/me")
      .then((d) => setMe(d.me))
      .catch(() => setMe(null));
  }, [auth.user]);

  const myName = auth.user?.username.toLowerCase();

  return (
    <section className="view lb">
      <header className="lb-head">
        <p className="eyebrow">Bảng xếp hạng</p>
        <h2 className="lb-title">Tôn Giả Vinh Diệu</h2>
        <p className="lb-sub">
          Những người hoàn thành Challenge 10 phép trong {CHALLENGE_LIMIT_S} giây trở xuống. Mỗi người được tính thời gian tốt
          nhất. Bằng giờ thì ai đạt trước xếp trên.
        </p>
      </header>

      {auth.user && me && (
        <div className="lb-me">
          <span>
            <b>{me.username}</b> ·{" "}
            {me.rank ? (
              <>
                Hạng <b>#{me.rank}</b>
              </>
            ) : (
              "chưa vào bảng"
            )}
          </span>
          <span>
            Kỷ lục: <b>{me.personalBestMs != null ? formatSeconds(me.personalBestMs) : "chưa có"}</b>
          </span>
        </div>
      )}

      {error && (
        <p className="form-err" role="alert">
          {error}
        </p>
      )}

      {!rows && !error && <p className="lb-empty">Đang tải bảng xếp hạng…</p>}

      {rows && rows.length === 0 && (
        <div className="lb-empty">
          <p>Chưa có ai vào bảng. Hãy là người đầu tiên.</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <ol className="lb-list">
          {rows.map((r) => {
            const isMe = r.username.toLowerCase() === myName;
            return (
              <li key={r.rank} className={`${r.rank <= 3 ? `top top${r.rank}` : ""}${isMe ? " me" : ""}`}>
                <span className="lb-rank">{r.rank}</span>
                <span className="lb-name">
                  {r.username}
                  {isMe && <span className="badge">Bạn</span>}
                </span>
                <span className="lb-time">{formatSeconds(r.durationMs)}</span>
                <span className="lb-date">{fmtDate(r.achievedAt)}</span>
              </li>
            );
          })}
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

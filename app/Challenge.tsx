"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Auth, api } from "./Account";
import { CHALLENGE_LIMIT_MS, CHALLENGE_SIZE, formatSeconds } from "@/lib/rules";

type Phase = "intro" | "countdown" | "running" | "submitting" | "result";
type Q = [number, number];
type FinishRes = {
  durationMs: number;
  qualified: boolean;
  isNewBest: boolean;
  personalBestMs: number | null;
  rank: number | null;
};
type Me = { rank: number | null; personalBestMs: number | null } | null;

export default function ChallengeView({ auth, onShowRank }: { auth: Auth; onShowRank: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [count, setCount] = useState(3);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState("");
  const [mistakes, setMistakes] = useState(0);
  const [shake, setShake] = useState(0);
  const [result, setResult] = useState<FinishRes | null>(null);
  const [error, setError] = useState("");
  const [me, setMe] = useState<Me>(null);
  const [touch, setTouch] = useState(false);

  const idRef = useRef("");
  const answersRef = useRef<number[]>([]);
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const timerEl = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const clientMsRef = useRef(0);

  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Thành tích của người dùng cho màn giới thiệu
  useEffect(() => {
    if (!auth.user) {
      setMe(null);
      return;
    }
    api<{ me: Me }>("/api/leaderboard")
      .then((d) => setMe(d.me))
      .catch(() => setMe(null));
  }, [auth.user, result]);

  const tick = useCallback(() => {
    const ms = performance.now() - startRef.current;
    if (timerEl.current) {
      timerEl.current.textContent = (ms / 1000).toFixed(2).replace(".", ",");
      timerEl.current.parentElement?.classList.toggle("over", ms > CHALLENGE_LIMIT_MS);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const begin = () => {
    if (!auth.user) {
      auth.openDialog("login");
      return;
    }
    setError("");
    setResult(null);
    setCount(3);
    setPhase("countdown");
  };

  // Đếm ngược 3‑2‑1, hết đếm thì xin đề từ máy chủ (máy chủ bắt đầu tính giờ lúc phát đề)
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count > 0) {
      const t = setTimeout(() => setCount((c) => c - 1), 700);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    api<{ id: string; questions: Q[] }>("/api/challenge/start", {})
      .then((d) => {
        if (cancelled) return;
        idRef.current = d.id;
        answersRef.current = [];
        setQuestions(d.questions);
        setIdx(0);
        setInput("");
        setMistakes(0);
        setPhase("running");
        startRef.current = performance.now();
        rafRef.current = requestAnimationFrame(tick);
        if (!touch) requestAnimationFrame(() => inputRef.current?.focus());
      })
      .catch((e) => {
        if (cancelled) return;
        setError((e as Error).message);
        setPhase("intro");
      });
    return () => {
      cancelled = true;
    };
  }, [phase, count, tick, touch]);

  const finish = async (answers: number[], miss: number) => {
    cancelAnimationFrame(rafRef.current);
    clientMsRef.current = performance.now() - startRef.current;
    setPhase("submitting");
    try {
      const r = await api<FinishRes>("/api/challenge/finish", { id: idRef.current, answers, mistakes: miss });
      setResult(r);
      setPhase("result");
    } catch (e) {
      setError((e as Error).message);
      setPhase("intro");
    }
  };

  const submitAnswer = () => {
    if (phase !== "running" || !input) return;
    const [a, n] = questions[idx];
    if (Number(input) === a * n) {
      answersRef.current[idx] = a * n;
      if (idx + 1 >= CHALLENGE_SIZE) {
        finish(answersRef.current.slice(), mistakes);
      } else {
        setIdx(idx + 1);
        setInput("");
      }
    } else {
      setMistakes((m) => m + 1);
      setShake((s) => s + 1);
      setInput("");
    }
  };

  const press = (t: string) => {
    if (phase !== "running") return;
    if (t === "del") setInput((v) => v.slice(0, -1));
    else if (t === "ok") submitAnswer();
    else setInput((v) => (v.length < 3 ? v + t : v));
  };

  /* ---------- Giao diện ---------- */

  if (phase === "intro" || phase === "countdown") {
    return (
      <section className="view ch">
        <div className="ch-intro">
          <p className="eyebrow">Challenge</p>
          <h2 className="ch-title">10 phép · 16 giây</h2>
          <ul className="ch-rules">
            <li>10 phép ngẫu nhiên, không trùng nhau, lấy từ bảng 17 và 35.</li>
            <li>Không có phép ×1, ×10, ×20.</li>
            <li>Trả lời sai thì nhập lại, đồng hồ vẫn chạy.</li>
            <li>
              Hoàn thành trong <b>16 giây</b> trở xuống để có tên trong bảng <b>Tôn Giả Vinh Diệu</b>.
            </li>
          </ul>

          {auth.user && me && (
            <div className="ch-me">
              <span>
                Kỷ lục của bạn: <b>{me.personalBestMs != null ? formatSeconds(me.personalBestMs) : "chưa có"}</b>
              </span>
              <span>{me.rank ? <>Hạng <b>#{me.rank}</b></> : "Chưa vào bảng"}</span>
            </div>
          )}

          {error && (
            <p className="form-err" role="alert">
              {error}
            </p>
          )}

          {phase === "countdown" ? (
            <div className="countdown" aria-live="assertive">
              {count > 0 ? count : "Bắt đầu!"}
            </div>
          ) : auth.user ? (
            <button className="primary big" onClick={begin}>
              Bắt đầu challenge
            </button>
          ) : (
            <div className="ch-login">
              <p>Bạn cần đăng nhập để tham gia và được ghi tên vào bảng xếp hạng.</p>
              <div className="ch-login-btns">
                <button className="primary big" onClick={() => auth.openDialog("login")}>
                  Đăng nhập
                </button>
                <button className="secondary big" onClick={() => auth.openDialog("register")}>
                  Đăng ký
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (phase === "result" && result) {
    const over = result.durationMs - CHALLENGE_LIMIT_MS;
    return (
      <section className="view ch">
        <div className={`ch-result ${result.qualified ? "win" : "miss"}`}>
          <p className="eyebrow">Thời gian chính thức</p>
          <div className="ch-time">{formatSeconds(result.durationMs)}</div>
          {result.qualified ? (
            <p className="ch-verdict">
              Bạn đã có tên trong bảng Tôn Giả Vinh Diệu
              {result.rank ? (
                <>
                  {" "}
                  · Hạng <b>#{result.rank}</b>
                </>
              ) : null}
            </p>
          ) : (
            <p className="ch-verdict">
              Chưa đạt. Cần 16 giây trở xuống, bạn chậm hơn {formatSeconds(over)}.
            </p>
          )}
          <dl className="ch-facts">
            <div>
              <dt>Kỷ lục cá nhân</dt>
              <dd>
                {result.personalBestMs != null ? formatSeconds(result.personalBestMs) : "—"}
                {result.isNewBest && <span className="badge">Mới</span>}
              </dd>
            </div>
            <div>
              <dt>Số lần nhập sai</dt>
              <dd>{mistakes}</dd>
            </div>
          </dl>
          <p className="fine">
            Thời gian chính thức do máy chủ đo, từ lúc phát đề đến lúc nhận bài, nên có thể dài hơn đồng hồ trên
            màn hình một chút ({formatSeconds(clientMsRef.current)}).
          </p>
          <div className="ch-actions">
            <button className="primary big" onClick={begin}>
              Chơi lại
            </button>
            <button className="secondary big" onClick={onShowRank}>
              Bảng xếp hạng
            </button>
          </div>
        </div>
      </section>
    );
  }

  // running / submitting
  const q = questions[Math.min(idx, questions.length - 1)];
  return (
    <section className={`view ch running${touch ? " is-touch" : ""}`}>
      <div className="ch-bar">
        <span className="ch-step">
          Câu <b>{Math.min(idx + 1, CHALLENGE_SIZE)}</b>/{CHALLENGE_SIZE}
        </span>
        <span className="ch-clock">
          <span ref={timerEl}>0,00</span> giây
        </span>
      </div>
      <div className="dots" aria-hidden="true">
        {Array.from({ length: CHALLENGE_SIZE }, (_, i) => (
          <span key={i} className={i < idx || phase === "submitting" ? "done" : i === idx ? "now" : ""} />
        ))}
      </div>

      <div className={`card ch-card${shake ? ` shake-${shake % 2}` : ""}`} key={`q${idx}`}>
        <div className="q">
          <span style={{ color: q?.[0] === 35 ? "var(--chip35)" : "var(--chip17)" }}>{q?.[0]}</span>
          <span className="x">×</span>
          <span>{q?.[1]}</span>
        </div>
        <form
          className="answer-row"
          onSubmit={(e) => {
            e.preventDefault();
            submitAnswer();
          }}
          autoComplete="off"
        >
          <input
            ref={inputRef}
            id="ch-answer"
            aria-label="Kết quả"
            inputMode={touch ? "none" : "numeric"}
            pattern="[0-9]*"
            maxLength={3}
            placeholder="?"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, "").slice(0, 3))}
            readOnly={phase !== "running"}
          />
        </form>
        <div className="feedback ch-msg" aria-live="polite">
          {phase === "submitting" ? "Đang chấm…" : mistakes ? `Nhập sai: ${mistakes}` : ""}
        </div>
        <div className="keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "ok"].map((t) => (
            <button
              key={t}
              type="button"
              className={t === "ok" ? "k-ok" : t === "del" ? "k-del" : undefined}
              aria-label={t === "del" ? "Xóa" : t === "ok" ? "Trả lời" : t}
              disabled={phase !== "running"}
              onClick={() => press(t)}
            >
              {t === "del" ? "⌫" : t === "ok" ? "OK" : t}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

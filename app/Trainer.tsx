"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Fact, MAX_N, TABLES, Table, factKey, splitText } from "./facts";

type Tab = "table" | "test";
type TestSet = "17" | "35" | "both";
type Result = { ok: boolean; fact: Fact; given: number } | null;

const BEST_KEY = "best17-35";

export default function Trainer() {
  const [tab, setTab] = useState<Tab>("table");

  useEffect(() => {
    if (window.location.hash === "#test") setTab("test");
  }, []);

  return (
    <div className="wrap">
      <header className="felt">
        <h1>Bảng nhân 17 &amp; 35</h1>
        <p className="sub">
          Học thuộc từ ×1 đến ×20. Xem bảng, che đáp án để tự kiểm tra, rồi vào chế độ test
          bảng 17 hoặc bảng 35.
        </p>
        <div className="payouts">
          <div className="pay">
            <span className="chip c17">17</span>Split · trả 17 ăn 1
          </div>
          <div className="pay">
            <span className="chip c35">35</span>Straight up · trả 35 ăn 1
          </div>
        </div>
      </header>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "table"} onClick={() => setTab("table")}>
          Bảng nhân
        </button>
        <button role="tab" aria-selected={tab === "test"} onClick={() => setTab("test")}>
          Chế độ test
        </button>
      </div>

      {tab === "table" ? <TableView /> : <TestView />}
    </div>
  );
}

/* ---------------- Bảng nhân ---------------- */

function TableView() {
  const [hide, setHide] = useState(false);
  const [shown, setShown] = useState<Set<string>>(new Set());

  const toggle = (k: string) => {
    if (!hide) return;
    setShown((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const setMode = (h: boolean) => {
    setHide(h);
    setShown(new Set());
  };

  return (
    <section className="view">
      <div className="toolbar">
        <div className="seg">
          <button aria-pressed={!hide} onClick={() => setMode(false)}>
            Hiện đáp án
          </button>
          <button aria-pressed={hide} onClick={() => setMode(true)}>
            Che đáp án
          </button>
        </div>
        <p className="hint">Bấm vào kết quả để che hoặc mở từng dòng.</p>
      </div>

      <div className={`tables${hide ? " hidden-ans" : ""}`}>
        {TABLES.map((a) => (
          <div key={a} className={`tbl t${a}`}>
            <h2>
              <span className={`chip c${a}`}>{a}</span>Bảng {a}
              <small>
                {a} × 1 → {a} × {MAX_N}
              </small>
            </h2>
            <ul className="rows">
              {Array.from({ length: MAX_N }, (_, i) => i + 1).map((n) => {
                const k = factKey(a, n);
                return (
                  <li key={k}>
                    <span className="eq">
                      <b>
                        {a} × {n}
                      </b>
                      <span className="split">{splitText(a, n)}</span>
                    </span>
                    <button
                      className={`ans${shown.has(k) ? " shown" : ""}`}
                      aria-label={`${a} nhân ${n}`}
                      onClick={() => toggle(k)}
                    >
                      {a * n}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="tips">
        <h3>Mẹo nhớ nhanh</h3>
        <ul>
          <li>
            <b>17 × n</b> = 10 × n + 7 × n. Ví dụ 17 × 8 = 80 + 56 = 136.
          </li>
          <li>
            <b>17 × n</b> = 20 × n − 3 × n. Ví dụ 17 × 13 = 260 − 39 = 221.
          </li>
          <li>
            <b>35 × n</b> = 30 × n + 5 × n. Ví dụ 35 × 7 = 210 + 35 = 245.
          </li>
          <li>
            <b>35 × số chẵn</b>: chia đôi n rồi nhân 70. Ví dụ 35 × 16 = 8 × 70 = 560.
          </li>
          <li>
            <b>35 × n</b> = 36 × n − n. Ví dụ 35 × 12 = 432 − 12 = 420.
          </li>
        </ul>
      </div>
    </section>
  );
}

/* ---------------- Chế độ test ---------------- */

function readBest(): number {
  try {
    const v = localStorage.getItem(BEST_KEY);
    return v ? Number(JSON.parse(v)) || 0 : 0;
  } catch {
    return 0;
  }
}

function saveBest(v: number) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(v));
  } catch {
    /* bỏ qua nếu trình duyệt chặn lưu */
  }
}

function pickFact(set: TestSet, range: number, misses: Record<string, number>, last: Fact | null): Fact {
  const tables: Table[] = set === "both" ? [17, 35] : [Number(set) as Table];
  const pool: Fact[] = [];
  tables.forEach((a) => {
    for (let n = 1; n <= range; n++) pool.push([a, n]);
  });
  // Phép từng làm sai được hỏi lại thường hơn
  const weighted: Fact[] = [];
  pool.forEach((f) => {
    const w = 1 + (misses[factKey(f[0], f[1])] || 0) * 3;
    for (let i = 0; i < w; i++) weighted.push(f);
  });
  let f: Fact;
  do {
    f = weighted[Math.floor(Math.random() * weighted.length)];
  } while (pool.length > 1 && last && f[0] === last[0] && f[1] === last[1]);
  return f;
}

function TestView() {
  const [set, setSet] = useState<TestSet>("17");
  const [range, setRange] = useState(20);
  const [cur, setCur] = useState<Fact | null>(null);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result>(null);
  const [ok, setOk] = useState(0);
  const [bad, setBad] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [misses, setMisses] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<"" | "flash-ok" | "flash-bad">("");

  const inputRef = useRef<HTMLInputElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);
  const answered = result !== null;

  const next = useCallback(
    (s: TestSet = set, r: number = range, m: Record<string, number> = misses) => {
      setCur((last) => pickFact(s, r, m, last));
      setInput("");
      setResult(null);
      setFlash("");
      requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    },
    [set, range, misses]
  );

  useEffect(() => {
    setBest(readBest());
    next();
    // chỉ chạy một lần khi mở chế độ test
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (answered) goRef.current?.focus({ preventScroll: true });
  }, [answered]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!cur) return;
    if (answered) {
      next();
      return;
    }
    const v = input.trim();
    if (!v) return;
    const [a, n] = cur;
    const right = a * n;
    const k = factKey(a, n);
    const isOk = Number(v) === right;

    if (isOk) {
      setOk((x) => x + 1);
      const s = streak + 1;
      setStreak(s);
      if (s > best) {
        setBest(s);
        saveBest(s);
      }
      if (misses[k]) setMisses({ ...misses, [k]: misses[k] - 1 });
    } else {
      setBad((x) => x + 1);
      setStreak(0);
      setMisses({ ...misses, [k]: (misses[k] || 0) + 1 });
    }
    setResult({ ok: isOk, fact: cur, given: Number(v) });
    setFlash(isOk ? "flash-ok" : "flash-bad");
  };

  const press = (t: string) => {
    if (answered) {
      if (t === "OK") submit();
      return;
    }
    if (t === "Xóa") setInput((v) => v.slice(0, -1));
    else if (t === "OK") submit();
    else setInput((v) => (v.length < 4 ? v + t : v));
  };

  const changeSet = (s: TestSet) => {
    setSet(s);
    next(s, range);
  };
  const changeRange = (r: number) => {
    setRange(r);
    next(set, r);
  };
  const reset = () => {
    setOk(0);
    setBad(0);
    setStreak(0);
    setMisses({});
    next(set, range, {});
  };

  const missList = Object.keys(misses).filter((k) => misses[k] > 0);
  const modeLabel = set === "both" ? "Test nâng cao · bảng 17 hoặc 35" : `Test bảng ${set}`;

  return (
    <section className="view">
      <div className="toolbar">
        <div className="seg">
          <button aria-pressed={set === "17"} onClick={() => changeSet("17")}>
            Test bảng 17
          </button>
          <button aria-pressed={set === "35"} onClick={() => changeSet("35")}>
            Test bảng 35
          </button>
          <button className="adv" aria-pressed={set === "both"} onClick={() => changeSet("both")}>
            ★ Test nâng cao (17 + 35)
          </button>
        </div>
        <div className="seg">
          <button aria-pressed={range === 10} onClick={() => changeRange(10)}>
            ×1–10
          </button>
          <button aria-pressed={range === 20} onClick={() => changeRange(20)}>
            ×1–20
          </button>
        </div>
      </div>

      <div className="stats">
        <Stat label="Đúng" value={ok} />
        <Stat label="Sai" value={bad} />
        <Stat label="Chuỗi đúng" value={streak} />
        <Stat label="Kỷ lục chuỗi" value={best} />
      </div>

      <div className={`card ${flash}`}>
        <div className="mode-label">{modeLabel}</div>
        <div className="q" aria-live="polite">
          <span style={{ color: cur?.[0] === 35 ? "var(--chip35)" : "var(--chip17)" }}>
            {cur ? cur[0] : "–"}
          </span>
          <span className="x">×</span>
          <span>{cur ? cur[1] : "–"}</span>
        </div>

        <form className="answer-row" onSubmit={submit} autoComplete="off">
          <input
            id="answer"
            ref={inputRef}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder="?"
            aria-label="Kết quả"
            value={input}
            readOnly={answered}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
            style={answered ? { borderColor: result.ok ? "var(--ok)" : "var(--bad)" } : undefined}
          />
          <button className="go" type="submit" ref={goRef}>
            {answered ? "Tiếp theo →" : "Trả lời"}
          </button>
        </form>

        <div className={`feedback${result ? (result.ok ? " ok" : " bad") : ""}`} aria-live="polite">
          {result &&
            (result.ok
              ? `Đúng! ${result.fact[0]} × ${result.fact[1]} = ${result.fact[0] * result.fact[1]}`
              : `Chưa đúng. ${result.fact[0]} × ${result.fact[1]} = ${result.fact[0] * result.fact[1]} (${splitText(
                  result.fact[0],
                  result.fact[1]
                )})`)}
        </div>

        <div className="keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Xóa", "0", "OK"].map((t) => (
            <button key={t} type="button" onClick={() => press(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="misses">
        <h3>Các phép cần ôn lại</h3>
        <div className="misslist">
          {missList.length === 0 ? (
            <span className="empty">Chưa có phép nào sai. Tiếp tục nhé!</span>
          ) : (
            missList.map((k) => {
              const [a, n] = k.split("x").map(Number);
              return (
                <span key={k}>
                  {a} × {n} = <b>{a * n}</b>
                </span>
              );
            })
          )}
        </div>
      </div>

      <div>
        <button className="reset" onClick={reset}>
          Làm lại từ đầu
        </button>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

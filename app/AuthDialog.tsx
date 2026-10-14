"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { PASSWORD_MIN, passwordErrors, usernameErrors } from "@/lib/rules";
import { Auth, User, api } from "./Account";

function RuleList({ errors, rules }: { errors: string[]; rules: string[] }) {
  // Hiện quy tắc dưới dạng danh sách; quy tắc nào đang bị vi phạm thì tô đỏ
  return (
    <ul className="rules">
      {rules.map((r) => {
        const bad = errors.includes(r);
        return (
          <li key={r} className={bad ? "bad" : "good"}>
            {bad ? "✗" : "✓"} {r}
          </li>
        );
      })}
    </ul>
  );
}

const NAME_RULES = [
  "Tên phải có ít nhất 1 ký tự.",
  "Tên không được chứa khoảng trắng.",
  "Tên chỉ gồm chữ cái không dấu (a–z, A–Z) và chữ số, không có ký tự đặc biệt.",
];
const PW_RULES = [
  `Mật khẩu phải có ít nhất ${PASSWORD_MIN} ký tự.`,
  "Mật khẩu không được chứa khoảng trắng.",
  "Mật khẩu chỉ gồm chữ cái không dấu và chữ số, không có ký tự đặc biệt.",
];

export default function AuthDialog({ auth }: { auth: Auth }) {
  const mode = auth.dialog;
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode) {
      setError("");
      setTouched(false);
      setPw("");
      setPw2("");
      requestAnimationFrame(() => nameRef.current?.focus());
    }
  }, [mode]);

  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && auth.closeDialog();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, auth]);

  if (!mode) return null;
  const isReg = mode === "register";
  const nameErrs = usernameErrors(name);
  const pwErrs = passwordErrors(pw);
  const mismatch = isReg && pw2 !== pw;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError("");
    if (isReg && (nameErrs.length || pwErrs.length || mismatch)) {
      setError(nameErrs[0] || pwErrs[0] || "Hai mật khẩu chưa khớp nhau.");
      return;
    }
    if (!isReg && (!name || !pw)) {
      setError("Hãy nhập tên và mật khẩu.");
      return;
    }
    setBusy(true);
    try {
      const d = await api<{ user: User }>(isReg ? "/api/auth/register" : "/api/auth/login", {
        username: name,
        password: pw,
      });
      auth.setUser(d.user);
      auth.closeDialog();
      setName("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && auth.closeDialog()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div className="dialog-head">
          <h2 id="auth-title">{isReg ? "Tạo tài khoản" : "Đăng nhập"}</h2>
          <button className="close" aria-label="Đóng" onClick={auth.closeDialog}>
            ×
          </button>
        </div>

        <div className="seg auth-switch">
          <button aria-pressed={!isReg} onClick={() => auth.openDialog("login")} type="button">
            Đăng nhập
          </button>
          <button aria-pressed={isReg} onClick={() => auth.openDialog("register")} type="button">
            Đăng ký
          </button>
        </div>

        <form onSubmit={submit} className="auth-form" noValidate>
          <label htmlFor="auth-name">Tên</label>
          <input
            id="auth-name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={40}
            placeholder="vd: Trung2024"
          />
          {isReg && (name || touched) && <RuleList errors={nameErrs} rules={NAME_RULES} />}

          <label htmlFor="auth-pw">Mật khẩu</label>
          <input
            id="auth-pw"
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete={isReg ? "new-password" : "current-password"}
            autoCapitalize="none"
            maxLength={80}
          />
          {isReg && (pw || touched) && <RuleList errors={pwErrs} rules={PW_RULES} />}

          {isReg && (
            <>
              <label htmlFor="auth-pw2">Nhập lại mật khẩu</label>
              <input
                id="auth-pw2"
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                autoComplete="new-password"
                autoCapitalize="none"
                maxLength={80}
              />
              {pw2 && mismatch && <p className="field-err">Hai mật khẩu chưa khớp nhau.</p>}
            </>
          )}

          {error && (
            <p className="form-err" role="alert">
              {error}
            </p>
          )}

          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Đang xử lý…" : isReg ? "Tạo tài khoản" : "Đăng nhập"}
          </button>
          <p className="fine">
            {isReg
              ? "Không cần email. Hãy nhớ kỹ mật khẩu vì hiện chưa có chức năng lấy lại mật khẩu."
              : "Chưa có tài khoản? Chọn Đăng ký ở trên."}
          </p>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

export type User = { username: string };
export type AuthMode = "login" | "register";

export type Auth = {
  user: User | null;
  loading: boolean;
  dialog: AuthMode | null;
  openDialog: (m?: AuthMode) => void;
  closeDialog: () => void;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
};

export async function api<T>(url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra. Hãy thử lại.");
  return data as T;
}

/** Đọc cookie gợi ý "bn_in" (không bí mật) do máy chủ đặt khi đăng nhập. */
function hintedUser(): User | null {
  try {
    const m = document.cookie.match(/(?:^|; )bn_in=([^;]+)/);
    const name = m ? decodeURIComponent(m[1]) : "";
    return /^[A-Za-z0-9]{1,20}$/.test(name) ? { username: name } : null;
  } catch {
    return null;
  }
}

export function useAuth(): Auth {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<AuthMode | null>(null);

  useEffect(() => {
    const hinted = hintedUser();
    if (!hinted) {
      // Khách chưa đăng nhập: không cần hỏi máy chủ, tiết kiệm một lượt gọi
      setLoading(false);
      return;
    }
    // Hiện tên ngay, rồi xác nhận phiên với máy chủ
    setUser(hinted);
    setLoading(false);
    api<{ user: User | null }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {
        /* mất mạng: giữ trạng thái đã biết */
      });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", {});
    } finally {
      setUser(null);
    }
  }, []);

  return {
    user,
    loading,
    dialog,
    openDialog: (m = "login") => setDialog(m),
    closeDialog: () => setDialog(null),
    setUser,
    logout,
  };
}

export function AccountButton({ auth }: { auth: Auth }) {
  const [menu, setMenu] = useState(false);
  if (auth.loading) return <span className="acct-placeholder" aria-hidden="true" />;
  if (!auth.user)
    return (
      <div className="acct" onPointerDown={() => void import("./AuthDialog")}>
        <button className="acct-btn ghost" onClick={() => auth.openDialog("login")}>
          Đăng nhập
        </button>
        <button className="acct-btn" onClick={() => auth.openDialog("register")}>
          Đăng ký
        </button>
      </div>
    );
  return (
    <div className="acct">
      <button className="acct-user" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
        <span className="avatar">{auth.user.username.slice(0, 1).toUpperCase()}</span>
        <span className="acct-name">{auth.user.username}</span>
      </button>
      {menu && (
        <div className="acct-menu">
          <button
            onClick={async () => {
              setMenu(false);
              await auth.logout();
            }}
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

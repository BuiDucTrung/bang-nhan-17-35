// Quy tắc dùng chung cho trình duyệt và máy chủ

export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;

/** Trả về danh sách lỗi của tên đăng nhập (rỗng nếu hợp lệ). */
export function usernameErrors(name: string): string[] {
  const errs: string[] = [];
  if (name.length < 1) errs.push("Tên phải có ít nhất 1 ký tự.");
  if (/\s/.test(name)) errs.push("Tên không được chứa khoảng trắng.");
  if (/[^A-Za-z0-9\s]/.test(name))
    errs.push("Tên chỉ gồm chữ cái không dấu (a–z, A–Z) và chữ số, không có ký tự đặc biệt.");
  if (name.length > USERNAME_MAX) errs.push(`Tên tối đa ${USERNAME_MAX} ký tự.`);
  return errs;
}

/** Trả về danh sách lỗi của mật khẩu (rỗng nếu hợp lệ). */
export function passwordErrors(pw: string): string[] {
  const errs: string[] = [];
  if (pw.length < PASSWORD_MIN) errs.push(`Mật khẩu phải có ít nhất ${PASSWORD_MIN} ký tự.`);
  if (/\s/.test(pw)) errs.push("Mật khẩu không được chứa khoảng trắng.");
  if (/[^A-Za-z0-9\s]/.test(pw))
    errs.push("Mật khẩu chỉ gồm chữ cái không dấu và chữ số, không có ký tự đặc biệt.");
  if (pw.length > PASSWORD_MAX) errs.push(`Mật khẩu tối đa ${PASSWORD_MAX} ký tự.`);
  return errs;
}

/* ---------- Challenge ---------- */

export const CHALLENGE_SIZE = 10;
export const CHALLENGE_LIMIT_MS = 60_000;
/** Mốc vào bảng Tôn Giả Vinh Diệu, tính bằng giây (dùng cho chữ hiển thị) */
export const CHALLENGE_LIMIT_S = CHALLENGE_LIMIT_MS / 1000;
/** Bỏ ×1, ×10, ×20 vì quá dễ */
export const CHALLENGE_MULTIPLIERS = [2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19];
export const CHALLENGE_TABLES = [17, 35] as const;

/** Số giây với 2 chữ số thập phân, cắt bớt chứ không làm tròn lên (59 999 ms → "59,99"). */
export function secondsText(ms: number): string {
  const cs = Math.floor(Math.max(0, ms) / 10); // phần trăm giây
  return `${Math.floor(cs / 100)},${String(cs % 100).padStart(2, "0")}`;
}

export function formatSeconds(ms: number): string {
  return secondsText(ms) + " giây";
}

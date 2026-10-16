// Lớp lưu trữ dùng chung. Các route chỉ gọi những hàm này, không viết SQL hay truy vấn Mongo trực tiếp,
// nên có thể đổi giữa Postgres và MongoDB bằng biến môi trường mà không sửa logic website.

export type Fact = [number, number];

export type SessionUser = { id: string; username: string };
export type StoredUser = { id: string; username: string; passwordHash: string };
export type LeaderRow = { rank: number; username: string; durationMs: number; achievedAt: string };
export type Standing = { personalBestMs: number | null; rank: number | null };
export type FinishedChallenge = { durationMs: number; finishedAt: Date };

export class DbNotConfigured extends Error {}

export interface Store {
  readonly kind: "postgres" | "mongodb";

  /* Tài khoản */
  /** Tạo tài khoản; trả về null nếu tên (không phân biệt hoa thường) đã có người dùng. */
  createUser(username: string, passwordHash: string): Promise<{ id: string } | null>;
  findUserByName(usernameKey: string): Promise<StoredUser | null>;

  /* Phiên đăng nhập (chỉ lưu mã băm của token) */
  createSession(tokenHash: string, user: SessionUser, days: number): Promise<void>;
  sessionUser(tokenHash: string): Promise<SessionUser | null>;
  deleteSession(tokenHash: string): Promise<void>;

  /* Giới hạn số lần thử */
  /** Tăng bộ đếm của `key` trong cửa sổ `windowSec` giây; trả về số lần đã thử và số phút còn lại của cửa sổ. */
  hitRateLimit(key: string, windowSec: number): Promise<{ count: number; waitMin: number }>;
  clearRateLimit(key: string): Promise<void>;

  /* Challenge — giờ bắt đầu/kết thúc luôn lấy theo đồng hồ của cơ sở dữ liệu */
  /** Huỷ lượt đang dở của người này rồi tạo lượt mới; trả về mã lượt. */
  startChallenge(userId: string, questions: Fact[]): Promise<string>;
  /** Đề của lượt đang mở (chưa nộp, bắt đầu trong vòng 10 phút), hoặc null. */
  openChallenge(id: string, userId: string): Promise<Fact[] | null>;
  /** Chốt giờ nộp; trả về thời gian làm bài, hoặc null nếu lượt đã được nộp. */
  finishChallenge(id: string, userId: string, mistakes: number): Promise<FinishedChallenge | null>;

  /* Bảng Tôn Giả Vinh Diệu */
  /** Ghi thành tích nếu tốt hơn kỷ lục cũ; trả về true nếu là kỷ lục mới. */
  recordBest(userId: string, username: string, durationMs: number, at: Date): Promise<boolean>;
  topRows(limitMs: number, limit: number): Promise<LeaderRow[]>;
  standing(userId: string, limitMs: number): Promise<Standing>;

  /** Dọn dữ liệu hết hạn. */
  housekeeping(): Promise<void>;
}

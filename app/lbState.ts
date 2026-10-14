// Cờ nhỏ dùng chung: sau khi nộp challenge, lần xem bảng kế tiếp bỏ qua bản lưu tạm của CDN
let freshNext = false;
export function markLeaderboardStale() {
  freshNext = true;
}
export function consumeFresh(): boolean {
  const f = freshNext;
  freshNext = false;
  return f;
}

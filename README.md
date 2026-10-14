# Bảng nhân 17 & 35

Website học và luyện bảng nhân 17 và 35, từ ×1 đến ×20. Làm bằng Next.js (App Router).

## Tính năng

- **Bảng nhân**: đủ 17 × 1 → 17 × 20 và 35 × 1 → 35 × 20, kèm cách tách nhẩm. Có nút che đáp án để tự kiểm tra, bấm vào từng kết quả để mở.
- **Chế độ test**
  - *Test bảng 17* / *Test bảng 35*: mỗi lần hiện một phép ngẫu nhiên của bảng đã chọn.
  - *Test nâng cao*: phép ngẫu nhiên của bảng 17 hoặc 35.
  - Trả lời xong, website báo đúng/sai kèm đáp án đúng. Bấm **Tiếp theo** để sang câu mới.
  - Đếm đúng, sai, chuỗi đúng, kỷ lục chuỗi. Phép làm sai được hỏi lại nhiều hơn.

## Chạy trên máy

```bash
npm install
npm run dev
```

Mở http://localhost:3000

## Deploy lên Vercel

1. Đẩy code lên GitHub.
2. Vào https://vercel.com/new, chọn **Import** repository này.
3. Vercel tự nhận Next.js, giữ nguyên cài đặt mặc định và bấm **Deploy**.

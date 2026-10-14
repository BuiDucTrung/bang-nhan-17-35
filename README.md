# Bảng nhân 17 & 35

Website học và luyện bảng nhân 17 và 35, từ ×1 đến ×20. Làm bằng Next.js (App Router).

## Tính năng

- **Bảng nhân**: đủ 17 × 1 → 17 × 20 và 35 × 1 → 35 × 20, kèm cách tách nhẩm. Có nút che đáp án để tự kiểm tra, bấm vào từng kết quả để mở.
- **Chế độ test**
  - *Test bảng 17* / *Test bảng 35*: mỗi lần hiện một phép ngẫu nhiên của bảng đã chọn.
  - *Test nâng cao*: phép ngẫu nhiên của bảng 17 hoặc 35.
  - Trả lời xong, website báo đúng/sai kèm đáp án đúng. Bấm **Tiếp theo** để sang câu mới.
  - Đếm đúng, sai, chuỗi đúng, kỷ lục chuỗi. Phép làm sai được hỏi lại nhiều hơn.

- **Tài khoản**: đăng ký bằng tên và mật khẩu, không cần email.
  - Tên: ít nhất 1 ký tự, tối đa 20, chỉ chữ cái không dấu và chữ số, không khoảng trắng, không trùng người khác (không phân biệt hoa thường).
  - Mật khẩu: ít nhất 6 ký tự, chỉ chữ cái không dấu và chữ số, không khoảng trắng. Mật khẩu được mã hoá bằng scrypt.
- **Challenge**: 10 phép ngẫu nhiên không trùng từ bảng 17 và 35, không có ×1, ×10, ×20. Máy chủ bấm giờ từ lúc phát đề đến lúc nhận bài. Sai thì phải nhập lại.
- **Tôn Giả Vinh Diệu**: bảng xếp hạng những người hoàn thành Challenge trong 16 giây trở xuống, mỗi người tính thời gian tốt nhất.

## Cơ sở dữ liệu

Website cần Postgres, đọc địa chỉ từ biến môi trường `DATABASE_URL` (hoặc `POSTGRES_URL`). Các bảng được tự tạo ở lần chạy đầu.

Trên Vercel: mở project → **Storage** → **Create Database** → chọn **Neon** (Postgres) → **Connect** vào project này. Vercel tự thêm `DATABASE_URL`. Sau đó **Redeploy**.

## Chạy trên máy

```bash
npm install
DATABASE_URL=postgres://user:pass@localhost:5432/bangnhan npm run dev
```

Mở http://localhost:3000

## Deploy lên Vercel

1. Đẩy code lên GitHub.
2. Vào https://vercel.com/new, chọn **Import** repository này.
3. Vercel tự nhận Next.js, giữ nguyên cài đặt mặc định và bấm **Deploy**.

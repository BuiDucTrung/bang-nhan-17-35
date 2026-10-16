# rolexnomistake

Website học và luyện bảng nhân 17 và 35, từ ×1 đến ×20. Làm bằng Next.js (App Router).

## Tính năng

- **Bảng nhân**: đủ 17 × 1 → 17 × 20 và 35 × 1 → 35 × 20, có nút che đáp án để tự kiểm tra, bấm vào từng kết quả để mở.
- **Chế độ test**
  - *Test bảng 17* / *Test bảng 35*: mỗi lần hiện một phép ngẫu nhiên của bảng đã chọn.
  - *Test nâng cao*: phép ngẫu nhiên của bảng 17 hoặc 35.
  - Trả lời xong, website báo đúng/sai kèm đáp án đúng. Bấm **Tiếp theo** để sang câu mới.
  - Đếm đúng, sai, chuỗi đúng, kỷ lục chuỗi. Phép làm sai được hỏi lại nhiều hơn.

- **Tài khoản**: đăng ký bằng tên và mật khẩu, không cần email.
  - Tên: ít nhất 1 ký tự, tối đa 20, chỉ chữ cái không dấu và chữ số, không khoảng trắng, không trùng người khác (không phân biệt hoa thường).
  - Mật khẩu: ít nhất 6 ký tự, chỉ chữ cái không dấu và chữ số, không khoảng trắng. Mật khẩu được mã hoá bằng scrypt.
- **Challenge**: 10 phép ngẫu nhiên không trùng từ bảng 17 và 35, không có ×1, ×10, ×20. Máy chủ bấm giờ từ lúc phát đề đến lúc nhận bài. Sai thì phải nhập lại.
- **Tôn Giả Vinh Diệu**: bảng xếp hạng những người hoàn thành Challenge trong 60 giây trở xuống, mỗi người tính thời gian tốt nhất.

## Cơ sở dữ liệu

Website dùng Postgres (Neon), đọc địa chỉ từ biến môi trường `DATABASE_URL` (hoặc `POSTGRES_URL`). Code truy cập dữ liệu nằm ở `lib/store/`. Các bảng được tự tạo ở lần chạy đầu.

Trên Vercel: mở project → **Storage** → **Create Database** → chọn **Neon** (Postgres) → **Connect** vào project này. Vercel tự thêm `DATABASE_URL`. Sau đó **Redeploy**.

Lịch sử từng lượt chơi chỉ giữ 30 ngày (dọn định kỳ); kỷ lục của mỗi người giữ vĩnh viễn.

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

## Tốc độ và bảo mật

- Chữ thường dùng font hệ thống; chỉ tải một độ đậm của font tiêu đề.
- Challenge, bảng xếp hạng và hộp đăng nhập chỉ tải khi người dùng mở tới.
- Khách chưa đăng nhập không gọi máy chủ khi mở trang. Bảng xếp hạng công khai được CDN lưu 15 giây.
- Header bảo mật (CSP, HSTS, chống nhúng trang, nosniff), chặn yêu cầu từ website khác, giới hạn kích thước dữ liệu gửi lên.
- Khoá tạm 15 phút sau 8 lần sai mật khẩu; giới hạn tạo tài khoản và số lượt challenge.
- Cookie phiên `__Host-`, HttpOnly, Secure, SameSite=Lax; chỉ lưu mã băm của phiên trong cơ sở dữ liệu.

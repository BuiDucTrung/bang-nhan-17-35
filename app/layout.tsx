import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

// Chỉ tải một độ đậm của font tiêu đề. Chữ thường dùng font hệ thống (0 KB, hiển thị tiếng Việt chuẩn).
const display = Bricolage_Grotesque({
  subsets: ["latin", "vietnamese"],
  weight: ["800"],
  variable: "--f-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "rolexnomistake",
  description:
    "Học và luyện bảng nhân 17 và 35 từ ×1 đến ×20, có chế độ test, Challenge và bảng Tôn Giả Vinh Diệu.",
  appleWebApp: { capable: true, title: "rolexnomistake", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  referrer: "strict-origin-when-cross-origin",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1411" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}

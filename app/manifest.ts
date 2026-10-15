import type { MetadataRoute } from "next";

// Cho phép "Thêm vào Màn hình chính" và mở như một ứng dụng, không có thanh địa chỉ
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "rolexnomistake",
    short_name: "rolexnomistake",
    description: "Học và luyện bảng nhân 17 và 35, Challenge và bảng Tôn Giả Vinh Diệu.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f2",
    theme_color: "#0f5a3c",
    lang: "vi",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

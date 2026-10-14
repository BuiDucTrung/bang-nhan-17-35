import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Biểu tượng khi "Thêm vào Màn hình chính" trên iPhone
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0f5a3c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: 66,
            background: "#c2362f",
            border: "8px dashed #ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontSize: 46,
            fontWeight: 800,
          }}
        >
          17·35
        </div>
      </div>
    ),
    size
  );
}

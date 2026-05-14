import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// 攀岩轮盘 PWA icon: solid accent-orange square + bold white "R" wordmark
// (matches the share-card masthead). Pure typography, no font loading needed.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ea580c",
          color: "#fafaf6",
          fontSize: 360,
          fontWeight: 900,
          letterSpacing: -16,
          lineHeight: 1,
        }}
      >
        R
      </div>
    ),
    { ...size },
  );
}

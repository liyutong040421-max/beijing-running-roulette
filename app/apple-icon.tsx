import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home screen icon — same brand mark as the favicon, 180px is iOS standard.
export default function AppleIcon() {
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
          fontSize: 130,
          fontWeight: 900,
          letterSpacing: -6,
          lineHeight: 1,
        }}
      >
        R
      </div>
    ),
    { ...size },
  );
}

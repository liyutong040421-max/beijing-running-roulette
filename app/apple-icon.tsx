import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home-screen icon — 180px is the apple standard. Same vermillion seal +
// bold cream 签 as app/icon.tsx.
export default async function AppleIcon() {
  const fontPath = join(process.cwd(), "public", "fonts", "NotoSansSC-Bold.woff");
  const bold = await readFile(fontPath);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#b22222",
          color: "#fafaf6",
          fontSize: 130,
          fontWeight: 700,
          lineHeight: 1,
          fontFamily: "Noto Sans SC",
        }}
      >
        签
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Noto Sans SC",
          data: bold.buffer.slice(
            bold.byteOffset,
            bold.byteOffset + bold.byteLength,
          ) as ArrayBuffer,
          weight: 700,
          style: "normal",
        },
      ],
    },
  );
}

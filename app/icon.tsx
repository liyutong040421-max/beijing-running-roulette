import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// 岩签 PWA icon — vermillion seal-style square + a single bold cream "签"
// character. Matches the share-card brand seal.
export default async function Icon() {
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
          fontSize: 360,
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

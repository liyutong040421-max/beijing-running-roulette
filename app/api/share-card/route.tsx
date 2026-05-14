import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { climbingGyms, type ClimbingGym } from "@/data/climbing-gyms";
import { getGymSubway, type SubwayInfo } from "@/lib/climbing-subway";
import { getBeijingMap } from "@/lib/beijing-map-server";

export const runtime = "nodejs";

const W = 1080;
const H = 1350;

// Vermillion = the brand red (matches the PWA icon + seal). Paper = warm cream
// background that reads as "fortune-slip paper". Ink = near-black for headings.
const COLOR = {
  paper: "#f6f1e6",
  ink: "#1a1a1a",
  inkSoft: "#3a3a3a",
  muted: "#7a7062",
  hairline: "#c9bfa9",
  vermillion: "#b22222",
} as const;

async function loadFonts(): Promise<
  { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]
> {
  const fontDir = join(process.cwd(), "public", "fonts");
  const [regular, bold] = await Promise.all([
    readFile(join(fontDir, "NotoSansSC-Regular.woff")),
    readFile(join(fontDir, "NotoSansSC-Bold.woff")),
  ]);
  return [
    {
      name: "Noto Sans SC",
      data: regular.buffer.slice(
        regular.byteOffset,
        regular.byteOffset + regular.byteLength,
      ) as ArrayBuffer,
      weight: 400,
      style: "normal",
    },
    {
      name: "Noto Sans SC",
      data: bold.buffer.slice(
        bold.byteOffset,
        bold.byteOffset + bold.byteLength,
      ) as ArrayBuffer,
      weight: 700,
      style: "normal",
    },
  ];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const gymId = url.searchParams.get("gym");
  const gym = climbingGyms.find((g) => g.id === gymId);
  if (!gym) {
    return new Response(`gym not found: ${gymId}`, { status: 404 });
  }

  const date = url.searchParams.get("date") ?? formatDate(new Date());
  const subway = getGymSubway(gym.id);
  const dateObj = parseDateStr(date) ?? new Date();
  const lotNumber = String(dayOfYear(dateObj)).padStart(3, "0");

  let fonts;
  try {
    fonts = await loadFonts();
  } catch (e) {
    return new Response(
      `font load failed: ${(e as Error).message}\n\n` +
        `expected files at public/fonts/NotoSansSC-{Regular,Bold}.woff`,
      { status: 502 },
    );
  }

  // Map for the lower-third visual reference. Small enough that the seal +
  // verdict still dominate.
  const map = await getBeijingMap(840, 460, 24);
  const [px, py] = map.projectPoint(gym.lng, gym.lat);

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: COLOR.paper,
          color: COLOR.ink,
          fontFamily: "Noto Sans SC",
          padding: "40px 60px 36px",
          position: "relative",
        }}
      >
        {/* outer paper-edge hairline frame */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            right: 24,
            bottom: 24,
            border: `1px solid ${COLOR.hairline}`,
            display: "flex",
          }}
        />

        {/* TOP BAR — 岩签 wordmark + lot number + thin double rule */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingBottom: 14,
            borderBottom: `2px solid ${COLOR.ink}`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 8,
              color: COLOR.ink,
            }}
          >
            岩签
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 16,
              color: COLOR.muted,
              letterSpacing: 6,
            }}
          >
            第 {lotNumber} 签
          </div>
        </div>

        {/* VERDICT — 上上签 in vermillion. Always auspicious — it's a magic
            8-ball, the answer should make you smile. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 38,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 14,
              color: COLOR.muted,
              letterSpacing: 8,
              marginBottom: 14,
            }}
          >
            今 晚 之 签
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 132,
              fontWeight: 700,
              color: COLOR.vermillion,
              letterSpacing: 16,
              lineHeight: 1,
            }}
          >
            上上签
          </div>
        </div>

        {/* GYM NAME — the answer. Bigger than anything except the verdict. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 46,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: gym.name.length > 12 ? 56 : 70,
              fontWeight: 700,
              color: COLOR.ink,
              lineHeight: 1.0,
              letterSpacing: -2,
              textAlign: "center",
            }}
          >
            {gym.name}
          </div>
        </div>

        {/* 解 — interpretation: location + subway. Small label, big values. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 38,
            paddingTop: 16,
            paddingBottom: 16,
            borderTop: `1px solid ${COLOR.hairline}`,
            borderBottom: `1px solid ${COLOR.hairline}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 14,
              alignSelf: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                width: 60,
                height: 1,
                background: COLOR.hairline,
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: 16,
                color: COLOR.muted,
                letterSpacing: 8,
                fontWeight: 700,
              }}
            >
              解
            </div>
            <div
              style={{
                display: "flex",
                width: 60,
                height: 1,
                background: COLOR.hairline,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignSelf: "center",
            }}
          >
            <Row label="址" value={`${gym.district} · ${gym.area}`} />
            {subway ? (
              <Row
                label="铁"
                value={`${subway.lines[0] ?? ""} ${subway.station}站  ${formatWalk(subway.walk_m)}`}
              />
            ) : null}
          </div>
        </div>

        {/* MAP — small Beijing outline with a vermillion pin at the gym. */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 12,
          }}
        >
          <svg
            width={840}
            height={460}
            viewBox={`0 0 840 460`}
            style={{ display: "block" }}
          >
            {map.paths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="rgba(26,26,26,0.55)"
                strokeWidth={1.2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            <circle
              cx={px}
              cy={py}
              r={28}
              fill="none"
              stroke={COLOR.vermillion}
              strokeWidth={2.5}
              opacity={0.45}
            />
            <circle cx={px} cy={py} r={11} fill={COLOR.vermillion} />
            <circle cx={px} cy={py} r={3.5} fill={COLOR.paper} />
          </svg>
        </div>

        {/* FOOTER — vermillion seal "岩签" + date */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 14,
          }}
        >
          <Seal />
          <div
            style={{
              display: "flex",
              fontSize: 16,
              color: COLOR.muted,
              letterSpacing: 8,
            }}
          >
            {date.replace(/\./g, "  ·  ")}
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, fonts },
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 18,
        fontSize: 26,
        color: COLOR.ink,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
          background: COLOR.ink,
          color: COLOR.paper,
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Seal() {
  return (
    <div
      style={{
        display: "flex",
        width: 78,
        height: 78,
        alignItems: "center",
        justifyContent: "center",
        background: COLOR.vermillion,
        color: COLOR.paper,
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: 4,
        // a small inner border simulates the inset of a real chop
        boxShadow: `inset 0 0 0 2px ${COLOR.paper}, inset 0 0 0 3px ${COLOR.vermillion}`,
      }}
    >
      岩签
    </div>
  );
}

function formatWalk(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function parseDateStr(s: string): Date | null {
  const m = s.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

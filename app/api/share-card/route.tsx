import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { climbingGyms } from "@/data/climbing-gyms";
import { haversineKm } from "@/lib/geo";
import { pickFirstPhoto } from "@/lib/climbing-photos";
import { loadPhotoManifest } from "@/lib/climbing-photos-server";

export const runtime = "nodejs";

const W = 1080;
const H = 1350;

const TYPE_COLORS: Record<string, string> = {
  抱石: "#ea580c",
  难度: "#16a34a",
  综合: "#0a0a0a",
};

function gymColor(type: string): string {
  if (type.includes("抱石")) return TYPE_COLORS.抱石;
  if (type.includes("难度")) return TYPE_COLORS.难度;
  return TYPE_COLORS.综合;
}

function shortType(type: string): string {
  if (type.includes("抱石")) return "抱石";
  if (type.includes("难度")) return "难度";
  return "综合";
}

type Participant = { label: string; lng: number; lat: number };

function parseParticipants(values: string[]): Participant[] {
  return values
    .map((raw) => {
      const [label, lngS, latS] = raw.split(":");
      const lng = Number(lngS);
      const lat = Number(latS);
      if (!label || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      return { label: decodeURIComponent(label), lng, lat };
    })
    .filter((p): p is Participant => p !== null)
    .slice(0, 4);
}

// Load Noto Sans SC (CJK-capable) from local public/fonts. Files are checked in
// — Next's fetch cache silently drops items >2MB, so CDN fetching is too slow
// for repeated requests. readFile from disk is instant.
async function loadFonts(): Promise<
  { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[]
> {
  const fontDir = join(process.cwd(), "public", "fonts");
  const [regular, bold] = await Promise.all([
    readFile(join(fontDir, "NotoSansSC-Regular.woff")),
    readFile(join(fontDir, "NotoSansSC-Bold.woff")),
  ]);
  return [
    { name: "Noto Sans SC", data: regular.buffer.slice(regular.byteOffset, regular.byteOffset + regular.byteLength) as ArrayBuffer, weight: 400, style: "normal" },
    { name: "Noto Sans SC", data: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength) as ArrayBuffer, weight: 700, style: "normal" },
  ];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const gymId = url.searchParams.get("gym");
  const gym = climbingGyms.find((g) => g.id === gymId);
  if (!gym) {
    return new Response(`gym not found: ${gymId}`, { status: 404 });
  }

  const participants = parseParticipants(url.searchParams.getAll("p"));
  const date = url.searchParams.get("date") ?? formatDate(new Date());

  // Multi-mode stats
  const isParty = participants.length > 0;
  let poolCount = 0;
  let maxKm = 0;
  if (isParty) {
    const scored = climbingGyms.map((g) => ({
      worst: Math.max(
        ...participants.map((p) => haversineKm(p, { lng: g.lng, lat: g.lat })),
      ),
    }));
    scored.sort((a, b) => a.worst - b.worst);
    const minWorst = scored[0]?.worst ?? 0;
    const cutoff = minWorst + 6;
    poolCount = Math.max(5, scored.filter((s) => s.worst <= cutoff).length);
    maxKm = Math.max(
      ...participants.map((p) =>
        haversineKm(p, { lng: gym.lng, lat: gym.lat }),
      ),
    );
  }

  const manifest = await loadPhotoManifest();
  const photo = pickFirstPhoto(gym.id, gym.photos, manifest);
  const photoSrc = photo
    ? new URL(photo.src, request.url).toString()
    : null;

  const color = gymColor(gym.type);
  const type = shortType(gym.type);
  const hook = isParty ? "今晚一起" : "今晚抽到";
  const dateObj = parseDateStr(date) ?? new Date();
  const issueNo = String(dayOfYear(dateObj)).padStart(3, "0");
  const volRoman = toRoman(dateObj.getFullYear());

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

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          background: "#fafaf6",
          fontFamily: "Noto Sans SC",
          color: "#0a0a0a",
        }}
      >
        {/* MASTHEAD */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "32px 56px 18px",
            borderBottom: "2px solid #0a0a0a",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 10,
            }}
          >
            ROULETTE
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 16,
              color: "#52525b",
              letterSpacing: 5,
            }}
          >
            VOL.{volRoman} · NO.{issueNo} · ¥0
          </div>
        </div>

        {/* HERO */}
        <div
          style={{
            position: "relative",
            display: "flex",
            height: 880,
            background: photoSrc ? "#0a0a0a" : color,
            overflow: "hidden",
          }}
        >
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc}
              width={W}
              height={880}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
              alt={photo?.alt ?? gym.name}
            />
          ) : (
            <div
              style={{
                display: "flex",
                width: "100%",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(250,250,246,0.18)",
                fontSize: 320,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: -10,
              }}
            >
              {gym.area.split(/[\/／]/)[0] ?? gym.area}
            </div>
          )}

          {/* gradient — keeps the bottom title legible over busy photos */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0) 32%, rgba(0,0,0,0.78) 100%)",
            }}
          />

          {/* tonight tag */}
          <div
            style={{
              position: "absolute",
              top: 32,
              left: 32,
              display: "flex",
              padding: "8px 16px",
              border: "1.5px solid #fafaf6",
              color: "#fafaf6",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 5,
              background: "rgba(0,0,0,0.22)",
            }}
          >
            {hook}
          </div>

          {/* type chip — solid type color over a photo, white over a flat
              type-color background (otherwise it'd blend in) */}
          <div
            style={{
              position: "absolute",
              top: 32,
              right: 32,
              display: "flex",
              padding: "8px 18px",
              background: photoSrc ? color : "#fafaf6",
              color: photoSrc ? "#fafaf6" : color,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
            }}
          >
            {type}
          </div>

          {/* big gym name — bottom of photo */}
          <div
            style={{
              position: "absolute",
              bottom: 40,
              left: 40,
              right: 40,
              display: "flex",
              flexDirection: "column",
              color: "#fafaf6",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: gym.name.length > 12 ? 64 : 80,
                fontWeight: 700,
                lineHeight: 1.0,
                letterSpacing: -3,
              }}
            >
              {gym.name}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 12,
                fontSize: 22,
                color: "rgba(250,250,246,0.82)",
                letterSpacing: 5,
              }}
            >
              {gym.district} · {gym.area}
            </div>
          </div>
        </div>

        {/* COVERLINES */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding: "32px 56px 28px",
            background: "#fafaf6",
          }}
        >
          {isParty ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#71717a",
                    letterSpacing: 5,
                  }}
                >
                  WITH
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  {participants.map((p) => (
                    <div
                      key={p.label}
                      style={{
                        display: "flex",
                        padding: "5px 14px",
                        border: "1.5px solid #0a0a0a",
                        fontSize: 22,
                        fontWeight: 700,
                      }}
                    >
                      {p.label}
                    </div>
                  ))}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 18,
                  fontSize: 20,
                  color: "#52525b",
                  letterSpacing: 2,
                }}
              >
                公平池 {poolCount} 家  ·  最远 {maxKm.toFixed(1)} km
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 38,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  letterSpacing: -1,
                }}
              >
                今晚就这家
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 12,
                  fontSize: 18,
                  color: "#71717a",
                  letterSpacing: 2,
                }}
              >
                {gym.address}
              </div>
            </div>
          )}

          {/* push footer to the bottom */}
          <div style={{ display: "flex", flex: 1 }} />

          {/* footer */}
          <div
            style={{
              display: "flex",
              marginTop: 20,
              paddingTop: 14,
              borderTop: "2px solid #0a0a0a",
              justifyContent: "space-between",
              alignItems: "flex-end",
              fontSize: 14,
              color: "#52525b",
              letterSpacing: 4,
            }}
          >
            <div style={{ display: "flex" }}>{date}</div>
            <div
              style={{
                display: "flex",
                fontWeight: 700,
                color: "#0a0a0a",
              }}
            >
              BJG · CLIMBING ROULETTE · {dateObj.getFullYear()}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts,
    },
  );
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

function toRoman(n: number): string {
  const map: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let v = n;
  for (const [num, sym] of map) {
    while (v >= num) {
      out += sym;
      v -= num;
    }
  }
  return out;
}

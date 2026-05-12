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
  const hook = isParty ? "今晚一起 →" : "今晚抽到 →";

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
          background: "#fafafa",
          fontFamily: "Noto Sans SC",
          color: "#0a0a0a",
        }}
      >
        {/* TOP — visual zone (~55%) */}
        <div
          style={{
            display: "flex",
            position: "relative",
            height: 745,
            background: photoSrc ? "#0a0a0a" : color,
            overflow: "hidden",
          }}
        >
          {photoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSrc}
              width={W}
              height={745}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
              alt={photo?.alt ?? gym.name}
            />
          ) : (
            // No photo: huge area-name as background art
            <div
              style={{
                display: "flex",
                width: "100%",
                height: "100%",
                alignItems: "flex-end",
                padding: 56,
                color: "#fafafa",
                opacity: 0.16,
                fontSize: 240,
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: -8,
              }}
            >
              {gym.area.split(/[\/／]/)[0] ?? gym.area}
            </div>
          )}

          {/* dice/hook chip top-right */}
          <div
            style={{
              position: "absolute",
              top: 36,
              right: 36,
              display: "flex",
              padding: "8px 14px",
              border: "1.5px solid #fafafa",
              color: "#fafafa",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 4,
              background: "rgba(0,0,0,0.18)",
            }}
          >
            🎲 ROULETTE
          </div>
        </div>

        {/* BOTTOM — info zone */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding: "44px 56px 36px",
            background: "#fafafa",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 28,
              fontWeight: 400,
              color: "#71717a",
              letterSpacing: 2,
            }}
          >
            {hook}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: "#0a0a0a",
            }}
          >
            {gym.name}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 22,
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                padding: "6px 14px",
                background: color,
                color: "#fafafa",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              {type}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 26,
                color: "#52525b",
              }}
            >
              {gym.district} · {gym.area}
            </div>
          </div>

          {isParty ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 32,
                paddingTop: 24,
                borderTop: "1px solid #e4e4e7",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  color: "#71717a",
                  letterSpacing: 2,
                }}
              >
                with
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                {participants.map((p) => (
                  <div
                    key={p.label}
                    style={{
                      display: "flex",
                      padding: "6px 14px",
                      border: "1.5px solid #0a0a0a",
                      fontSize: 24,
                      fontWeight: 700,
                      color: "#0a0a0a",
                    }}
                  >
                    {p.label}
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 14,
                  fontSize: 22,
                  color: "#52525b",
                }}
              >
                公平池 {poolCount} 家 · 最远 {maxKm.toFixed(1)}km
              </div>
            </div>
          ) : null}

          {/* footer */}
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginTop: 24,
              paddingTop: 18,
              borderTop: "1px solid #e4e4e7",
              fontSize: 20,
              color: "#71717a",
              letterSpacing: 1,
            }}
          >
            <div style={{ display: "flex" }}>{date}</div>
            <div style={{ display: "flex" }}>beijing climbing roulette</div>
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

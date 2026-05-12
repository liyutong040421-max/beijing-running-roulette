/**
 * Fetch Beijing subway lines + ring roads from OpenStreetMap (Overpass API)
 * and write them to public/beijing-subway.geo.json and public/beijing-rings.geo.json.
 *
 * Run: pnpm fetch-overlays
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

// Beijing core bbox (south, west, north, east). Tighter than full 北京市 area
// so the query stays under Overpass time/memory budget.
const BJ_BBOX = "39.65,116.05,40.20,116.70";

const SUBWAY_QUERY = `
[out:json][timeout:180];
relation["route"="subway"]["network"~"北京"](${BJ_BBOX});
out body geom;
`;

const RINGS_QUERY = `
[out:json][timeout:180];
(
  relation["route"="road"]["name"~"环"](${BJ_BBOX});
  relation["ref"~"G4501"](${BJ_BBOX});
);
out body geom;
`;

type LonLat = { lat: number; lon: number };
type OverpassMember = {
  type: string;
  ref?: number;
  role?: string;
  geometry?: LonLat[];
};
type OverpassElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  members?: OverpassMember[];
};
type OverpassResponse = { elements?: OverpassElement[] };

type Feature = {
  type: "Feature";
  properties: Record<string, string | number>;
  geometry: { type: "MultiLineString"; coordinates: number[][][] };
};

async function overpassQuery(query: string): Promise<OverpassResponse> {
  let lastErr: unknown = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`  → POST ${endpoint}`);
      const res = await fetch(endpoint, {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "beijing-climbing-roulette/0.1 (one-off data export)",
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}\n${text.slice(0, 240)}`);
      }
      return (await res.json()) as OverpassResponse;
    } catch (e) {
      console.log(`     failed: ${(e as Error).message.split("\n")[0]}`);
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("All Overpass endpoints failed");
}

function relationToFeature(rel: OverpassElement): Feature | null {
  const lines: number[][][] = [];
  for (const m of rel.members ?? []) {
    if (m.type !== "way" || !m.geometry || m.geometry.length < 2) continue;
    const role = m.role ?? "";
    if (role === "stop" || role === "platform" || role.includes("entrance")) continue;
    lines.push(m.geometry.map((p) => [p.lon, p.lat]));
  }
  if (lines.length === 0) return null;
  return {
    type: "Feature",
    properties: {
      id: rel.id,
      name: rel.tags?.name ?? "",
      ref: rel.tags?.ref ?? "",
      colour: rel.tags?.colour ?? "",
    },
    geometry: { type: "MultiLineString", coordinates: lines },
  };
}

// Subway lines often have a separate relation per direction (e.g.
// "10号线: 西局 → 西局（外环）" + "10号线: 西局 → 西局（内环）"). They draw
// the same geometry, so we collapse to one feature per `ref` (line number).
function subwayKey(f: Feature): string {
  const ref = String(f.properties.ref || "");
  if (ref) return `subway-${ref}`;
  // fall back to extracting "X号线" / "X线" / "Xnumberline" from name
  const name = String(f.properties.name || "");
  const m = name.match(/(\d+号线|[一-龥]+线)/);
  return `subway-${m ? m[1] : name}`;
}

function ringKey(f: Feature): string {
  const name = String(f.properties.name || "");
  const m = name.match(/[二三四五六]环/);
  if (m) return `ring-${m[0]}`;
  if (name.includes("绕城高速")) return "ring-六环";
  const ref = String(f.properties.ref || "");
  return `ring-${ref || name}`;
}

// 北京环路：二/三/四/五/六环。七环（首都环线高速 G95）是跨省的城际环线，
// 半径~80km，不属于市内地图，跳过。
function isRingRoad(f: Feature): boolean {
  const name = String(f.properties.name || "");
  if (name.includes("首都环线")) return false;
  if (/[二三四五六]环/.test(name)) return true;
  if (name.includes("绕城高速")) return true;
  return false;
}

function dedupeBy(features: Feature[], keyFn: (f: Feature) => string): Feature[] {
  const seen = new Map<string, Feature>();
  for (const f of features) {
    const key = keyFn(f);
    if (!seen.has(key)) seen.set(key, f);
  }
  return Array.from(seen.values());
}

async function fetchTo(
  label: string,
  query: string,
  outFile: string,
  keyFn: (f: Feature) => string,
  filterFn?: (f: Feature) => boolean,
) {
  console.log(`Fetching ${label}...`);
  const data = await overpassQuery(query);
  const relations = (data.elements ?? []).filter((e) => e.type === "relation");
  console.log(`  raw relations: ${relations.length}`);
  let features = relations
    .map(relationToFeature)
    .filter((f): f is Feature => f !== null);
  if (filterFn) features = features.filter(filterFn);
  features = dedupeBy(features, keyFn);
  const out = { type: "FeatureCollection" as const, features };
  const body = JSON.stringify(out);
  writeFileSync(outFile, body);
  console.log(`  wrote ${outFile}`);
  console.log(`  ${features.length} features (deduped from ${relations.length}), ${(body.length / 1024).toFixed(1)}kb`);
  features.forEach((f) =>
    console.log(`    · ${f.properties.name || f.properties.ref || f.properties.id}`),
  );
}

async function main() {
  await fetchTo(
    "subway",
    SUBWAY_QUERY,
    join(process.cwd(), "public", "beijing-subway.geo.json"),
    subwayKey,
  );
  await fetchTo(
    "ring roads",
    RINGS_QUERY,
    join(process.cwd(), "public", "beijing-rings.geo.json"),
    ringKey,
    isRingRoad,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

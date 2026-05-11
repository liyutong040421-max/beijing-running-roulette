/**
 * Fetch Beijing 16-district boundary GeoJSON from Aliyun DataV CDN
 * (公开免费数据，无需 key) and write to public/beijing.geo.json.
 *
 * Run: pnpm fetch-geo
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const URL =
  "https://geo.datav.aliyun.com/areas_v3/bound/110000_full.json";
const OUT = join(process.cwd(), "public", "beijing.geo.json");

type Feature = {
  type: "Feature";
  properties: { name?: string; adcode?: number };
  geometry: unknown;
};
type FC = { type: "FeatureCollection"; features: Feature[] };

async function main() {
  console.log(`Fetching ${URL} ...`);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const json = (await res.json()) as FC;

  const body = JSON.stringify(json);
  writeFileSync(OUT, body);

  console.log(`Wrote ${OUT}`);
  console.log(`Size: ${(body.length / 1024).toFixed(1)}kb`);
  console.log(`Features: ${json.features.length}`);
  json.features.slice(0, 20).forEach((f) =>
    console.log(`  · ${f.properties?.name ?? "(unnamed)"}`)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

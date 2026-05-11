/**
 * Fetch Beijing core-district boundary GeoJSON from Aliyun DataV CDN
 * (公开免费数据，无需 key) and write to public/beijing.geo.json.
 *
 * Run: pnpm fetch-geo
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const URL =
  "https://geo.datav.aliyun.com/areas_v3/bound/110000_full.json";
const OUT = join(process.cwd(), "public", "beijing.geo.json");
const CORE_ADCODES = new Set([
  110101, // 东城
  110102, // 西城
  110105, // 朝阳
  110106, // 丰台
  110107, // 石景山
  110108, // 海淀
  110112, // 通州
  110115, // 大兴
]);

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

  const coreJson: FC = {
    ...json,
    features: json.features.filter((f) =>
      f.properties.adcode ? CORE_ADCODES.has(f.properties.adcode) : false,
    ),
  };

  const body = JSON.stringify(coreJson);
  writeFileSync(OUT, body);

  console.log(`Wrote ${OUT}`);
  console.log(`Size: ${(body.length / 1024).toFixed(1)}kb`);
  console.log(`Features: ${coreJson.features.length}`);
  coreJson.features.forEach((f) =>
    console.log(`  · ${f.properties?.name ?? "(unnamed)"}`)
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

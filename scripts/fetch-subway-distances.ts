// One-shot: for each climbing gym, query Amap for the nearest subway exit and
// dump { gymId: { walk_m, station, exit, lines[] } } into data/climbing-subway.json.
// Run via `npm run fetch-subway-distances`. Re-run when gyms change.

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { climbingGyms } from "../data/climbing-gyms";

const KEY = process.env.AMAP_WEB_SERVICE_KEY;
if (!KEY) {
  console.error("AMAP_WEB_SERVICE_KEY not set in env");
  process.exit(1);
}

type Poi = {
  name?: string;
  distance?: string;
  address?: string;
};

type SubwayInfo = {
  walk_m: number;
  station: string;
  exit: string;
  lines: string[];
};

const RADIUS = 2500;

async function nearestSubway(lng: number, lat: number): Promise<SubwayInfo | null> {
  const url =
    `https://restapi.amap.com/v3/place/around?key=${KEY}` +
    `&location=${lng},${lat}&types=150500&radius=${RADIUS}` +
    `&sortrule=distance&offset=5&extensions=base`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { pois?: Poi[] };
  const exits = (data.pois ?? []).filter((p) => p.name && p.distance);
  if (exits.length === 0) return null;

  const closest = exits[0];
  const distance = Number(closest.distance);
  if (!Number.isFinite(distance)) return null;

  // "朝阳门地铁站G东南口" → station: "朝阳门", exit: "G东南口"
  const name = closest.name ?? "";
  const exitMatch = name.match(/^(.+?)地铁站(.+?)$/);
  const station = exitMatch?.[1] ?? name.replace(/地铁站.*$/, "");
  const exit = exitMatch?.[2] ?? "";

  // address looks like "6号线" or "1号线;6号线" for transfer stations
  const lines = (closest.address ?? "")
    .split(/[;；,，]/)
    .map((s) => s.trim())
    .filter((s) => /号线|机场线/.test(s));

  return { walk_m: distance, station, exit, lines };
}

async function main() {
  const out: Record<string, SubwayInfo> = {};
  for (const gym of climbingGyms) {
    process.stdout.write(`${gym.name.padEnd(40, " ")} `);
    try {
      const info = await nearestSubway(gym.lng, gym.lat);
      if (info) {
        out[gym.id] = info;
        console.log(
          `→ ${info.station}站 ${info.exit} ${info.walk_m}m (${info.lines.join(", ")})`,
        );
      } else {
        console.log("→ no subway within " + RADIUS + "m");
      }
    } catch (e) {
      console.log(`→ error: ${(e as Error).message}`);
    }
    // be polite to the API
    await new Promise((r) => setTimeout(r, 120));
  }

  const target = join(process.cwd(), "data", "climbing-subway.json");
  await writeFile(target, JSON.stringify(out, null, 2) + "\n", "utf-8");
  console.log(`\nWrote ${Object.keys(out).length} entries to ${target}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

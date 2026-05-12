import { writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { climbingGyms } from "../data/climbing-gyms";

type AmapPoi = {
  id?: string;
  name?: string;
  type?: string;
  typecode?: string;
  address?: string;
  location?: string;
  pname?: string;
  cityname?: string;
  adname?: string;
};

type AmapTextResponse = {
  status: "0" | "1";
  info: string;
  infocode: string;
  count?: string;
  pois?: AmapPoi[];
};

type GymCandidate = {
  id: string;
  sourceName: string;
  area: string;
  queries: string[];
  candidates: Array<{
    name: string;
    address: string;
    district: string;
    location: string;
    type: string;
    score: number;
  }>;
  errors?: string[];
};

const AMAP_TEXT_URL = "https://restapi.amap.com/v3/place/text";
const REQUEST_GAP_MS = 900;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  loadDotEnv();
  const key = process.env.AMAP_WEB_SERVICE_KEY ?? process.env.AMAP_SERVER_KEY;
  if (!key) {
    throw new Error("Missing AMAP_WEB_SERVICE_KEY in .env.local");
  }

  const results: GymCandidate[] = [];

  for (const gym of climbingGyms) {
    const queries = makeQueries(gym.name);
    const seen = new Map<string, GymCandidate["candidates"][number]>();
    const errors: string[] = [];

    for (const query of queries) {
      await sleep(REQUEST_GAP_MS);

      let pois: AmapPoi[] = [];
      try {
        pois = await searchAmap(key, query);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${query}: ${message}`);
        console.warn(`  skipped "${query}" (${message})`);
        continue;
      }

      for (const poi of pois) {
        if (!poi.location || !poi.name) continue;
        const candidate = {
          name: poi.name,
          address: normalizeField(poi.address),
          district: normalizeField(poi.adname),
          location: poi.location,
          type: normalizeField(poi.type),
          score: scoreCandidate(gym.name, poi),
        };
        const existing = seen.get(candidate.location);
        if (!existing || candidate.score > existing.score) {
          seen.set(candidate.location, candidate);
        }
      }
    }

    results.push({
      id: gym.id,
      sourceName: gym.name,
      area: gym.area,
      queries,
      candidates: [...seen.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 6),
      ...(errors.length ? { errors } : {}),
    });

    await writeFile(
      "data/climbing-poi-candidates.json",
      `${JSON.stringify(results, null, 2)}\n`,
    );

    console.log(`${gym.name}: ${results.at(-1)?.candidates.length ?? 0} candidates`);
  }

  await writeFile(
    "data/climbing-poi-candidates.json",
    `${JSON.stringify(results, null, 2)}\n`,
  );

  const exact = results.filter((item) => item.candidates[0]?.score >= 8).length;
  const weak = results.filter((item) => item.candidates.length > 0 && (item.candidates[0]?.score ?? 0) < 8).length;
  const missing = results.filter((item) => item.candidates.length === 0).length;

  console.log(`\nWrote data/climbing-poi-candidates.json`);
  console.log(`Strong matches: ${exact}`);
  console.log(`Weak matches: ${weak}`);
  console.log(`Missing: ${missing}`);
}

async function searchAmap(key: string, keywords: string): Promise<AmapPoi[]> {
  const params = new URLSearchParams({
    key,
    keywords,
    city: "北京",
    citylimit: "true",
    offset: "10",
    page: "1",
    extensions: "base",
    output: "json",
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${AMAP_TEXT_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`AMap HTTP ${response.status} while searching ${keywords}`);
    }

    const data = (await response.json()) as AmapTextResponse;
    if (data.status === "1") return data.pois ?? [];

    if (data.infocode === "10021") {
      const delay = 1600 * (attempt + 1);
      console.warn(`  AMap QPS limit for "${keywords}", retrying in ${delay}ms`);
      await sleep(delay);
      continue;
    }

    throw new Error(`AMap ${data.infocode} ${data.info} while searching ${keywords}`);
  }

  throw new Error(`AMap QPS limit persisted while searching ${keywords}`);
}

function makeQueries(name: string): string[] {
  const simplified = name
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[-－].*$/g, "")
    .trim();
  const parenthetical = name.match(/[（(]([^）)]*)[）)]/)?.[1]?.trim();
  const base = new Set<string>();

  base.add(name);
  if (simplified && simplified !== name) {
    base.add(`${simplified} 攀岩`);
  }
  if (parenthetical) {
    base.add(`${simplified} ${parenthetical} 攀岩`);
  }

  return [...base].filter(Boolean).slice(0, 3);
}

function scoreCandidate(sourceName: string, poi: AmapPoi): number {
  const source = normalizeName(sourceName);
  const name = normalizeName(poi.name ?? "");
  const type = `${poi.type ?? ""}${poi.address ?? ""}`;
  let score = 0;

  if (name === source) score += 10;
  if (source && name.includes(source)) score += 8;
  if (name && source.includes(name)) score += 6;
  if (/攀岩|抱石|岩馆|运动|健身/.test(type)) score += 3;
  if (poi.cityname?.includes("北京")) score += 2;
  if (poi.adname) score += 1;

  return score;
}

function normalizeName(value: string): string {
  return value
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[-－]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizeField(value: unknown): string {
  if (Array.isArray(value)) return value.join(" / ");
  if (typeof value === "string") return value;
  return "";
}

function loadDotEnv() {
  if (!existsSync(".env.local")) return;
  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1);
    process.env[key] ??= value;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

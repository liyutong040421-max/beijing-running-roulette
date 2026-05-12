/**
 * Research candidates for missing / suspicious gyms via AMap text search.
 * READ-ONLY w.r.t. data/climbing-gyms.ts. Writes a candidate report to
 * data/climbing-poi-research.json for human review.
 *
 * Run: pnpm research-gyms
 */

import { writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";

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

type ResearchTarget = {
  key: string;
  name: string;
  source: "missing" | "split" | "rename" | "suspect";
  queries: string[];
  hint?: string;
};

type Candidate = {
  rank: number;
  name: string;
  address: string;
  district: string;
  lng: number;
  lat: number;
  poi_id: string;
  type: string;
  score: number;
};

type ResearchResult = {
  key: string;
  name: string;
  source: ResearchTarget["source"];
  hint?: string;
  queries_run: string[];
  candidates: Candidate[];
  errors?: string[];
};

const AMAP_TEXT_URL = "https://restapi.amap.com/v3/place/text";
const REQUEST_GAP_MS = 900;

// ---------------------------------------------------------------------------
// Targets to research
// ---------------------------------------------------------------------------

const TARGETS: ResearchTarget[] = [
  // -------- Brand-new (image has, data lacks) --------
  { key: "yaoyan", name: "耀岩", source: "missing", queries: ["耀岩攀岩", "耀岩 攀岩馆"], hint: "顺义?" },
  { key: "yueshi", name: "悦石", source: "missing", queries: ["悦石攀岩", "悦石 攀岩馆"] },
  { key: "quye-longhu", name: "趣野（龙湖）", source: "missing", queries: ["趣野攀岩 龙湖", "趣野 龙湖"], hint: "龙湖天街?" },
  { key: "wenshan", name: "问山", source: "missing", queries: ["问山攀岩", "问山攀岩馆"], hint: "可能与现有 向山攀岩 是同一家" },
  { key: "shougang-jixian", name: "首钢极限公园攀岩区", source: "missing", queries: ["首钢极限公园 攀岩", "首钢极限公园攀岩区"], hint: "和 COG 首钢店在同一园区?" },
  { key: "dingshi", name: "鼎石", source: "missing", queries: ["鼎石攀岩", "鼎石攀岩馆"] },
  { key: "aopan-jiaomen", name: "奥攀（角门）", source: "missing", queries: ["奥攀攀岩 角门", "奥攀 角门"] },
  { key: "aopan-wangfujing", name: "奥攀（王府井）", source: "missing", queries: ["奥攀攀岩 王府井", "奥攀 王府井"] },
  { key: "dashou", name: "大手", source: "missing", queries: ["大手攀岩", "大手攀岩馆"] },
  { key: "yanshi-guanzhuang", name: "岩时（管庄）", source: "missing", queries: ["岩时攀岩 管庄", "岩时 管庄"] },
  { key: "jishi", name: "极石", source: "missing", queries: ["极石攀岩", "极石攀岩馆"], hint: "可能与磐石是同一家" },
  { key: "xingyan", name: "星岩", source: "missing", queries: ["星岩攀岩", "星岩攀岩馆"] },
  { key: "heibao", name: "黑爆", source: "missing", queries: ["黑爆攀岩", "黑爆"] },
  { key: "wanyan", name: "顽岩", source: "missing", queries: ["顽岩攀岩", "顽岩攀岩馆"], hint: "难度馆" },
  { key: "qupanyan", name: "趣攀岩", source: "missing", queries: ["趣攀岩", "趣攀岩 攀岩馆"], hint: "难度馆" },
  { key: "xianfeng", name: "先锋 / 先攀", source: "missing", queries: ["先锋攀岩", "先攀攀岩", "先锋攀岩馆"] },

  // -------- Splits / renames --------
  { key: "camp4-jiangtai", name: "Camp4（将台）", source: "split", queries: ["CAMP4 攀岩 将台", "Camp4 将台", "岩肆 将台"], hint: "现有 camp4 (白家庄) 实际可能就是这家或三里屯店" },
  { key: "camp4-sanlitun", name: "Camp4（三里屯）", source: "split", queries: ["CAMP4 攀岩 三里屯", "岩肆 三里屯"], hint: "白家庄商圈即三里屯外围，需比对" },
  { key: "qingshan-weigongcun", name: "青山（魏公村）", source: "split", queries: ["青山攀岩 魏公村", "青山攀石 魏公村"], hint: "现有 qingshan-panshi 是清河店" },

  // -------- 9 suspicious / "我有但图里没有" --------
  { key: "dayu", name: "大宇", source: "suspect", queries: ["大宇攀岩", "大宇攀岩馆"] },
  { key: "bairimeng", name: "白日梦", source: "suspect", queries: ["白日梦攀岩", "白日梦"] },
  { key: "heitang", name: "黑塘", source: "suspect", queries: ["黑塘攀岩", "黑塘攀岩馆"] },
  { key: "shuangyan", name: "双岩", source: "suspect", queries: ["双岩攀岩", "双岩攀岩馆"] },
  { key: "aopan-lifang", name: "奥攀（立方村）", source: "suspect", queries: ["奥攀攀岩 立方村", "奥攀 立方村"] },
  { key: "yuepanyan", name: "越攀岩", source: "suspect", queries: ["越攀岩", "越攀岩 攀岩馆"] },
  { key: "cishan", name: "此山（米家堡）", source: "suspect", queries: ["此山攀岩 米家堡", "此山攀岩"] },
  { key: "panshi-fangshan", name: "磐石（房山）", source: "suspect", queries: ["磐石攀岩 房山", "磐石 房山"] },
];

// ---------------------------------------------------------------------------

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

async function main() {
  loadDotEnv();
  const key = process.env.AMAP_WEB_SERVICE_KEY ?? process.env.AMAP_SERVER_KEY;
  if (!key) throw new Error("Missing AMAP_WEB_SERVICE_KEY in .env.local");

  const results: ResearchResult[] = [];

  for (const target of TARGETS) {
    console.log(`[${target.source}] ${target.name}`);
    const seen = new Map<string, Candidate>();
    const errors: string[] = [];

    for (const query of target.queries) {
      await sleep(REQUEST_GAP_MS);
      let pois: AmapPoi[] = [];
      try {
        pois = await searchAmap(key, query);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${query}: ${msg}`);
        console.warn(`    skipped "${query}": ${msg}`);
        continue;
      }

      for (const poi of pois) {
        if (!poi.location || !poi.name || !poi.id) continue;
        const [lngStr, latStr] = poi.location.split(",");
        const lng = Number(lngStr);
        const lat = Number(latStr);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        const candidate: Candidate = {
          rank: 0,
          name: poi.name,
          address: normalize(poi.address),
          district: normalize(poi.adname),
          lng,
          lat,
          poi_id: poi.id,
          type: normalize(poi.type),
          score: scoreCandidate(target.name, poi),
        };
        const existing = seen.get(candidate.poi_id);
        if (!existing || candidate.score > existing.score) {
          seen.set(candidate.poi_id, candidate);
        }
      }
    }

    const candidates = [...seen.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((c, i) => ({ ...c, rank: i + 1 }));

    results.push({
      key: target.key,
      name: target.name,
      source: target.source,
      hint: target.hint,
      queries_run: target.queries,
      candidates,
      ...(errors.length ? { errors } : {}),
    });

    console.log(`    ${candidates.length} candidates (top score ${candidates[0]?.score ?? 0})`);

    await writeFile(
      "data/climbing-poi-research.json",
      JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2) + "\n",
    );
  }

  await writeFile(
    "data/climbing-poi-research.json",
    JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2) + "\n",
  );

  console.log("\nReport: data/climbing-poi-research.json");
  const strong = results.filter((r) => (r.candidates[0]?.score ?? 0) >= 8).length;
  const weak = results.filter((r) => r.candidates.length > 0 && (r.candidates[0]?.score ?? 0) < 8).length;
  const empty = results.filter((r) => r.candidates.length === 0).length;
  console.log(`  Strong: ${strong}   Weak: ${weak}   Empty: ${empty}`);
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
      console.warn(`    AMap QPS, retrying in ${delay}ms`);
      await sleep(delay);
      continue;
    }
    throw new Error(`AMap ${data.infocode} ${data.info} while searching ${keywords}`);
  }
  throw new Error(`AMap QPS persisted while searching ${keywords}`);
}

function scoreCandidate(sourceName: string, poi: AmapPoi): number {
  const source = normalizeName(sourceName);
  const name = normalizeName(poi.name ?? "");
  const blob = `${poi.type ?? ""}${poi.address ?? ""}`;
  let score = 0;
  if (name === source) score += 10;
  if (source && name.includes(source)) score += 8;
  if (name && source.length > 1 && source.includes(name)) score += 6;
  if (/攀岩|抱石|岩馆|岩壁|攀登/.test(blob) || /攀岩|抱石/.test(name)) score += 3;
  if (poi.cityname?.includes("北京") || poi.pname?.includes("北京")) score += 2;
  if (poi.adname) score += 1;
  return score;
}

function normalizeName(value: string): string {
  return value
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[-－\s]/g, "")
    .toLowerCase();
}

function normalize(value: unknown): string {
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
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const k = trimmed.slice(0, i);
    const v = trimmed.slice(i + 1);
    process.env[k] ??= v;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

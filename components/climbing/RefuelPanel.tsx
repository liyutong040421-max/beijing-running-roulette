"use client";

import { useEffect, useState } from "react";
import type { ClimbingGym } from "@/data/climbing-gyms";
import { dianpingCuisineUrl } from "@/lib/dianping";

type NearbyPoi = {
  id?: string;
  name?: string;
  address?: string;
  distance?: string;
  type?: string;
  location?: string;
  biz_ext?: { rating?: string; cost?: string; open_time?: string };
};

type ApiResponse = { pois?: NearbyPoi[] } | { error: string };

const CUISINES: { label: string; keyword: string }[] = [
  { label: "拉面", keyword: "拉面" },
  { label: "烧烤", keyword: "烧烤" },
  { label: "火锅", keyword: "火锅" },
  { label: "日料", keyword: "日料" },
  { label: "便利店", keyword: "便利店" },
  { label: "咖啡", keyword: "咖啡" },
];

export function RefuelPanel({ gym }: { gym: ClimbingGym | null }) {
  const [nearby, setNearby] = useState<NearbyPoi[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gym) {
      setNearby(null);
      setError(null);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setNearby(null);

    // extensions=all gives us biz_ext.rating (大众点评 rating) so we can rank
    // by quality rather than just distance. offset=20 = pull a bigger pool to
    // filter from, since cafeterias/shops get rejected before ranking.
    const params = new URLSearchParams({
      location: `${gym.lng},${gym.lat}`,
      keywords: "美食",
      radius: "1500",
      offset: "20",
      extensions: "all",
    });
    fetch(`/api/amap/poi?${params}`, { signal: ac.signal })
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((data) => {
        if ("error" in data) {
          setError(data.error);
          setNearby([]);
          return;
        }
        const eligible = (data.pois ?? []).filter(
          (p) => p.name && p.location && isGoodFood(p),
        );
        const ranked = rankFood(eligible).slice(0, 5);
        setNearby(ranked);
      })
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message);
        setNearby([]);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    return () => ac.abort();
  }, [gym]);

  if (!gym) return null;

  const picks = gym.food_picks ?? [];
  const localityArea = gym.area || gym.district;

  return (
    <section className="border-t border-hairline bg-bg px-5 py-5 lg:px-7 lg:py-6">
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.28em]">REFUEL · 爬完补碳</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          {localityArea} · 1.5km
        </div>
      </div>

      {picks.length > 0 ? (
        <div className="mt-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            私房推荐
          </div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {picks.map((pick, i) => {
              const href =
                pick.dianping_url ??
                `https://www.dianping.com/search/keyword/2/0_${encodeURIComponent(pick.name)}`;
              return (
                <li key={`${pick.name}-${i}`}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block border border-hairline bg-bg px-3 py-2 transition-colors hover:border-fg"
                  >
                    <div className="text-sm font-semibold text-fg">{pick.name}</div>
                    {pick.note ? (
                      <div className="mt-0.5 text-xs leading-5 text-muted line-clamp-2">{pick.note}</div>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="mt-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          按菜系
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CUISINES.map((c) => (
            <a
              key={c.label}
              href={dianpingCuisineUrl(c.keyword, localityArea)}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-hairline bg-bg px-2.5 py-1 text-xs text-fg transition-colors hover:border-fg hover:bg-fg hover:text-bg"
            >
              {c.label}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            高德 · 周边好评
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {loading ? "loading..." : error ? "error" : nearby ? `${nearby.length} 家` : ""}
          </div>
        </div>
        <ul className="mt-2 divide-y divide-hairline border-y border-hairline">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-1 py-2">
                  <div className="h-3 w-40 animate-pulse bg-hairline" />
                  <div className="h-3 w-12 animate-pulse bg-hairline" />
                </li>
              ))
            : nearby && nearby.length > 0
              ? nearby.map((poi) => {
                  const dist = formatDistance(poi.distance);
                  const rating = poi.biz_ext?.rating;
                  const cost = poi.biz_ext?.cost;
                  const hasId = Boolean(poi.id);
                  const href = hasId
                    ? `https://www.amap.com/place/${poi.id}`
                    : `https://www.amap.com/search?query=${encodeURIComponent(poi.name ?? "")}&center=${gym.lng},${gym.lat}`;
                  return (
                    <li key={poi.id || `${poi.name}-${poi.location}`}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center justify-between gap-3 px-1 py-2 transition-colors hover:bg-hairline/40"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm text-fg group-hover:text-accent">{poi.name}</span>
                            {rating && Number(rating) > 0 ? (
                              <span className="shrink-0 font-mono text-[11px] text-accent">
                                ★ {Number(rating).toFixed(1)}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] leading-4 text-muted">
                            <span className="font-mono uppercase tracking-[0.14em]">{compactType(poi.type)}</span>
                            {cost && Number(cost) > 0 ? (
                              <span className="font-mono">¥{Math.round(Number(cost))}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-[11px] text-fg">{dist}</div>
                        </div>
                      </a>
                    </li>
                  );
                })
              : (
                <li className="px-1 py-2 text-xs text-muted">
                  {error ? `周边搜索失败: ${error}` : "周边 1.5km 内没有评分够高的好店"}
                </li>
              )}
        </ul>
      </div>
    </section>
  );
}

function formatDistance(value: string | undefined): string {
  const meters = Number(value);
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function compactType(value: string | undefined): string {
  if (!value) return "";
  const parts = value.split(/[;；]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return "";
  const leaf = parts[parts.length - 1];
  if (leaf && leaf !== "餐饮服务" && leaf !== "餐饮相关") return leaf;
  return parts[parts.length - 2] ?? leaf;
}

// Hard exclusions: cafeterias, supermarkets, shops, vending. Only allows real
// 餐饮 POIs that you'd actually want to eat at after climbing.
function isGoodFood(poi: NearbyPoi): boolean {
  const t = poi.type ?? "";
  const name = poi.name ?? "";

  // Must be in 餐饮 top-level category
  if (!/餐饮/.test(t)) return false;

  // Cafeterias / canteens — explicitly excluded by user
  if (/食堂|学生餐厅|职工餐厅|单位餐厅|公司餐厅/.test(t)) return false;
  if (/食堂|学生餐厅|职工餐厅/.test(name)) return false;

  // Convenience stores / supermarkets / shops — already covered by chips
  if (/便利店|超市|食品店|食品商店|烟酒|粮油|副食|商店|商超|批发|菜市|水果/.test(t)) return false;
  if (/便利店|7-?Eleven|罗森|全家|超市|商店/i.test(name)) return false;

  // 餐饮相关场所 catch-all is too generic (kiosks, snack carts) — drop unless
  // the leaf category is actually a restaurant type
  const leaf = t.split(/[;；]/).pop()?.trim() ?? "";
  if (leaf === "餐饮相关场所" || leaf === "餐饮相关") return false;

  return true;
}

// Rank by 大众点评 rating (descending), with distance as tiebreaker. Restaurants
// without a rating drop to the bottom but stay in the pool — better than
// nothing if the area is sparse.
function rankFood(pois: NearbyPoi[]): NearbyPoi[] {
  return [...pois].sort((a, b) => {
    const ra = Number(a.biz_ext?.rating ?? 0);
    const rb = Number(b.biz_ext?.rating ?? 0);
    if (rb !== ra) return rb - ra;
    const da = Number(a.distance ?? Infinity);
    const db = Number(b.distance ?? Infinity);
    return da - db;
  });
}

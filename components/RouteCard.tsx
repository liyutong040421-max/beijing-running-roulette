"use client";

import type { Route } from "@/lib/types";
import { amapWalkUrl } from "@/lib/amap-uri";

type Props = {
  route: Route;
  onFinishedRun: () => void;
};

export function RouteCard({ route, onFinishedRun }: Props) {
  const navUrl = amapWalkUrl({
    lng: route.start[0],
    lat: route.start[1],
    name: route.name,
  });

  return (
    <div className="w-full max-w-md mx-auto rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-2xl font-bold">{route.name}</h2>
        <div className="text-sm text-zinc-500 shrink-0">{route.district}</div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="font-mono text-lg font-semibold text-orange-600 dark:text-orange-400">
          {route.distance_km} km
        </span>
        <span className="text-zinc-400">·</span>
        <span className="text-zinc-600 dark:text-zinc-400">
          {route.surface.map(surfaceLabel).join(" · ")}
        </span>
      </div>

      <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{route.blurb}</p>

      <div className="flex flex-wrap gap-2 pt-1">
        {route.scenery_tags.map((tag) => (
          <span
            key={tag}
            className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-3">
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center rounded-full bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 px-5 py-3 font-medium hover:opacity-90 transition-opacity"
        >
          🧭 用高德导航去起点
        </a>
        <button
          type="button"
          onClick={onFinishedRun}
          className="flex-1 rounded-full border border-orange-400 text-orange-600 dark:text-orange-400 px-5 py-3 font-medium hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
        >
          🍜 我跑完了
        </button>
      </div>
    </div>
  );
}

function surfaceLabel(s: Route["surface"][number]): string {
  switch (s) {
    case "paved": return "硬化路";
    case "plastic": return "塑胶";
    case "trail": return "土路";
    case "mixed": return "混合";
  }
}

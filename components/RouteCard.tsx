"use client";

import type { Route } from "@/lib/types";
import { amapWalkUrl } from "@/lib/amap-uri";

type Props = {
  route: Route;
  showSheet: boolean;
  onFinishedRun: () => void;
  onClose: () => void;
};

export function RouteCard({ route, showSheet, onFinishedRun, onClose }: Props) {
  const navUrl = amapWalkUrl({
    lng: route.start[0],
    lat: route.start[1],
    name: route.name,
  });

  return (
    <div
      key={route.id}
      className="
        absolute z-20
        left-0 right-0 bottom-0
        lg:left-8 lg:bottom-8 lg:right-auto lg:max-w-md
        bg-bg/92 backdrop-blur
        border-t border-hairline lg:border lg:border-hairline
        px-6 pt-6 pb-7 lg:px-8 lg:py-8
        animate-slide-up
      "
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted mb-2">
            today&apos;s run · {route.district}
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight leading-[1.1] text-fg">
            {route.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="text-muted hover:text-fg text-2xl leading-none -mr-1 -mt-1 px-2 py-1"
        >
          ×
        </button>
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        <span className="font-mono text-2xl font-semibold text-fg">
          {route.distance_km.toFixed(1)}
        </span>
        <span className="text-xs uppercase tracking-widest text-muted">km</span>
        <span className="text-hairline">|</span>
        <span className="text-xs uppercase tracking-widest text-muted">
          {route.surface.map(surfaceLabel).join(" · ")}
        </span>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-fg/80">{route.blurb}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {route.scenery_tags.map((tag) => (
          <span
            key={tag}
            className="text-[11px] px-2 py-0.5 border border-hairline text-muted"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-7 pt-5 border-t border-hairline flex flex-wrap gap-x-7 gap-y-3 text-sm">
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-1.5 text-fg hover:text-accent transition-colors"
        >
          <span className="text-muted group-hover:text-accent transition-colors">→</span>
          <span className="underline underline-offset-4 decoration-1 decoration-hairline group-hover:decoration-accent">
            用高德导航去起点
          </span>
        </a>
        <button
          type="button"
          onClick={onFinishedRun}
          className="group flex items-center gap-1.5 text-fg hover:text-accent transition-colors"
        >
          <span className="text-muted group-hover:text-accent transition-colors">→</span>
          <span className="underline underline-offset-4 decoration-1 decoration-hairline group-hover:decoration-accent">
            我跑完了
          </span>
        </button>
      </div>

      {showSheet && (
        <div className="mt-6 pt-5 border-t border-hairline">
          <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-muted mb-2">
            nearby eats
          </div>
          <p className="text-xs text-muted">
            等接上 高德 POI 之后这里会列出 {route.name} 附近的餐厅，一键跳大众点评。
          </p>
        </div>
      )}
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

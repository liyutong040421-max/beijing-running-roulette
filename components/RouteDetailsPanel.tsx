"use client";

import type { Route } from "@/lib/types";
import { amapWalkUrl } from "@/lib/amap-uri";
import { dianpingWebUrl } from "@/lib/dianping";

type Props = {
  route: Route | null;
};

export function RouteDetailsPanel({ route }: Props) {
  if (!route) {
    return (
      <section className="border-t border-hairline bg-bg px-5 py-5 lg:min-h-[220px] lg:px-7 lg:py-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted">
          SPIN TO DISCOVER A ROUTE
        </div>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
          60 条北京跑步路线，短线、中线、LSD、越野和夜跑混在一起，抽到哪条就研究哪条。
        </p>
      </section>
    );
  }

  const navUrl = amapWalkUrl({
    lng: route.start[0],
    lat: route.start[1],
    name: route.name,
  });
  const foodQuery = route.food_hint
    ? `${route.food_hint} 美食`
    : `${route.district} ${route.name} 附近 美食`;
  const foodUrl = dianpingWebUrl(foodQuery);
  const detailRows: { label: string; value: string }[] = [];

  if (route.route_line) {
    detailRows.push({ label: "路线", value: route.route_line });
  }
  if (route.road_condition) {
    detailRows.push({ label: "路况", value: route.road_condition });
  }
  if (route.night_run) {
    detailRows.push({ label: "夜跑", value: route.night_run });
  }
  if (route.food_hint) {
    detailRows.push({ label: "跑后", value: route.food_hint });
  }
  if (route.access_note) {
    detailRows.push({ label: "提示", value: route.access_note });
  }

  return (
    <section className="animate-slide-up border-t border-hairline bg-bg px-5 py-5 lg:min-h-[220px] lg:px-7 lg:py-6">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
            #{route.route_index ?? "--"} · {route.section ?? "today's run"} · {route.district}
          </div>
          <h2 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-fg lg:text-4xl">
            {route.name}
          </h2>

          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <span className="font-mono text-2xl font-semibold text-fg">
              {route.distance_label ?? route.distance_km.toFixed(1)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
              {route.distance_label ? "" : "km"}
            </span>
            <span className="text-hairline">|</span>
            <span className="text-xs text-muted">
              {route.surface.map(surfaceLabel).join(" · ")}
            </span>
          </div>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-fg/75">
            {route.blurb}
          </p>

          {(route.runner_feeling || route.runner_tip) ? (
            <div className="mt-4 grid gap-3 text-xs leading-5 text-fg/75 lg:grid-cols-2">
              {route.runner_feeling ? (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                    跑友感受
                  </div>
                  <p className="mt-1">{route.runner_feeling}</p>
                </div>
              ) : null}
              {route.runner_tip ? (
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                    心得
                  </div>
                  <p className="mt-1">{route.runner_tip}</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {detailRows.length > 0 ? (
            <dl className="mt-4 grid gap-2 text-xs leading-5 text-fg/70 lg:grid-cols-2">
              {detailRows.map((row) => (
                <div key={row.label} className="min-w-0">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                    {row.label}
                  </dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 lg:max-w-80 lg:justify-end">
          {route.scenery_tags.map((tag) => (
            <span
              key={tag}
              className="border border-hairline px-2 py-1 text-[11px] text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3 border-t border-hairline pt-4 text-sm">
        <a
          href={navUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 text-fg transition-colors hover:text-accent"
        >
          <span className="text-muted transition-colors group-hover:text-accent">→</span>
          <span className="underline decoration-hairline decoration-1 underline-offset-4 group-hover:decoration-accent">
            高德去起点
          </span>
        </a>
        <a
          href={foodUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center gap-1.5 text-fg transition-colors hover:text-accent"
        >
          <span className="text-muted transition-colors group-hover:text-accent">→</span>
          <span className="underline decoration-hairline decoration-1 underline-offset-4 group-hover:decoration-accent">
            跑完找吃的
          </span>
        </a>
      </div>
    </section>
  );
}

function surfaceLabel(s: Route["surface"][number]): string {
  switch (s) {
    case "paved":
      return "硬化路";
    case "plastic":
      return "塑胶";
    case "trail":
      return "土路";
    case "mixed":
      return "混合";
  }
}

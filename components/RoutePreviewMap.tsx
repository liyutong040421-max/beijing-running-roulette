"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "@/lib/types";

type Props = {
  route: Route | null;
};

export function RoutePreviewMap({ route }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const highlights = useMemo(() => (route ? makeMapHighlights(route) : []), [route]);

  useEffect(() => {
    setImageFailed(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [route?.id]);

  if (!route) {
    return (
      <div className="grid h-full min-h-[260px] place-items-center bg-bg text-center">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
            route map
          </div>
          <p className="mt-2 max-w-60 text-xs leading-5 text-muted">
            抽中路线后，这里会显示真实路线图。
          </p>
        </div>
      </div>
    );
  }

  if (!route.map_image) {
    return (
      <div className="grid h-full min-h-[260px] place-items-center bg-bg px-6 text-center">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
            map pending
          </div>
          <p className="mt-2 max-w-72 text-xs leading-5 text-muted">
            这条路线还没有接入真实路线图。为了避免误导，这里不会用示意轨迹代替。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="relative h-full min-h-[350px] overflow-hidden bg-[#e7e4dc] lg:min-h-[260px]"
      onWheel={(event) => {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.18 : 0.18;
        setZoom((value) => Math.min(4, Math.max(0.55, value + delta)));
      }}
      onPointerMove={(event) => {
        if (!dragStart) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setPan({
          x: dragStart.panX + event.clientX - dragStart.x,
          y: dragStart.panY + event.clientY - dragStart.y,
        });
      }}
      onPointerUp={() => setDragStart(null)}
      onPointerCancel={() => setDragStart(null)}
    >
      {imageFailed ? (
        <div className="absolute inset-0 grid place-items-center bg-bg px-6 text-center">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              route image failed
            </div>
            <p className="mt-2 max-w-64 text-xs leading-5 text-muted">
              真实路线图加载失败了。可能是文件名或图片路径没有对应上。
            </p>
          </div>
        </div>
      ) : (
        <>
          <img
            key={route.id}
            src={route.map_image.src}
            alt={route.map_image.alt}
            draggable={false}
            onError={() => setImageFailed(true)}
            onPointerDown={(event) => {
              setDragStart({
                x: event.clientX,
                y: event.clientY,
                panX: pan.x,
                panY: pan.y,
              });
            }}
            className="absolute left-1/2 top-1/2 h-full w-full max-w-none select-none object-contain"
            style={{
              cursor: dragStart ? "grabbing" : "grab",
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
              transformOrigin: "center",
              transition: dragStart ? "none" : "transform 180ms ease",
            }}
          />
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(250,250,250,0.05),rgba(250,250,250,0)_30%,rgba(250,250,250,0)_70%,rgba(250,250,250,0.55))]" />
        </>
      )}

      <div className="absolute left-4 right-4 top-4 z-20 flex items-start justify-between gap-3">
        <div className="min-w-0 bg-bg/92 px-3 py-2 shadow-sm backdrop-blur">
          <div className="truncate text-sm font-bold text-fg">{route.name}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {route.distance_label ?? `${route.distance_km.toFixed(1)} km`} · {route.district}
          </div>
        </div>
        <div className="bg-bg/92 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted shadow-sm backdrop-blur">
          REAL ROUTE
        </div>
      </div>

      <div className="absolute bottom-4 right-4 z-30 flex flex-col border border-hairline bg-bg/92 shadow-sm backdrop-blur">
        <button type="button" className="h-8 w-8 border-b border-hairline text-lg leading-none" onClick={() => setZoom((value) => Math.min(4, value + 0.25))} aria-label="放大">
          +
        </button>
        <button type="button" className="h-8 w-8 border-b border-hairline text-lg leading-none" onClick={() => setZoom((value) => Math.max(0.55, value - 0.25))} aria-label="缩小">
          -
        </button>
        <button type="button" className="h-8 w-8 border-b border-hairline text-[11px] font-bold uppercase" onClick={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }} aria-label="重置">
          1×
        </button>
        <button type="button" className="h-8 w-8 text-[11px] font-bold uppercase" onClick={() => {
          const panel = panelRef.current;
          if (!panel) return;
          if (document.fullscreenElement === panel) void document.exitFullscreen();
          else void panel.requestFullscreen();
        }} aria-label="全屏">
          ⛶
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 hidden border-t border-hairline bg-bg/94 p-4 pr-16 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur sm:block">
        <div className="grid gap-3 md:grid-cols-3">
          {highlights.slice(0, 3).map((item, index) => (
            <div key={item.title} className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                {item.label}
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-fg">{item.title}</div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">{item.note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RoutePhotoBoard({ route }: { route: Route }) {
  const photos = route.photos ?? [];
  const mainPhoto = photos[0];
  const secondPhoto = photos[1] ?? photos[0];
  const highlights = makePhotoHighlights(route);

  return (
    <div className="relative grid h-full min-h-[260px] grid-rows-[minmax(0,1fr)_112px] overflow-hidden bg-[#111] text-white">
      <div className="relative min-h-0 overflow-hidden">
        <img
          src={mainPhoto.src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 select-none object-cover blur-xl"
          draggable={false}
        />
        <div className="absolute inset-0 bg-black/28" />
        <img
          src={mainPhoto.src}
          alt={mainPhoto.alt}
          className="relative z-[1] h-full w-full select-none object-contain"
          draggable={false}
        />
        <div className="absolute inset-0 z-[2] bg-[linear-gradient(to_bottom,rgba(0,0,0,0.10),rgba(0,0,0,0.03)_38%,rgba(0,0,0,0.62))]" />

        <div className="absolute left-4 top-4 z-10 bg-black/56 px-3 py-2 shadow-sm backdrop-blur">
          <div className="truncate text-sm font-bold">{route.name}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/72">
            {route.distance_label ?? `${route.distance_km.toFixed(1)} km`} · {route.district}
          </div>
        </div>

        <div className="absolute bottom-4 right-4 z-10">
          {secondPhoto ? (
            <img
              src={secondPhoto.src}
              alt={secondPhoto.alt}
              className="hidden aspect-[4/3] h-24 w-28 object-cover shadow-[0_8px_28px_rgba(0,0,0,0.35)] md:block"
              draggable={false}
            />
          ) : null}
        </div>
      </div>

      <div className="grid border-t border-white/20 bg-bg text-fg md:grid-cols-3">
        {highlights.slice(0, 3).map((item, index) => (
          <div
            key={`${item.title}-${index}`}
            className="min-w-0 border-b border-hairline px-4 py-3 md:border-b-0 md:border-r last:md:border-r-0"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {item.label}
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-fg">{item.title}</div>
            <p className="mt-1 truncate text-xs leading-5 text-muted">{item.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function makePhotoHighlights(route: Route) {
  return makeRouteFacts(route);
}

function makeMapHighlights(route: Route) {
  return makeRouteFacts(route);
}

function makeRouteFacts(route: Route) {
  const road = firstPhrase(route.road_condition ?? route.surface.map(surfaceLabel).join(" · "));

  return [
    {
      label: "scene",
      title: compactLabel(route.blurb || route.scenery_tags[0] || "路线看点", 10),
      note: compactLabel(route.scenery_tags.slice(0, 2).join(" / ") || route.district, 14),
    },
    {
      label: "road",
      title: compactLabel(road, 10),
      note: compactLabel(route.audience ?? "按状态调整", 14),
    },
    {
      label: "after",
      title: compactLabel(route.food_hint ?? "跑后觅食", 10),
      note: compactLabel(route.night_run ?? route.district, 14),
    },
  ];
}

function compactLabel(value: string, maxLength: number): string {
  const normalized = value.replace(/[。！？；，、]/g, " ").replace(/\s+/g, " ").trim();
  const chars = Array.from(normalized);
  return chars.length > maxLength ? chars.slice(0, maxLength).join("") : normalized;
}

function firstPhrase(value: string): string {
  return value.split(/[，、+]/)[0]?.trim() || value;
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

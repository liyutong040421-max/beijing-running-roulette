"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "@/lib/types";

type PhotoStatus = "keep" | "review" | "reject";

type PhotoItem = {
  key: string;
  src: string;
  alt: string;
  routeId: string;
  routeIndex: number;
  routeName: string;
  district: string;
  distance: string;
  mapSrc?: string;
};

type Props = {
  routes: Route[];
};

const STORAGE_KEY = "beijing-running-photo-review-v1";

const statusLabels: Record<PhotoStatus, string> = {
  keep: "保留",
  review: "待定",
  reject: "删除候选",
};

const statusStyles: Record<PhotoStatus, string> = {
  keep: "border-emerald-600 bg-emerald-50 text-emerald-900",
  review: "border-hairline bg-bg text-fg",
  reject: "border-red-600 bg-red-50 text-red-900",
};

export function PhotoReviewBoard({ routes }: Props) {
  const [statuses, setStatuses] = useState<Record<string, PhotoStatus>>({});
  const [filter, setFilter] = useState<PhotoStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const photos = useMemo(() => {
    return routes.flatMap((route) => {
      const routeIndex = route.route_index ?? Number(route.id.replace("route-", ""));
      return (route.photos ?? []).map((photo, index) => ({
        key: photo.src,
        src: photo.src,
        alt: photo.alt,
        routeId: route.id,
        routeIndex,
        routeName: route.name,
        district: route.district,
        distance: route.distance_label ?? `${route.distance_km}km`,
        mapSrc: route.map_image?.src,
        photoIndex: index + 1,
      }));
    });
  }, [routes]);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Record<string, PhotoStatus>;
      setStatuses(parsed);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  }, [statuses]);

  const counts = useMemo(() => {
    return photos.reduce(
      (acc, photo) => {
        const status = statuses[photo.key] ?? "review";
        acc[status] += 1;
        return acc;
      },
      { keep: 0, review: 0, reject: 0 } satisfies Record<PhotoStatus, number>,
    );
  }, [photos, statuses]);

  const visiblePhotos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return photos.filter((photo) => {
      const status = statuses[photo.key] ?? "review";
      if (filter !== "all" && status !== filter) return false;
      if (!normalizedQuery) return true;
      const haystack = `${photo.routeIndex} ${photo.routeName} ${photo.district} ${photo.src}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [filter, photos, query, statuses]);

  const setStatus = (key: string, status: PhotoStatus) => {
    setStatuses((current) => ({ ...current, [key]: status }));
  };

  const exportReview = async () => {
    const payload = photos.reduce(
      (acc, photo) => {
        const status = statuses[photo.key] ?? "review";
        acc[status].push({
          src: photo.src,
          route: `${String(photo.routeIndex).padStart(2, "0")} ${photo.routeName}`,
        });
        return acc;
      },
      { keep: [], review: [], reject: [] } as Record<PhotoStatus, { src: string; route: string }[]>,
    );

    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-hairline bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <a href="/" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted hover:text-fg">
              Back to roulette
            </a>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">照片审核</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
              标记哪些照片适合放进路线页。这里只记录审核状态，不会删除你电脑里的原始图片。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SummaryPill label="全部" value={photos.length} active={filter === "all"} onClick={() => setFilter("all")} />
            <SummaryPill label="保留" value={counts.keep} active={filter === "keep"} onClick={() => setFilter("keep")} />
            <SummaryPill label="待定" value={counts.review} active={filter === "review"} onClick={() => setFilter("review")} />
            <SummaryPill label="删除候选" value={counts.reject} active={filter === "reject"} onClick={() => setFilter("reject")} />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] gap-5 px-5 py-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit border border-hairline bg-[#f7f7f3] p-4 lg:sticky lg:top-[112px]">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="路线名 / 区域 / 编号"
              className="mt-2 h-10 w-full border border-hairline bg-bg px-3 text-sm outline-none focus:border-fg"
            />
          </label>

          <div className="mt-5 border-t border-hairline pt-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Workflow</div>
            <p className="mt-2 text-sm leading-6 text-muted">
              先把明显人像、截图水印重、和路线无关的图标成删除候选；真正有地标、跑道、河道、公园氛围的图标成保留。
            </p>
          </div>

          <button
            type="button"
            onClick={exportReview}
            className="mt-5 h-10 w-full bg-fg px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-bg hover:opacity-85"
          >
            {copied ? "Copied" : "Copy Review JSON"}
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm("清空这个浏览器里的照片审核状态？图片文件不会被删除。")) {
                setStatuses({});
              }
            }}
            className="mt-2 h-10 w-full border border-hairline bg-bg px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-fg hover:bg-[#f1f1ee]"
          >
            Reset Marks
          </button>
        </aside>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              showing {visiblePhotos.length} / {photos.length}
            </div>
            <div className="text-xs text-muted">点击图片下方按钮标记状态</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visiblePhotos.map((photo) => (
              <PhotoCard
                key={photo.key}
                photo={photo}
                status={statuses[photo.key] ?? "review"}
                onStatusChange={(status) => setStatus(photo.key, status)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-2 text-left transition ${
        active ? "border-fg bg-fg text-bg" : "border-hairline bg-bg text-fg hover:border-fg"
      }`}
    >
      <span className="block font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">{label}</span>
      <span className="mt-1 block text-lg font-bold leading-none">{value}</span>
    </button>
  );
}

function PhotoCard({
  photo,
  status,
  onStatusChange,
}: {
  photo: PhotoItem;
  status: PhotoStatus;
  onStatusChange: (status: PhotoStatus) => void;
}) {
  return (
    <article className={`overflow-hidden border ${statusStyles[status]}`}>
      <div className="grid grid-cols-[96px_minmax(0,1fr)] border-b border-current/20 bg-bg text-fg">
        <div className="border-r border-hairline bg-[#ecebe5]">
          {photo.mapSrc ? (
            <img src={photo.mapSrc} alt="" className="h-24 w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-24 place-items-center font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              no map
            </div>
          )}
        </div>
        <div className="min-w-0 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {String(photo.routeIndex).padStart(2, "0")} · {photo.distance} · {photo.district}
          </div>
          <h2 className="mt-1 truncate text-base font-bold text-fg">{photo.routeName}</h2>
          <div className="mt-2 truncate font-mono text-[10px] text-muted">{photo.src.replace("/running-photos/", "")}</div>
        </div>
      </div>

      <a href={photo.src} target="_blank" rel="noreferrer" className="block bg-[#111]">
        <img src={photo.src} alt={photo.alt} className="aspect-[4/3] w-full object-cover" loading="lazy" />
      </a>

      <div className="grid grid-cols-3 border-t border-current/20 bg-bg text-fg">
        {(["keep", "review", "reject"] as PhotoStatus[]).map((nextStatus) => (
          <button
            key={nextStatus}
            type="button"
            onClick={() => onStatusChange(nextStatus)}
            className={`h-10 border-r border-hairline text-xs font-semibold last:border-r-0 ${
              status === nextStatus ? "bg-fg text-bg" : "hover:bg-[#f1f1ee]"
            }`}
          >
            {statusLabels[nextStatus]}
          </button>
        ))}
      </div>
    </article>
  );
}

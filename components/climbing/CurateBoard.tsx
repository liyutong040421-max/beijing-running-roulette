"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClimbingGym } from "@/data/climbing-gyms";
import type { PhotoManifest } from "@/lib/climbing-photos";

type Props = {
  gyms: ClimbingGym[];
  initialManifest: PhotoManifest;
};

type FilterMode = "all" | "missing" | "done";

export function CurateBoard({ gyms, initialManifest }: Props) {
  const [manifest, setManifest] = useState<PhotoManifest>(initialManifest);
  const [filter, setFilter] = useState<FilterMode>("missing");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  const sortedGyms = useMemo(
    () =>
      [...gyms].sort((a, b) => {
        const ad = a.district.localeCompare(b.district, "zh-CN");
        if (ad !== 0) return ad;
        return a.name.localeCompare(b.name, "zh-CN");
      }),
    [gyms],
  );

  const filtered = useMemo(() => {
    return sortedGyms.filter((g) => {
      const has = (manifest[g.id]?.length ?? 0) > 0;
      if (filter === "missing") return !has;
      if (filter === "done") return has;
      return true;
    });
  }, [sortedGyms, filter, manifest]);

  const doneCount = useMemo(
    () => sortedGyms.filter((g) => (manifest[g.id]?.length ?? 0) > 0).length,
    [sortedGyms, manifest],
  );

  // Auto-pick first item in current filter when active becomes invalid
  useEffect(() => {
    if (activeId && filtered.some((g) => g.id === activeId)) return;
    setActiveId(filtered[0]?.id ?? null);
  }, [filtered, activeId]);

  const activeGym = useMemo(
    () => sortedGyms.find((g) => g.id === activeId) ?? null,
    [sortedGyms, activeId],
  );

  const advanceToNext = useCallback(() => {
    if (filter !== "missing") return;
    // After upload the gym leaves the missing list; useEffect picks the new top.
    // No explicit action needed — but blur the body so next paste targets it.
    if (typeof document !== "undefined") {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  }, [filter]);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2200);
  };

  const upload = useCallback(
    async (gymId: string, file: File) => {
      if (busy) return;
      setBusy(true);
      try {
        const form = new FormData();
        form.append("gymId", gymId);
        form.append("file", file);
        const res = await fetch("/api/climbing-photos", { method: "POST", body: form });
        const data = (await res.json()) as
          | { src: string; name: string; gymId: string; n: number }
          | { error: string };
        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : `HTTP ${res.status}`);
        }
        setManifest((prev) => ({
          ...prev,
          [gymId]: [...(prev[gymId] ?? []), data.src].sort(),
        }));
        showFlash(`✓ ${data.name}`);
        advanceToNext();
      } catch (e) {
        showFlash(`× ${(e as Error).message}`);
      } finally {
        setBusy(false);
      }
    },
    [busy, advanceToNext],
  );

  const remove = useCallback(async (gymId: string, src: string) => {
    const filename = src.split("/").pop() ?? "";
    if (!confirm(`删除 ${filename}?`)) return;
    try {
      const res = await fetch(
        `/api/climbing-photos?file=${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setManifest((prev) => ({
        ...prev,
        [gymId]: (prev[gymId] ?? []).filter((s) => s !== src),
      }));
      showFlash(`× 已删除 ${filename}`);
    } catch (e) {
      showFlash(`× 删除失败: ${(e as Error).message}`);
    }
  }, []);

  // Global paste handler — Cmd+V anywhere uploads to the active gym.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!activeGym) return;
      const items = e.clipboardData?.items ?? [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== "file") continue;
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        e.preventDefault();
        upload(activeGym.id, file);
        return;
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [activeGym, upload]);

  // Drop handler on the big drop zone
  useEffect(() => {
    const el = dropRef.current;
    if (!el || !activeGym) return;
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      el.classList.add("ring-2", "ring-accent");
    };
    const onDragLeave = () => el.classList.remove("ring-2", "ring-accent");
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      el.classList.remove("ring-2", "ring-accent");
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showFlash("× 只接受图片");
        return;
      }
      upload(activeGym.id, file);
    };
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, [activeGym, upload]);

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-30 grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-hairline bg-bg/95 px-6 py-3 backdrop-blur">
        <div className="font-mono text-[11px] uppercase tracking-[0.24em]">
          Curate · {doneCount}/{sortedGyms.length} 已配图
        </div>
        <div className="flex gap-1 font-mono text-[10px] uppercase tracking-[0.16em]">
          {(["missing", "all", "done"] as FilterMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              className={`border px-2 py-1 transition-colors ${
                filter === m
                  ? "border-fg bg-fg text-bg"
                  : "border-hairline hover:border-fg"
              }`}
            >
              {m === "missing" ? "缺图" : m === "done" ? "已有" : "全部"}
            </button>
          ))}
        </div>
        <a
          href="/climbing"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted underline decoration-hairline decoration-1 underline-offset-4 hover:text-accent hover:decoration-accent"
        >
          → 回轮盘
        </a>
      </header>

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Sidebar: gym list */}
        <aside className="border-b border-hairline bg-bg lg:max-h-[calc(100dvh-49px)] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <ul className="divide-y divide-hairline">
            {filtered.map((g) => {
              const has = (manifest[g.id]?.length ?? 0) > 0;
              const active = g.id === activeId;
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(g.id)}
                    className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors ${
                      active ? "bg-fg text-bg" : "hover:bg-hairline/40"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{g.name}</span>
                    <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${active ? "text-bg/70" : "text-muted"}`}>
                      {has ? `${manifest[g.id]?.length}` : "·"}
                    </span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-muted">
                {filter === "missing" ? "全部配齐了 🎉" : "无"}
              </li>
            ) : null}
          </ul>
        </aside>

        {/* Active gym focus pane */}
        <section className="lg:max-h-[calc(100dvh-49px)] lg:overflow-y-auto">
          {activeGym ? (
            <ActiveGymPane
              gym={activeGym}
              photos={manifest[activeGym.id] ?? []}
              onRemove={(src) => remove(activeGym.id, src)}
              dropRef={dropRef}
              busy={busy}
            />
          ) : (
            <div className="grid h-full min-h-[60vh] place-items-center text-sm text-muted">
              没有要配图的家了 🎉
            </div>
          )}
        </section>
      </div>

      {flash ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 -translate-x-1/2 border border-fg bg-fg px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-bg shadow-md">
          {flash}
        </div>
      ) : null}
    </main>
  );
}

function ActiveGymPane({
  gym,
  photos,
  onRemove,
  dropRef,
  busy,
}: {
  gym: ClimbingGym;
  photos: string[];
  onRemove: (src: string) => void;
  dropRef: React.RefObject<HTMLDivElement | null>;
  busy: boolean;
}) {
  const dianpingUrl = `https://www.dianping.com/search/keyword/2/0_${encodeURIComponent(gym.name)}`;
  const xhsUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(gym.name + " 攀岩")}`;
  const amapUrl = gym.amap_url;

  return (
    <div className="px-6 py-6 lg:px-10 lg:py-8">
      <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
        {gym.district} · {gym.area} · {shortType(gym.type)}
      </div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight lg:text-5xl">{gym.name}</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">{gym.address}</p>

      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <SearchLink href={dianpingUrl} label="↗ 大众点评" />
        <SearchLink href={xhsUrl} label="↗ 小红书" />
        <SearchLink href={amapUrl} label="↗ 高德" />
      </div>

      <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        粘贴 (Cmd+V) / 拖入图片 → 自动保存为{" "}
        <span className="text-fg">{gym.id}-{photos.length + 1}.&lt;ext&gt;</span>
      </div>

      <div
        ref={dropRef}
        className={`mt-3 grid min-h-[260px] place-items-center border-2 border-dashed border-hairline bg-[#f7f7f3] text-center transition-all ${
          busy ? "opacity-50" : ""
        }`}
      >
        <div className="px-6">
          <div className="font-mono text-[12px] uppercase tracking-[0.22em] text-muted">
            {busy ? "uploading..." : "drop image here · or paste anywhere"}
          </div>
          <div className="mt-2 text-[11px] text-muted">
            支持 .webp / .jpg / .png · 最大 12MB
          </div>
        </div>
      </div>

      {photos.length > 0 ? (
        <div className="mt-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            已有 {photos.length} 张
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((src) => (
              <li key={src} className="group relative overflow-hidden border border-hairline bg-[#f7f7f3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={src} className="aspect-[3/2] w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemove(src)}
                  className="absolute right-1 top-1 border border-fg bg-fg/90 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-bg opacity-0 transition-opacity group-hover:opacity-100"
                >
                  delete
                </button>
                <div className="absolute bottom-0 left-0 right-0 truncate bg-fg/85 px-2 py-1 font-mono text-[10px] tracking-[0.06em] text-bg">
                  {src.split("/").pop()}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SearchLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="border border-hairline bg-bg px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.14em] text-fg transition-colors hover:border-fg hover:bg-fg hover:text-bg"
    >
      {label}
    </a>
  );
}

function shortType(type: string): string {
  if (type.includes("抱石")) return "抱石";
  if (type.includes("难度")) return "难度";
  return "综合";
}

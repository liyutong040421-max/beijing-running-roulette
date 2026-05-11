"use client";

import { useEffect, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import { BeijingMap } from "./BeijingMap";
import { routes, pickRandomRoute } from "@/lib/routes";
import type { Route } from "@/lib/types";

type DistrictProps = { name?: string; adcode?: number };
type GeoData = FeatureCollection<Geometry, DistrictProps>;

type Props = {
  onPick: (route: Route) => void;
  selectedId: string | null;
};

const TOTAL_SPIN_MS = 1800;

export function MapRoulette({ onPick, selectedId }: Props) {
  const [geojson, setGeojson] = useState<GeoData | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/beijing.geo.json")
      .then((r) => r.json() as Promise<GeoData>)
      .then(setGeojson);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const spin = () => {
    if (spinning) return;

    const target = pickRandomRoute(selectedId ?? undefined);

    if (reduceMotion) {
      setHighlightedId(target.id);
      onPick(target);
      return;
    }

    setSpinning(true);
    let currentHi: string | null = null;
    const start = Date.now();

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / TOTAL_SPIN_MS, 1);

      if (progress >= 1) {
        currentHi = target.id;
        setHighlightedId(target.id);
        setSpinning(false);
        onPick(target);
        return;
      }

      const candidates = routes.filter((r) => r.id !== currentHi);
      const next = candidates[Math.floor(Math.random() * candidates.length)];
      currentHi = next.id;
      setHighlightedId(next.id);

      const delay = 70 + Math.pow(progress, 2.5) * 200; // 70ms → 270ms
      timerRef.current = setTimeout(tick, delay);
    };

    tick();
  };

  return (
    <div className="absolute inset-0">
      {geojson ? (
        <BeijingMap
          geojson={geojson}
          highlightedId={highlightedId}
          selectedId={selectedId}
          onMarkerClick={(r) => {
            if (spinning) return;
            setHighlightedId(r.id);
            onPick(r);
          }}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-xs uppercase tracking-widest text-muted">
          loading map…
        </div>
      )}

      <button
        type="button"
        onClick={spin}
        disabled={spinning || !geojson}
        className="
          absolute z-30
          left-1/2 -translate-x-1/2 bottom-6
          lg:left-auto lg:translate-x-0 lg:right-8 lg:top-8 lg:bottom-auto
          px-7 py-3
          text-xs uppercase tracking-[0.25em]
          border border-fg text-fg bg-bg/80 backdrop-blur
          hover:bg-fg hover:text-bg
          transition-colors duration-200
          disabled:opacity-30 disabled:cursor-not-allowed
        "
      >
        {spinning ? "···" : selectedId ? "再来一条" : "抽"}
      </button>
    </div>
  );
}

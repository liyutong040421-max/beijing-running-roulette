"use client";

import { useState } from "react";
import { MapRoulette } from "@/components/MapRoulette";
import { RouteCard } from "@/components/RouteCard";
import type { Route } from "@/lib/types";

export default function Home() {
  const [picked, setPicked] = useState<Route | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  return (
    <div className="fixed inset-0 flex flex-col bg-bg text-fg overflow-hidden">
      <header className="absolute top-0 left-0 right-0 z-10 px-6 py-5 pointer-events-none">
        <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted">
          Beijing · Running Roulette
        </div>
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted/60 mt-0.5">
          25 routes · 1 wheel · go
        </div>
      </header>

      <main className="flex-1 relative">
        <MapRoulette
          onPick={(r) => {
            setPicked(r);
            setShowSheet(false);
          }}
          selectedId={picked?.id ?? null}
        />
      </main>

      {picked && (
        <RouteCard
          route={picked}
          showSheet={showSheet}
          onFinishedRun={() => setShowSheet(true)}
          onClose={() => {
            setPicked(null);
            setShowSheet(false);
          }}
        />
      )}
    </div>
  );
}

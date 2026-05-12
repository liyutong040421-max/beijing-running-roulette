"use client";

import { MapRoulette } from "@/components/MapRoulette";

export default function Home() {
  return (
    <main className="min-h-dvh overflow-y-auto bg-bg text-fg lg:fixed lg:inset-0 lg:min-h-0 lg:overflow-hidden">
      <MapRoulette />
    </main>
  );
}

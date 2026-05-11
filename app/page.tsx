"use client";

import { useState } from "react";
import { Roulette } from "@/components/Roulette";
import { RouteCard } from "@/components/RouteCard";
import type { Route } from "@/lib/types";

export default function Home() {
  const [picked, setPicked] = useState<Route | null>(null);
  const [showSheet, setShowSheet] = useState(false);

  return (
    <div className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
      <header className="px-6 py-6 sm:py-10 text-center">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
          北京跑步轮盘 🏃
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          抽一条路线 · 跑完顺路觅食
        </p>
      </header>

      <main className="flex-1 px-4 pb-24 space-y-6">
        <Roulette
          onPick={(r) => {
            setPicked(r);
            setShowSheet(false);
          }}
          excludeId={picked?.id}
        />

        {picked && (
          <RouteCard
            route={picked}
            onFinishedRun={() => setShowSheet(true)}
          />
        )}

        {showSheet && picked && (
          <div className="w-full max-w-md mx-auto rounded-3xl border border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20 p-6 text-sm text-zinc-700 dark:text-zinc-300">
            <div className="font-semibold text-orange-700 dark:text-orange-400 mb-2">
              附近觅食 (即将上线)
            </div>
            等接上 高德 POI 之后，这里会列出 {picked.name} 终点 800m 内的餐厅，
            一键跳大众点评看评价。
          </div>
        )}
      </main>

      <footer className="px-6 py-6 text-center text-xs text-zinc-400">
        由 高德地图 + 大众点评 deeplink 驱动 · 跑完别忘记拉伸
      </footer>
    </div>
  );
}

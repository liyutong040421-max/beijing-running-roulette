"use client";

import { useEffect, useRef, useState } from "react";
import { routes, pickRandomRoute } from "@/lib/routes";
import type { Route } from "@/lib/types";

type Props = {
  onPick: (route: Route) => void;
  excludeId?: string;
};

export function Roulette({ onPick, excludeId }: Props) {
  const [spinning, setSpinning] = useState(false);
  const [displayName, setDisplayName] = useState<string>("点这里抽今天的路线");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);

    const target = pickRandomRoute(excludeId);
    const totalDurationMs = 1500;
    const start = Date.now();
    let nextDelay = 40;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / totalDurationMs, 1);

      // ease out: delay grows from 40ms -> 220ms over the duration
      nextDelay = 40 + Math.pow(progress, 2.5) * 180;

      if (progress >= 1) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayName(target.name);
        setSpinning(false);
        onPick(target);
        return;
      }

      const random = routes[Math.floor(Math.random() * routes.length)];
      setDisplayName(random.name);

      intervalRef.current = setTimeout(tick, nextDelay) as unknown as ReturnType<
        typeof setInterval
      >;
    };

    tick();
  };

  return (
    <button
      type="button"
      onClick={spin}
      disabled={spinning}
      className="
        group relative w-full max-w-md mx-auto
        rounded-3xl border border-zinc-200 dark:border-zinc-800
        bg-gradient-to-br from-orange-50 to-amber-50 dark:from-zinc-900 dark:to-zinc-950
        px-6 py-12 text-center shadow-sm hover:shadow-md
        transition-all active:scale-[0.98]
        disabled:cursor-not-allowed
      "
    >
      <div className="text-xs uppercase tracking-widest text-orange-500 mb-4">
        🎲 today&apos;s run
      </div>
      <div
        className={`
          text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-50
          tabular-nums transition-opacity
          ${spinning ? "opacity-90" : "opacity-100"}
        `}
      >
        {displayName}
      </div>
      <div className="text-sm text-zinc-500 mt-4">
        {spinning ? "抽签中…" : "点击抽一条北京路线"}
      </div>
    </button>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import { BeijingMap } from "./BeijingMap";
import {
  CurvedRouteWheel,
  ROUTE_WHEEL_ANGLE_STEP,
  centerAngleForRoute,
} from "./CurvedRouteWheel";
import { RouteDetailsPanel } from "./RouteDetailsPanel";
import { RoutePreviewMap } from "./RoutePreviewMap";
import { pickRandomRoute, routes } from "@/lib/routes";
import type { Route } from "@/lib/types";

type DistrictProps = { name?: string; adcode?: number };
type GeoData = FeatureCollection<Geometry, DistrictProps>;

const TOTAL_SPIN_MS = 1800;
const WHEEL_SPIN_MS = 260;

export function MapRoulette() {
  const [geojson, setGeojson] = useState<GeoData | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [hoveredRoute, setHoveredRoute] = useState<Route | null>(null);
  const [spinAngle, setSpinAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frameRef = useRef<number | null>(null);
  const spinAngleRef = useRef(0);

  const orderedRoutes = useMemo(() => {
    return [...routes].sort((a, b) => {
      const indexDelta = (a.route_index ?? 999) - (b.route_index ?? 999);
      if (indexDelta !== 0) return indexDelta;
      return a.name.localeCompare(b.name, "zh-CN");
    });
  }, []);

  useEffect(() => {
    fetch("/beijing.geo.json")
      .then((r) => r.json() as Promise<GeoData>)
      .then(setGeojson);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const focusRoute = (
    route: Route,
    options: { fullSpin?: boolean; durationMs?: number } = {},
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const fullSpin = options.fullSpin ?? false;
    const durationMs = options.durationMs ?? (fullSpin ? TOTAL_SPIN_MS : 0);
    const targetAngle = centerAngleForRoute(orderedRoutes, route.id);

    const currentAngle = spinAngleRef.current;
    const currentMod = mod(currentAngle, 360);
    const targetMod = mod(targetAngle, 360);

    const delta = fullSpin
      ? 360 * 5 + mod(targetMod - currentMod, 360)
      : shortestDelta(currentMod, targetMod);
    const startAngle = currentAngle;
    const animatedAngle = currentAngle + delta;

    if (reduceMotion || durationMs <= 0) {
      const finalRoute = routeAtAngle(orderedRoutes, targetAngle) ?? route;
      spinAngleRef.current = targetAngle;
      setSpinAngle(targetAngle);
      setSelectedRoute(finalRoute);
      setHoveredRoute(null);
      setSpinning(false);
      return;
    }

    const startTime = performance.now();

    setSpinning(fullSpin);
    setHoveredRoute(null);

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      const eased = easeOutCubic(progress);
      const angle = startAngle + (animatedAngle - startAngle) * eased;
      spinAngleRef.current = angle;
      setSpinAngle(angle);

      const liveRoute = routeAtAngle(orderedRoutes, angle);
      setHoveredRoute(liveRoute);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
        return;
      }

      const finalRoute = routeAtAngle(orderedRoutes, targetAngle) ?? route;
      spinAngleRef.current = targetAngle;
      setSpinAngle(targetAngle);
      setSelectedRoute(finalRoute);
      setHoveredRoute(null);
      setSpinning(false);
      frameRef.current = null;
    };

    frameRef.current = requestAnimationFrame(animate);
  };

  const spin = () => {
    if (spinning) return;
    const target = pickRandomRoute(selectedRoute?.id);
    focusRoute(target, { fullSpin: true });
  };

  const wheelSpin = (deltaY: number) => {
    if (spinning || deltaY === 0) return;
    const currentRoute = routeAtAngle(orderedRoutes, spinAngleRef.current) ?? previewRoute;
    const currentIndex = currentRoute
      ? orderedRoutes.findIndex((route) => route.id === currentRoute.id)
      : Math.floor(orderedRoutes.length / 2);
    const nextIndex = clamp(
      currentIndex + (deltaY > 0 ? 1 : -1),
      0,
      orderedRoutes.length - 1,
    );
    const nextRoute = orderedRoutes[nextIndex];
    if (!nextRoute || nextRoute.id === currentRoute?.id) return;
    focusRoute(nextRoute, { durationMs: WHEEL_SPIN_MS });
  };

  const previewRoute = hoveredRoute ?? selectedRoute;

  return (
    <div className="grid min-h-dvh grid-rows-[340px_auto] bg-bg text-fg lg:h-full lg:min-h-0 lg:grid-cols-[390px_minmax(0,1fr)] lg:grid-rows-1">
      <CurvedRouteWheel
        routes={orderedRoutes}
        activeId={previewRoute?.id ?? null}
        spinAngle={spinAngle}
        spinning={spinning}
        onSpin={spin}
        onRouteClick={(route) => {
          if (!spinning) focusRoute(route, { durationMs: WHEEL_SPIN_MS });
        }}
        onRouteHover={(route) => {
          if (!spinning) setHoveredRoute(route);
        }}
        onRouteHoverIndex={(index) => {
          if (spinning) return;
          if (index === null) {
            setHoveredRoute(null);
            return;
          }
          const route = orderedRoutes[index];
          if (!route) return;
          const nextAngle = centerAngleForRoute(orderedRoutes, route.id);
          spinAngleRef.current = nextAngle;
          setSpinAngle(nextAngle);
          setHoveredRoute(route);
        }}
        onWheelSpin={wheelSpin}
      />

      <section className="min-h-0 lg:grid lg:grid-rows-[minmax(0,1fr)_auto]">
        <div className="grid min-h-0 border-b border-hairline bg-[#f7f7f3] lg:grid-rows-[minmax(0,1fr)_minmax(300px,42%)] xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-rows-1">
          <div className="hidden min-h-0 grid-rows-[40px_minmax(0,1fr)] border-b border-hairline lg:grid xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between border-b border-hairline bg-bg px-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em]">
                Map
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                district + route anchor
              </div>
            </div>
            <div className="relative min-h-0 overflow-hidden">
              {geojson ? (
                <BeijingMap
                  geojson={geojson}
                  selectedRoute={selectedRoute}
                  previewRoute={previewRoute}
                  onRouteClick={(route) => {
                    if (!spinning) focusRoute(route, { durationMs: WHEEL_SPIN_MS });
                  }}
                  onRouteHover={(route) => {
                    if (!spinning) setHoveredRoute(route);
                  }}
                />
              ) : (
                <div className="absolute inset-0 grid place-items-center font-mono text-xs uppercase tracking-widest text-muted">
                  loading map...
                </div>
              )}
            </div>
          </div>

          <div className="grid min-h-[390px] grid-rows-[40px_minmax(0,1fr)] lg:min-h-0">
            <div className="flex items-center justify-between border-b border-hairline bg-bg px-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em]">
                Route
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                preview
              </div>
            </div>
            <div className="min-h-0 overflow-hidden">
              <RoutePreviewMap route={previewRoute} />
            </div>
          </div>
        </div>
        <RouteDetailsPanel route={selectedRoute} />
      </section>
    </div>
  );
}

function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function shortestDelta(from: number, to: number): number {
  return ((((to - from + 180) % 360) + 360) % 360) - 180;
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function routeAtAngle(routes: Route[], angle: number): Route | null {
  if (routes.length === 0) return null;
  const center = Math.floor(routes.length / 2);
  const normalizedAngle = normalizeAngle(angle);
  let bestRoute: Route | null = null;
  let bestDistance = Infinity;

  routes.forEach((route, index) => {
    const baseAngle = (index - center) * ROUTE_WHEEL_ANGLE_STEP;
    const distance = Math.abs(normalizeAngle(baseAngle + normalizedAngle));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRoute = route;
    }
  });

  return bestRoute;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeAngle(angle: number): number {
  return ((((angle + 180) % 360) + 360) % 360) - 180;
}

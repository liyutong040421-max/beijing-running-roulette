"use client";

import type { KeyboardEvent } from "react";
import type { Route } from "@/lib/types";

type Props = {
  routes: Route[];
  activeId: string | null;
  spinAngle: number;
  spinning: boolean;
  onSpin: () => void;
  onRouteClick: (route: Route) => void;
  onRouteHover: (route: Route | null) => void;
  onRouteHoverIndex: (index: number | null) => void;
  onWheelSpin: (deltaY: number) => void;
};

const WHEEL_W = 390;
const WHEEL_H = 860;
const CENTER_X = -120;
const CENTER_Y = 505;
const RADIUS = 330;
export const ROUTE_WHEEL_ANGLE_STEP = 6;
const ITEM_H = 28;
const POINTER_ROW_H = 36;
const VISIBLE_ITEM_COUNT = 7;

export function CurvedRouteWheel({
  routes,
  activeId,
  spinAngle,
  spinning,
  onSpin,
  onRouteClick,
  onRouteHover,
  onRouteHoverIndex,
  onWheelSpin,
}: Props) {
  const activeIndex = activeId
    ? Math.max(0, routes.findIndex((route) => route.id === activeId))
    : centerIndex(routes);

  const handleWheelPointer = (clientY: number, currentTarget: SVGSVGElement) => {
    if (spinning) return;
    const rect = currentTarget.getBoundingClientRect();
    const svgY = ((clientY - rect.top) / rect.height) * WHEEL_H;
    const offset = Math.round((svgY - CENTER_Y) / POINTER_ROW_H);
    const index = clamp(activeIndex + offset, 0, routes.length - 1);
    onRouteHoverIndex(index);
  };

  return (
    <aside className="grid min-h-[310px] grid-rows-[48px_minmax(0,1fr)] overflow-hidden border-b border-hairline bg-bg lg:min-h-0 lg:border-b-0 lg:border-r">
      <div className="z-20 flex h-12 items-center justify-between border-b border-hairline px-5 lg:px-6">
        <div className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-fg">
          Routes
        </div>
        <button
          type="button"
          onClick={onSpin}
          disabled={spinning}
          className="bg-fg px-4 py-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.16em] text-bg transition-opacity hover:opacity-80 active:opacity-60 disabled:cursor-not-allowed disabled:opacity-35"
          title="Spin"
        >
          {spinning ? "..." : "SPIN"}
        </button>
      </div>

      <div className="relative min-h-0 overflow-hidden">
        <svg
          viewBox={`0 0 ${WHEEL_W} ${WHEEL_H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          className="block select-none"
          role="listbox"
          aria-label="北京跑步路线轮盘"
          onMouseMove={(event) => handleWheelPointer(event.clientY, event.currentTarget)}
          onWheel={(event) => {
            event.preventDefault();
            if (!spinning) onWheelSpin(event.deltaY);
          }}
          onMouseLeave={() => {
            if (!spinning) {
              onRouteHover(null);
              onRouteHoverIndex(null);
            }
          }}
        >
          <line
            x1={0}
            x2={WHEEL_W}
            y1={CENTER_Y}
            y2={CENTER_Y}
            vectorEffect="non-scaling-stroke"
            style={{ stroke: "var(--color-fg)", strokeOpacity: 0.12 }}
          />
          <circle cx={0} cy={CENTER_Y} r={9} style={{ fill: "var(--color-accent)" }} />

          <g
            transform={`rotate(${spinAngle} ${CENTER_X} ${CENTER_Y})`}
          >
            {routes.map((route, index) => {
              const baseAngle = (index - centerIndex(routes)) * ROUTE_WHEEL_ANGLE_STEP;
              const active = route.id === activeId;
              const width = labelWidth(route.name);
              const x = CENTER_X + Math.cos(toRad(baseAngle)) * RADIUS;
              const y = CENTER_Y + Math.sin(toRad(baseAngle)) * RADIUS;
              const indexDistance = Math.abs(index - activeIndex);
              const visible = indexDistance <= VISIBLE_ITEM_COUNT;
              const opacity = active
                ? 1
                : visible
                  ? Math.max(0.08, 1 - indexDistance / (VISIBLE_ITEM_COUNT + 1))
                  : 0;

              return (
                <g
                  key={route.id}
                  role="option"
                  aria-selected={active}
                  tabIndex={spinning ? -1 : 0}
                  transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${baseAngle.toFixed(2)})`}
                  onClick={() => {
                    if (!spinning) onRouteClick(route);
                  }}
                  onMouseEnter={() => {
                    if (!spinning) onRouteHover(route);
                  }}
                  onMouseLeave={() => onRouteHover(null)}
                  onFocus={() => {
                    if (!spinning) onRouteHover(route);
                  }}
                  onBlur={() => onRouteHover(null)}
                  onKeyDown={(event) => handleRouteKey(event, route, spinning, onRouteClick)}
                  style={{
                    cursor: spinning ? "wait" : "pointer",
                    opacity,
                    transition: "opacity 140ms ease",
                    outline: "none",
                    pointerEvents: visible ? "auto" : "none",
                  }}
                >
                  <rect
                    x={-width / 2}
                    y={-ITEM_H / 2}
                    width={width}
                    height={ITEM_H}
                    rx={3}
                    style={{
                      fill: active ? "var(--color-bg)" : "var(--color-fg)",
                      fillOpacity: active ? 1 : 0.1,
                      stroke: active ? "var(--color-fg)" : "transparent",
                      strokeWidth: active ? 1 : 0,
                    }}
                  />
                  <text
                    x={0}
                    y={1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-medium"
                    fontSize={11.5}
                    style={{
                      fill: active ? "var(--color-accent)" : "var(--color-fg)",
                    }}
                  >
                    {route.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </aside>
  );
}

export function centerAngleForRoute(routes: Route[], routeId: string): number {
  const index = routes.findIndex((route) => route.id === routeId);
  return index >= 0 ? -((index - centerIndex(routes)) * ROUTE_WHEEL_ANGLE_STEP) : 0;
}

function handleRouteKey(
  event: KeyboardEvent<SVGGElement>,
  route: Route,
  spinning: boolean,
  onRouteClick: (route: Route) => void,
) {
  if (spinning) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onRouteClick(route);
}

function centerIndex(routes: Route[]): number {
  return Math.floor(routes.length / 2);
}

function labelWidth(name: string): number {
  return Math.min(214, Math.max(78, Array.from(name).length * 11 + 24));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

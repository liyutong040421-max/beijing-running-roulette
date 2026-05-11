"use client";

import { useMemo, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import { routes } from "@/lib/routes";
import type { Route } from "@/lib/types";
import {
  computeBounds,
  geometryToPath,
  makeProjection,
} from "@/lib/projection";

type DistrictProps = { name?: string; adcode?: number };

type Props = {
  geojson: FeatureCollection<Geometry, DistrictProps>;
  selectedRoute: Route | null;
  previewRoute: Route | null;
  onRouteClick?: (route: Route) => void;
  onRouteHover?: (route: Route | null) => void;
};

const W = 800;
const H = 800;
const PADDING = 24;

export function BeijingMap({
  geojson,
  selectedRoute,
  previewRoute,
  onRouteClick,
  onRouteHover,
}: Props) {
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const draggingMovedRef = useRef(false);
  const [hoveredDistrict, setHoveredDistrict] = useState<{
    name: string;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredRouteLabel, setHoveredRouteLabel] = useState<{
    name: string;
    distance: string;
    x: number;
    y: number;
  } | null>(null);

  const { project, paths } = useMemo(() => {
    const bounds = computeBounds(geojson);
    const project = makeProjection(bounds, W, H, PADDING);
    const paths = geojson.features.map((f) => ({
      key: f.properties?.adcode ?? f.properties?.name ?? Math.random(),
      name: f.properties?.name,
      adcode: f.properties?.adcode,
      d: geometryToPath(f.geometry, project),
    }));
    return { project, paths };
  }, [geojson]);

  const routeAnchors = useMemo(() => {
    return routes.map((route) => {
      const [x, y] = project(route.start);
      return { route, x, y };
    });
  }, [project]);

  const activeRoute = previewRoute ?? selectedRoute;
  const activeDistrictAdcodes = new Set(
    (activeRoute?.district_adcodes?.length
      ? activeRoute.district_adcodes
      : activeRoute
        ? [activeRoute.district_adcode]
        : []
    ).filter((adcode): adcode is number => typeof adcode === "number"),
  );

  const setZoomAroundPoint = (
    nextZoom: number,
    point: { x: number; y: number } | null = null,
  ) => {
    setMapZoom((currentZoom) => {
      const zoom = clamp(nextZoom, 1, 4);
      const ratio = zoom / currentZoom;

      if (point && currentZoom !== zoom) {
        setMapPan((currentPan) => ({
          x: point.x - (point.x - currentPan.x) * ratio,
          y: point.y - (point.y - currentPan.y) * ratio,
        }));
      }

      if (zoom === 1) {
        setMapPan({ x: 0, y: 0 });
      }

      return zoom;
    });
  };

  return (
    <div
      className="relative h-full min-h-[260px] overflow-hidden"
      onWheel={(event) => {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const point = {
          x: event.clientX - rect.left - rect.width / 2,
          y: event.clientY - rect.top - rect.height / 2,
        };
        const zoomDelta = event.deltaY > 0 ? -0.16 : 0.16;
        setZoomAroundPoint(mapZoom + zoomDelta, point);
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        className="block select-none"
        style={{
          cursor: dragStart ? "grabbing" : mapZoom > 1 ? "grab" : "default",
          transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})`,
          transformOrigin: "center",
          transition: dragStart ? "none" : "transform 180ms ease",
          touchAction: "none",
        }}
        role="img"
        aria-label="北京核心城区地图，显示路线所在区域"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          draggingMovedRef.current = false;
          setDragStart({
            x: event.clientX,
            y: event.clientY,
            panX: mapPan.x,
            panY: mapPan.y,
          });
        }}
        onPointerMove={(event) => {
          if (!dragStart) return;
          if (
            Math.abs(event.clientX - dragStart.x) > 3 ||
            Math.abs(event.clientY - dragStart.y) > 3
          ) {
            draggingMovedRef.current = true;
          }
          setMapPan({
            x: dragStart.panX + event.clientX - dragStart.x,
            y: dragStart.panY + event.clientY - dragStart.y,
          });
        }}
        onPointerUp={() => setDragStart(null)}
        onPointerCancel={() => setDragStart(null)}
        onMouseLeave={() => {
          setDragStart(null);
          setHoveredDistrict(null);
          setHoveredRouteLabel(null);
          onRouteHover?.(null);
        }}
      >
        <g>
          {paths.map((p) => {
            const activeDistrict =
              typeof p.adcode === "number" && activeDistrictAdcodes.has(p.adcode);
            const hovered = hoveredDistrict?.name === p.name;

            return (
              <path
                key={p.key}
                d={p.d}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                onMouseMove={(event) => {
                  if (!p.name) return;
                  const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  setHoveredDistrict({
                    name: p.name,
                    x: event.clientX - (rect?.left ?? 0),
                    y: event.clientY - (rect?.top ?? 0),
                  });
                }}
                style={{
                  cursor: "default",
                  fill: activeDistrict || hovered ? "var(--color-accent)" : "transparent",
                  fillOpacity: activeDistrict ? 0.16 : hovered ? 0.08 : 0,
                  stroke:
                    activeDistrict || hovered ? "var(--color-accent)" : "var(--color-fg)",
                  strokeOpacity: activeDistrict ? 0.78 : hovered ? 0.58 : 0.28,
                  strokeWidth: activeDistrict || hovered ? 1.4 : 1,
                  transition:
                    "fill-opacity 160ms ease, stroke 160ms ease, stroke-opacity 160ms ease",
                }}
              />
            );
          })}
        </g>

        <g>
          {routeAnchors.map(({ route, x, y }) => {
            const isActive = activeRoute?.id === route.id;
            if (!isActive) return null;

            return (
              <g key={`${route.id}-start`} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
                <circle
                  className="pulse-ring"
                  fill="none"
                  style={{ stroke: "var(--color-accent)", strokeWidth: 1 }}
                />
                <circle
                  className="marker-dot"
                  r={4.5}
                  style={{ fill: "var(--color-accent)" }}
                />
                <text
                  x={10}
                  y={4.5}
                  fontSize={12}
                  className="font-medium pointer-events-none"
                  style={{
                    fill: "var(--color-fg)",
                    paintOrder: "stroke",
                    stroke: "var(--color-bg)",
                    strokeWidth: 4,
                  }}
                >
                  {route.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute bottom-4 right-4 z-30 flex flex-col border border-hairline bg-bg/92 shadow-sm backdrop-blur">
        <button
          type="button"
          className="h-8 w-8 border-b border-hairline text-lg leading-none"
          onClick={() => setZoomAroundPoint(mapZoom + 0.35)}
          aria-label="放大北京地图"
        >
          +
        </button>
        <button
          type="button"
          className="h-8 w-8 text-[11px] font-bold uppercase"
          onClick={() => {
            setMapZoom(1);
            setMapPan({ x: 0, y: 0 });
          }}
          aria-label="重置北京地图"
        >
          1x
        </button>
      </div>

      <div className="absolute bottom-4 left-4 z-20 max-w-[220px] border border-hairline bg-bg/92 px-3 py-2 text-xs leading-5 text-muted shadow-sm backdrop-blur">
        北京总图只显示区域与路线位置；真实轨迹以右侧路线图为准。
      </div>

      {hoveredRouteLabel ? (
        <div
          className="pointer-events-none absolute z-30 border border-fg bg-fg px-2 py-1 text-bg shadow-sm"
          style={{
            left: hoveredRouteLabel.x + 12,
            top: hoveredRouteLabel.y + 12,
          }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.16em]">
            {hoveredRouteLabel.distance}
          </div>
          <div className="mt-0.5 text-xs font-medium">{hoveredRouteLabel.name}</div>
        </div>
      ) : hoveredDistrict ? (
        <div
          className="pointer-events-none absolute z-20 border border-fg bg-fg px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-bg shadow-sm"
          style={{
            left: hoveredDistrict.x + 12,
            top: hoveredDistrict.y + 12,
          }}
        >
          {hoveredDistrict.name}
        </div>
      ) : null}
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

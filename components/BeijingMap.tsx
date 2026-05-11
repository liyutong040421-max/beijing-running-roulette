"use client";

import { useMemo } from "react";
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
  highlightedId: string | null;
  selectedId: string | null;
  onMarkerClick?: (route: Route) => void;
};

const W = 800;
const H = 800;
const PADDING = 24;

export function BeijingMap({
  geojson,
  highlightedId,
  selectedId,
  onMarkerClick,
}: Props) {
  const { project, paths } = useMemo(() => {
    const bounds = computeBounds(geojson);
    const project = makeProjection(bounds, W, H, PADDING);
    const paths = geojson.features.map((f) => ({
      key: f.properties?.adcode ?? f.properties?.name ?? Math.random(),
      name: f.properties?.name,
      d: geometryToPath(f.geometry, project),
    }));
    return { project, paths };
  }, [geojson]);

  const markers = useMemo(() => {
    return routes.map((r) => {
      const [x, y] = project(r.start);
      return { route: r, x, y };
    });
  }, [project]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      className="block select-none"
      role="img"
      aria-label="北京 16 区地图，25 条跑步路线 marker"
    >
      <g>
        {paths.map((p) => (
          <path
            key={p.key}
            d={p.d}
            fill="none"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{
              stroke: "var(--color-fg)",
              strokeOpacity: 0.32,
              strokeWidth: 1,
            }}
          />
        ))}
      </g>

      <g>
        {markers.map(({ route, x, y }) => {
          const isHighlighted = highlightedId === route.id;
          const isSelected = selectedId === route.id;
          const isActive = isHighlighted || isSelected;

          return (
            <g key={route.id} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
              {isActive && (
                <circle
                  className="pulse-ring"
                  fill="none"
                  style={{ stroke: "var(--color-accent)", strokeWidth: 1.2 }}
                />
              )}
              <circle
                className="marker-dot"
                r={isActive ? 5.5 : 2.8}
                opacity={selectedId && !isActive ? 0.18 : 1}
                cursor={onMarkerClick ? "pointer" : "default"}
                onClick={() => onMarkerClick?.(route)}
                style={{
                  fill: isActive ? "var(--color-accent)" : "var(--color-fg)",
                }}
              />
              {isSelected && (
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
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

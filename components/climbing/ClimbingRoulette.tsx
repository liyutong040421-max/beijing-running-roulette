"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { FeatureCollection, Geometry } from "geojson";
import { climbingGyms, type ClimbingGym } from "@/data/climbing-gyms";
import { geometryToPath, makeProjection, type Bounds } from "@/lib/projection";
import { haversineKm } from "@/lib/geo";
import { pickFirstPhoto, type PhotoManifest } from "@/lib/climbing-photos";
import { RefuelPanel } from "./RefuelPanel";
import { PartyPanel, type Participant } from "./PartyPanel";

const TOTAL_SPIN_MS = 1800;
const WHEEL_SPIN_MS = 260;
const WHEEL_W = 390;
const WHEEL_H = 860;
const CENTER_X = -120;
const CENTER_Y = 505;
const RADIUS = 330;
const ITEM_H = 28;
const POINTER_ROW_H = 36;
const VISIBLE_ITEM_COUNT = 7;
const MAP_W = 900;
const MAP_H = 900;
const MAP_PADDING = 36;
const BOUNDS_PAD_LNG = 0.05;
const BOUNDS_PAD_LAT = 0.045;

const INNER_DISTRICTS = new Set([
  "东城区",
  "西城区",
  "朝阳区",
  "海淀区",
  "丰台区",
  "石景山区",
  "昌平区",
  "大兴区",
]);

// Visual order on the wheel: roughly inner ring → outer ring, then alphabetical
// fallback. New districts auto-fall to the bottom via the 99 default.
const DISTRICT_ORDER = new Map<string, number>([
  ["东城", 0],
  ["西城", 1],
  ["朝阳", 2],
  ["海淀", 3],
  ["丰台", 4],
  ["石景山", 5],
  ["昌平", 6],
  ["大兴", 7],
  ["通州", 8],
  ["房山", 9],
  ["顺义", 10],
]);

type DistrictProps = { name?: string; adcode?: number };
type GeoData = FeatureCollection<Geometry, DistrictProps>;

export function ClimbingRoulette({ photoManifest = {} }: { photoManifest?: PhotoManifest } = {}) {
  const [selectedGym, setSelectedGym] = useState<ClimbingGym | null>(null);
  const [hoveredGym, setHoveredGym] = useState<ClimbingGym | null>(null);
  const [spinAngle, setSpinAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const frameRef = useRef<number | null>(null);
  const spinAngleRef = useRef(0);

  const gyms = useMemo(() => {
    return [...climbingGyms].sort((a, b) => {
      const districtDelta = (DISTRICT_ORDER.get(a.district) ?? 99) - (DISTRICT_ORDER.get(b.district) ?? 99);
      if (districtDelta !== 0) return districtDelta;
      const areaDelta = a.area.localeCompare(b.area, "zh-CN");
      if (areaDelta !== 0) return areaDelta;
      return a.name.localeCompare(b.name, "zh-CN");
    });
  }, []);
  const previewGym = hoveredGym ?? selectedGym;

  const [participants, setParticipants] = useState<Participant[]>([]);

  // Pool of gyms to spin from when in multi-person mode. Heuristic: rank by
  // worst-case commute (max km from any participant), keep gyms within 6km of
  // the best worst-case. Adapts to participant spread (close-by friends → tight
  // pool; spread out friends → looser pool). Always keeps at least 5 so SPIN
  // is meaningful even when friends are scattered across town.
  const fairPool = useMemo<ClimbingGym[]>(() => {
    if (participants.length === 0) return gyms;
    const scored = gyms.map((g) => {
      const worst = Math.max(
        ...participants.map((p) => haversineKm(p, { lng: g.lng, lat: g.lat })),
      );
      return { gym: g, worst };
    });
    scored.sort((a, b) => a.worst - b.worst);
    const minWorst = scored[0]?.worst ?? 0;
    const cutoff = minWorst + 6;
    let pool = scored.filter((s) => s.worst <= cutoff);
    if (pool.length < 5) pool = scored.slice(0, Math.min(5, scored.length));
    return pool.map((s) => s.gym);
  }, [gyms, participants]);

  const fairPoolIds = useMemo(
    () => new Set(fairPool.map((g) => g.id)),
    [fairPool],
  );

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const focusGym = (
    gym: ClimbingGym,
    options: { fullSpin?: boolean; durationMs?: number } = {},
  ) => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const fullSpin = options.fullSpin ?? false;
    const durationMs = options.durationMs ?? (fullSpin ? TOTAL_SPIN_MS : 0);
    const targetAngle = centerAngleForGym(gyms, gym.id);
    const currentAngle = spinAngleRef.current;
    const currentMod = mod(currentAngle, 360);
    const targetMod = mod(targetAngle, 360);
    const delta = fullSpin
      ? 360 * 5 + mod(targetMod - currentMod, 360)
      : shortestDelta(currentMod, targetMod);
    const startAngle = currentAngle;
    const animatedAngle = currentAngle + delta;

    if (durationMs <= 0) {
      const finalGym = gymAtAngle(gyms, targetAngle) ?? gym;
      spinAngleRef.current = targetAngle;
      setSpinAngle(targetAngle);
      setSelectedGym(finalGym);
      setHoveredGym(null);
      setSpinning(false);
      return;
    }

    const startTime = performance.now();
    setSpinning(fullSpin);
    setHoveredGym(null);

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      const eased = easeOutCubic(progress);
      const angle = startAngle + (animatedAngle - startAngle) * eased;
      spinAngleRef.current = angle;
      setSpinAngle(angle);
      setHoveredGym(gymAtAngle(gyms, angle));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
        return;
      }

      const finalGym = gymAtAngle(gyms, targetAngle) ?? gym;
      spinAngleRef.current = targetAngle;
      setSpinAngle(targetAngle);
      setSelectedGym(finalGym);
      setHoveredGym(null);
      setSpinning(false);
      frameRef.current = null;
    };

    frameRef.current = requestAnimationFrame(animate);
  };

  const spin = () => {
    if (spinning) return;
    const source = participants.length > 0 ? fairPool : gyms;
    const pool = selectedGym ? source.filter((gym) => gym.id !== selectedGym.id) : source;
    if (pool.length === 0) return;
    const target = pool[Math.floor(Math.random() * pool.length)];
    focusGym(target, { fullSpin: true });
  };

  const wheelSpin = (deltaY: number) => {
    if (spinning || deltaY === 0) return;
    const currentGym = gymAtAngle(gyms, spinAngleRef.current) ?? previewGym;
    const currentIndex = currentGym
      ? gyms.findIndex((gym) => gym.id === currentGym.id)
      : Math.floor(gyms.length / 2);
    const nextIndex = clamp(currentIndex + (deltaY > 0 ? 1 : -1), 0, gyms.length - 1);
    const nextGym = gyms[nextIndex];
    if (!nextGym || nextGym.id === currentGym?.id) return;
    focusGym(nextGym, { durationMs: WHEEL_SPIN_MS });
  };

  return (
    <div className="grid min-h-dvh grid-rows-[340px_auto] bg-bg text-fg lg:h-full lg:min-h-0 lg:grid-cols-[390px_minmax(0,1fr)] lg:grid-rows-1">
      <ClimbingWheel
        gyms={gyms}
        activeId={previewGym?.id ?? null}
        spinAngle={spinAngle}
        spinning={spinning}
        onSpin={spin}
        onGymClick={(gym) => {
          if (!spinning) focusGym(gym, { durationMs: WHEEL_SPIN_MS });
        }}
        onGymHover={(gym) => {
          if (!spinning) setHoveredGym(gym);
        }}
        onGymHoverIndex={(index) => {
          if (spinning) return;
          if (index === null) {
            setHoveredGym(null);
            return;
          }
          const gym = gyms[index];
          if (!gym) return;
          const nextAngle = centerAngleForGym(gyms, gym.id);
          spinAngleRef.current = nextAngle;
          setSpinAngle(nextAngle);
          setHoveredGym(gym);
        }}
        onWheelSpin={wheelSpin}
        fairPoolIds={fairPoolIds}
        partyProps={{
          participants,
          poolCount: fairPool.length,
          totalCount: gyms.length,
          onAdd: (p) => setParticipants((prev) => [...prev, p].slice(0, 4)),
          onRemove: (id) => setParticipants((prev) => prev.filter((p) => p.id !== id)),
          onClear: () => setParticipants([]),
        }}
      />

      <section className="min-h-0 lg:grid lg:grid-rows-[minmax(0,1fr)_auto]">
        <div className="grid min-h-0 border-b border-hairline bg-[#f7f7f3] lg:grid-rows-[minmax(0,1fr)_minmax(300px,42%)] xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-rows-1">
          <div className="grid min-h-[390px] grid-rows-[40px_minmax(0,1fr)] border-b border-hairline xl:min-h-0 xl:border-b-0 xl:border-r">
            <div className="flex items-center justify-between border-b border-hairline bg-bg px-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em]">Map</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                visual gym positions
              </div>
            </div>
            <div className="relative min-h-0 overflow-hidden">
              <ClimbingCityMap
                gyms={gyms}
                selectedGym={selectedGym}
                previewGym={previewGym}
                participants={participants}
                fairPoolIds={fairPoolIds}
                onGymClick={(gym) => {
                  if (!spinning) focusGym(gym, { durationMs: WHEEL_SPIN_MS });
                }}
                onGymHover={(gym) => {
                  if (!spinning) setHoveredGym(gym);
                }}
              />
            </div>
          </div>

          <div className="grid min-h-[320px] grid-rows-[40px_minmax(0,1fr)] lg:min-h-0">
            <div className="flex items-center justify-between border-b border-hairline bg-bg px-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.24em]">Gym</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                preview
              </div>
            </div>
            <GymPreview gym={previewGym} participants={participants} photoManifest={photoManifest} />
          </div>
        </div>
        <div className="lg:max-h-[260px] lg:overflow-y-auto">
          <RefuelPanel gym={selectedGym} />
        </div>
      </section>
    </div>
  );
}

function ClimbingWheel({
  gyms,
  activeId,
  spinAngle,
  spinning,
  onSpin,
  onGymClick,
  onGymHover,
  onGymHoverIndex,
  onWheelSpin,
  fairPoolIds,
  partyProps,
}: {
  gyms: ClimbingGym[];
  activeId: string | null;
  spinAngle: number;
  spinning: boolean;
  onSpin: () => void;
  onGymClick: (gym: ClimbingGym) => void;
  onGymHover: (gym: ClimbingGym | null) => void;
  onGymHoverIndex: (index: number | null) => void;
  onWheelSpin: (deltaY: number) => void;
  fairPoolIds: Set<string>;
  partyProps: React.ComponentProps<typeof PartyPanel>;
}) {
  const activeIndex = activeId
    ? Math.max(0, gyms.findIndex((gym) => gym.id === activeId))
    : centerIndex(gyms);

  const handleWheelPointer = (clientY: number, currentTarget: SVGSVGElement) => {
    if (spinning) return;
    const rect = currentTarget.getBoundingClientRect();
    const svgY = ((clientY - rect.top) / rect.height) * WHEEL_H;
    const offset = Math.round((svgY - CENTER_Y) / POINTER_ROW_H);
    const index = clamp(activeIndex + offset, 0, gyms.length - 1);
    onGymHoverIndex(index);
  };

  return (
    <aside className="grid min-h-[310px] grid-rows-[48px_auto_minmax(0,1fr)] overflow-hidden border-b border-hairline bg-bg lg:min-h-0 lg:border-b-0 lg:border-r">
      <div className="z-20 flex h-12 items-center justify-between border-b border-hairline px-5 lg:px-6">
        <div className="font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-fg">
          Gyms
        </div>
        <button
          type="button"
          onClick={onSpin}
          disabled={spinning}
          className="bg-fg px-4 py-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.16em] text-bg transition-opacity hover:opacity-80 active:opacity-60 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {spinning ? "..." : "SPIN"}
        </button>
      </div>

      <PartyPanel {...partyProps} />

      <div className="relative min-h-0 overflow-hidden">
        <svg
          viewBox={`0 0 ${WHEEL_W} ${WHEEL_H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
          className="block select-none"
          role="listbox"
          aria-label="北京攀岩馆轮盘"
          onMouseMove={(event) => handleWheelPointer(event.clientY, event.currentTarget)}
          onWheel={(event) => {
            event.preventDefault();
            if (!spinning) onWheelSpin(event.deltaY);
          }}
          onMouseLeave={() => {
            if (!spinning) {
              onGymHover(null);
              onGymHoverIndex(null);
            }
          }}
        >
          <line x1={0} x2={WHEEL_W} y1={CENTER_Y} y2={CENTER_Y} vectorEffect="non-scaling-stroke" style={{ stroke: "var(--color-fg)", strokeOpacity: 0.12 }} />
          <circle cx={0} cy={CENTER_Y} r={9} style={{ fill: "var(--color-accent)" }} />

          <g transform={`rotate(${spinAngle} ${CENTER_X} ${CENTER_Y})`}>
            {gyms.map((gym, index) => {
              const baseAngle = (index - centerIndex(gyms)) * (360 / gyms.length);
              const active = gym.id === activeId;
              const width = labelWidth(gym.name);
              const x = CENTER_X + Math.cos(toRad(baseAngle)) * RADIUS;
              const y = CENTER_Y + Math.sin(toRad(baseAngle)) * RADIUS;
              const indexDistance = Math.abs(index - activeIndex);
              const visible = indexDistance <= VISIBLE_ITEM_COUNT;
              const inPool = fairPoolIds.has(gym.id);
              const baseOpacity = active ? 1 : visible ? Math.max(0.08, 1 - indexDistance / (VISIBLE_ITEM_COUNT + 1)) : 0;
              const opacity = inPool ? baseOpacity : baseOpacity * 0.28;

              return (
                <g
                  key={gym.id}
                  transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${baseAngle.toFixed(2)})`}
                  onClick={() => {
                    if (!spinning) onGymClick(gym);
                  }}
                  onMouseEnter={() => {
                    if (!spinning) onGymHover(gym);
                  }}
                  onMouseLeave={() => onGymHover(null)}
                  style={{
                    cursor: spinning ? "wait" : "pointer",
                    opacity,
                    transition: "opacity 140ms ease",
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
                  <circle
                    cx={-width / 2 + 10}
                    cy={0}
                    r={3}
                    fill={gymColor(gym)}
                  />
                  <text
                    x={6}
                    y={1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-medium"
                    fontSize={11.5}
                    style={{ fill: active ? "var(--color-accent)" : "var(--color-fg)" }}
                  >
                    {gym.name}
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

function ClimbingCityMap({
  gyms,
  selectedGym,
  previewGym,
  participants,
  fairPoolIds,
  onGymClick,
  onGymHover,
}: {
  gyms: ClimbingGym[];
  selectedGym: ClimbingGym | null;
  previewGym: ClimbingGym | null;
  participants: Participant[];
  fairPoolIds: Set<string>;
  onGymClick: (gym: ClimbingGym) => void;
  onGymHover: (gym: ClimbingGym | null) => void;
}) {
  const [geojson, setGeojson] = useState<GeoData | null>(null);
  const [subwayGeo, setSubwayGeo] = useState<GeoData | null>(null);
  const [ringsGeo, setRingsGeo] = useState<GeoData | null>(null);
  const [hoveredGymLabel, setHoveredGymLabel] = useState<
    { name: string; area: string; x: number; y: number } | null
  >(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<
    { name: string; x: number; y: number } | null
  >(null);

  useEffect(() => {
    const load = (path: string) =>
      fetch(path)
        .then((r) => r.json() as Promise<GeoData>)
        .catch(() => null);
    load("/beijing.geo.json").then(setGeojson);
    load("/beijing-subway.geo.json").then(setSubwayGeo);
    load("/beijing-rings.geo.json").then(setRingsGeo);
  }, []);

  const bounds = useMemo<Bounds>(() => {
    const lngs = [
      ...gyms.map((g) => g.lng),
      ...participants.map((p) => p.lng),
    ];
    const lats = [
      ...gyms.map((g) => g.lat),
      ...participants.map((p) => p.lat),
    ];
    return {
      lngMin: Math.min(...lngs) - BOUNDS_PAD_LNG,
      lngMax: Math.max(...lngs) + BOUNDS_PAD_LNG,
      latMin: Math.min(...lats) - BOUNDS_PAD_LAT,
      latMax: Math.max(...lats) + BOUNDS_PAD_LAT,
    };
  }, [gyms, participants]);

  const project = useMemo(
    () => makeProjection(bounds, MAP_W, MAP_H, MAP_PADDING),
    [bounds],
  );

  const districtPaths = useMemo(() => {
    if (!geojson) return [];
    return geojson.features
      .filter((f) => INNER_DISTRICTS.has(f.properties?.name ?? ""))
      .map((f) => ({
        key: f.properties?.adcode ?? f.properties?.name ?? Math.random(),
        name: f.properties?.name ?? "",
        d: geometryToPath(f.geometry, project),
      }));
  }, [geojson, project]);

  const subwayPaths = useMemo(() => {
    if (!subwayGeo) return [];
    return subwayGeo.features.map((f, i) => ({
      key: (f.properties?.adcode ?? f.properties?.name ?? i) + "-subway",
      d: geometryToPath(f.geometry, project),
    }));
  }, [subwayGeo, project]);

  const ringPaths = useMemo(() => {
    if (!ringsGeo) return [];
    return ringsGeo.features.map((f, i) => ({
      key: (f.properties?.adcode ?? f.properties?.name ?? i) + "-ring",
      d: geometryToPath(f.geometry, project),
    }));
  }, [ringsGeo, project]);

  const projectedGyms = useMemo(
    () =>
      gyms.map((gym) => {
        const [x, y] = project([gym.lng, gym.lat]);
        return { gym, x, y };
      }),
    [gyms, project],
  );

  return (
    <div className="relative h-full min-h-[260px] overflow-hidden bg-bg">
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        className="block select-none"
        role="img"
        aria-label="北京城区攀岩馆分布图"
        onMouseLeave={() => {
          setHoveredGymLabel(null);
          setHoveredDistrict(null);
          onGymHover(null);
        }}
      >
        <g
          fill="none"
          stroke="var(--color-fg)"
          strokeWidth={1.1}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.09}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        >
          {ringPaths.map((p) => (
            <path key={String(p.key)} d={p.d} />
          ))}
        </g>

        <g
          fill="none"
          stroke="#475569"
          strokeWidth={0.55}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.32}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        >
          {subwayPaths.map((p) => (
            <path key={String(p.key)} d={p.d} />
          ))}
        </g>

        <g>
          {districtPaths.map((p) => {
            const hovered = hoveredDistrict?.name === p.name;
            return (
              <path
                key={String(p.key)}
                d={p.d}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                onMouseMove={(event) => {
                  const rect =
                    event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  setHoveredDistrict({
                    name: p.name,
                    x: event.clientX - (rect?.left ?? 0),
                    y: event.clientY - (rect?.top ?? 0),
                  });
                }}
                onMouseLeave={() => setHoveredDistrict(null)}
                style={{
                  fill: hovered ? "var(--color-accent)" : "transparent",
                  fillOpacity: hovered ? 0.06 : 0,
                  stroke: hovered ? "var(--color-accent)" : "var(--color-fg)",
                  strokeOpacity: hovered ? 0.55 : 0.18,
                  strokeWidth: hovered ? 1.2 : 1,
                  transition:
                    "fill-opacity 140ms ease, stroke-opacity 140ms ease, stroke 140ms ease",
                  cursor: "default",
                }}
              />
            );
          })}
        </g>

        <g>
          {projectedGyms.map(({ gym, x, y }) => {
            const active =
              previewGym?.id === gym.id || selectedGym?.id === gym.id;
            const inPool = fairPoolIds.has(gym.id);
            const color = gymColor(gym);

            return (
              <g
                key={gym.id}
                onMouseEnter={(event) => {
                  const rect =
                    event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  setHoveredGymLabel({
                    name: gym.name,
                    area: gym.area,
                    x: event.clientX - (rect?.left ?? 0),
                    y: event.clientY - (rect?.top ?? 0),
                  });
                  setHoveredDistrict(null);
                  onGymHover(gym);
                }}
                onMouseMove={(event) => {
                  const rect =
                    event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  setHoveredGymLabel({
                    name: gym.name,
                    area: gym.area,
                    x: event.clientX - (rect?.left ?? 0),
                    y: event.clientY - (rect?.top ?? 0),
                  });
                  onGymHover(gym);
                }}
                onMouseLeave={() => {
                  setHoveredGymLabel(null);
                  onGymHover(null);
                }}
                onClick={() => onGymClick(gym)}
                style={{ cursor: "pointer", opacity: inPool ? 1 : 0.25 }}
              >
                <circle cx={x} cy={y} r={10} fill="transparent" />
                {active ? (
                  <circle
                    cx={x}
                    cy={y}
                    r={9}
                    fill="none"
                    className="pulse-ring"
                    style={{ stroke: "var(--color-accent)", strokeWidth: 1 }}
                  />
                ) : null}
                <circle
                  cx={x}
                  cy={y}
                  r={active ? 5.5 : 3.5}
                  fill={color}
                  style={{
                    stroke: "var(--color-bg)",
                    strokeWidth: active ? 2 : 1,
                  }}
                />
              </g>
            );
          })}
        </g>

        {participants.length > 0 ? (
          <g pointerEvents="none">
            {participants.map((p) => {
              const [px, py] = project([p.lng, p.lat]);
              return (
                <g key={p.id} transform={`translate(${px.toFixed(1)} ${py.toFixed(1)})`}>
                  <circle r={11} fill="var(--color-bg)" stroke="var(--color-accent)" strokeWidth={1.5} />
                  <line x1={-4.5} y1={-4.5} x2={4.5} y2={4.5} stroke="var(--color-accent)" strokeWidth={1.6} strokeLinecap="round" />
                  <line x1={4.5} y1={-4.5} x2={-4.5} y2={4.5} stroke="var(--color-accent)" strokeWidth={1.6} strokeLinecap="round" />
                  <text
                    x={14}
                    y={4}
                    fontSize={11}
                    className="font-medium"
                    style={{
                      fill: "var(--color-fg)",
                      paintOrder: "stroke",
                      stroke: "var(--color-bg)",
                      strokeWidth: 4,
                    }}
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </g>
        ) : null}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex gap-3 border border-hairline bg-bg/92 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted backdrop-blur">
        <LegendDot color="#0a0a0a" label="综合" />
        <LegendDot color="#ea580c" label="抱石" />
        <LegendDot color="#16a34a" label="难度" />
      </div>

      {hoveredGymLabel ? (
        <div
          className="pointer-events-none absolute z-30 border border-fg bg-fg px-2 py-1 text-bg shadow-sm"
          style={{ left: hoveredGymLabel.x + 12, top: hoveredGymLabel.y + 12 }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-70">
            {hoveredGymLabel.area}
          </div>
          <div className="mt-0.5 text-xs font-semibold">{hoveredGymLabel.name}</div>
        </div>
      ) : hoveredDistrict ? (
        <div
          className="pointer-events-none absolute z-20 border border-fg bg-fg px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-bg shadow-sm"
          style={{ left: hoveredDistrict.x + 12, top: hoveredDistrict.y + 12 }}
        >
          {hoveredDistrict.name}
        </div>
      ) : null}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

function GymPreview({ gym, participants, photoManifest }: { gym: ClimbingGym | null; participants: Participant[]; photoManifest: PhotoManifest }) {
  if (!gym) {
    return (
      <div className="grid h-full min-h-[260px] place-items-center bg-bg px-6 text-center">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">gym preview</div>
          <p className="mt-2 max-w-60 text-xs leading-5 text-muted">抽中岩馆后，这里会显示照片和心得。现在先留占位。</p>
        </div>
      </div>
    );
  }

  const photo = pickFirstPhoto(gym.id, gym.photos, photoManifest);
  const shareUrl = buildShareUrl(gym.id, participants);

  return (
    <div className="grid h-full min-h-[260px] grid-rows-[minmax(0,1fr)_auto] bg-[#f7f7f3]">
      {photo ? (
        <div className="relative min-h-[220px] overflow-hidden bg-[#0a0a0a]">
          <Image
            key={photo.src}
            src={photo.src}
            alt={photo.alt}
            fill
            sizes="(max-width: 1280px) 100vw, 420px"
            style={{ objectFit: "cover" }}
            className="select-none"
            priority={false}
          />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 pt-16 text-white">
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] opacity-80">{gym.area}</div>
            <h2 className="mt-1.5 text-2xl font-bold leading-tight tracking-tight">{gym.name}</h2>
            <p className="mt-1.5 text-xs leading-5 opacity-85 line-clamp-2">{gym.address}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <a
                href={gym.amap_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1.5 text-xs text-white/90 transition-colors hover:text-white"
              >
                <span className="opacity-70 group-hover:opacity-100">→</span>
                <span className="underline decoration-white/30 decoration-1 underline-offset-4 group-hover:decoration-white">高德搜岩馆</span>
              </a>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1.5 text-xs text-white/90 transition-colors hover:text-white"
              >
                <span className="opacity-70 group-hover:opacity-100">↗</span>
                <span className="underline decoration-white/30 decoration-1 underline-offset-4 group-hover:decoration-white">分享卡片</span>
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative min-h-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#FAFAF8,#F7F4EE)]" />
          <div className="absolute inset-6 border border-hairline" />
          <div className="relative z-[1] flex h-full flex-col justify-between p-7">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">{gym.area}</div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-fg lg:text-4xl">{gym.name}</h2>
              <p className="mt-4 text-sm leading-6 text-muted">{gym.address}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
                <a
                  href={gym.amap_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 text-sm text-fg transition-colors hover:text-accent"
                >
                  <span className="text-muted transition-colors group-hover:text-accent">→</span>
                  <span className="underline decoration-hairline decoration-1 underline-offset-4 group-hover:decoration-accent">高德搜岩馆</span>
                </a>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 text-sm text-fg transition-colors hover:text-accent"
                >
                  <span className="text-muted transition-colors group-hover:text-accent">↗</span>
                  <span className="underline decoration-hairline decoration-1 underline-offset-4 group-hover:decoration-accent">分享卡片</span>
                </a>
              </div>
            </div>
            <div className="grid gap-3 text-sm">
              {gym.audience ? <Fact label="vibe" value={gym.audience} /> : null}
              {gym.after ? <Fact label="after" value={gym.after} /> : null}
              {gym.notes ? <Fact label="status" value={compactNote(gym.notes)} /> : null}
            </div>
          </div>
        </div>
      )}
      <div className="grid border-t border-hairline bg-bg sm:grid-cols-3">
        <MiniMetric label="area" value={gym.area} />
        {gym.audience ? <MiniMetric label="plan" value={gym.audience} /> : null}
        {gym.after ? <MiniMetric label="food" value={gym.after} /> : null}
      </div>
    </div>
  );
}

function compactNote(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized;
}

function buildShareUrl(gymId: string, participants: Participant[]): string {
  const params = new URLSearchParams();
  params.set("gym", gymId);
  for (const p of participants) {
    params.append(
      "p",
      `${encodeURIComponent(p.label)}:${p.lng.toFixed(5)}:${p.lat.toFixed(5)}`,
    );
  }
  return `/api/share-card?${params.toString()}`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-hairline px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r last:sm:border-r-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-fg">{value}</div>
    </div>
  );
}

function gymColor(gym: ClimbingGym): string {
  if (gym.type.includes("抱石")) return "#ea580c";
  if (gym.type.includes("难度")) return "#16a34a";
  return "#0a0a0a";
}

function centerAngleForGym(gyms: ClimbingGym[], gymId: string): number {
  const index = gyms.findIndex((gym) => gym.id === gymId);
  return index >= 0 ? -((index - centerIndex(gyms)) * (360 / gyms.length)) : 0;
}

function gymAtAngle(gyms: ClimbingGym[], angle: number): ClimbingGym | null {
  if (gyms.length === 0) return null;
  const center = centerIndex(gyms);
  const step = 360 / gyms.length;
  const normalizedAngle = normalizeAngle(angle);
  let bestGym: ClimbingGym | null = null;
  let bestDistance = Infinity;

  gyms.forEach((gym, index) => {
    const baseAngle = (index - center) * step;
    const distance = Math.abs(normalizeAngle(baseAngle + normalizedAngle));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestGym = gym;
    }
  });

  return bestGym;
}

function centerIndex(items: unknown[]): number {
  return Math.floor(items.length / 2);
}

function labelWidth(name: string): number {
  return Math.min(226, Math.max(84, Array.from(name).length * 11 + 36));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function shortestDelta(from: number, to: number): number {
  return ((((to - from + 180) % 360) + 360) % 360) - 180;
}

function normalizeAngle(angle: number): number {
  return ((((angle + 180) % 360) + 360) % 360) - 180;
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

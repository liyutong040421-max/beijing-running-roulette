import subwayMap from "@/data/climbing-subway.json";

export type SubwayInfo = {
  walk_m: number;
  station: string;
  exit: string;
  lines: string[];
};

const map = subwayMap as Record<string, SubwayInfo>;

export function getGymSubway(gymId: string): SubwayInfo | null {
  return map[gymId] ?? null;
}

// Compact label for tight UI spots: "🚇 6号线朝阳门 412m"
export function subwayLabel(info: SubwayInfo | null): string | null {
  if (!info) return null;
  const line = info.lines[0] ?? "";
  return `🚇 ${line ? line + " " : ""}${info.station}站 ${formatWalk(info.walk_m)}`;
}

export function formatWalk(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "—";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

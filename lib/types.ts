export type Surface = "paved" | "trail" | "plastic" | "mixed";

export type Route = {
  id: string;
  name: string;
  district: string;
  distance_km: number;
  surface: Surface[];
  scenery_tags: string[];
  start: [number, number];
  geometry?: GeoJSON.LineString;
  blurb: string;
};

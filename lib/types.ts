export type Surface = "paved" | "trail" | "plastic" | "mixed";

export type Route = {
  id: string;
  route_index?: number;
  section?: string;
  name: string;
  district: string;
  district_adcode: number;
  district_adcodes?: number[];
  distance_km: number;
  distance_label?: string;
  surface: Surface[];
  scenery_tags: string[];
  start: [number, number];
  geometry: GeoJSON.LineString;
  blurb: string;
  route_line?: string;
  road_condition?: string;
  audience?: string;
  night_run?: string;
  runner_feeling?: string;
  runner_tip?: string;
  photos?: {
    src: string;
    alt: string;
  }[];
  map_image?: {
    src: string;
    alt: string;
  };
  food_hint?: string;
  access_note?: string;
  geometry_note?: string;
};

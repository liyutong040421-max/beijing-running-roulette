// Server-side Beijing-outline SVG generator for the share-card image.
// Loads beijing.geo.json once, projects every district polygon into SVG path
// strings, and exposes a projector for placing pins (gym markers) in the same
// coordinate space. Cached per (width, height, padding) since the geometry
// never changes.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FeatureCollection, Geometry } from "geojson";
import {
  computeBounds,
  makeProjection,
  geometryToPath,
  type Bounds,
} from "./projection";

type DistrictProps = { name?: string; adcode?: number };

type CachedMap = {
  paths: string[];
  bounds: Bounds;
  projectPoint: (lng: number, lat: number) => [number, number];
};

const cache = new Map<string, CachedMap>();
let fcPromise: Promise<FeatureCollection<Geometry, DistrictProps>> | null = null;

function loadFc(): Promise<FeatureCollection<Geometry, DistrictProps>> {
  if (!fcPromise) {
    fcPromise = readFile(
      join(process.cwd(), "public", "beijing.geo.json"),
      "utf-8",
    ).then((raw) => JSON.parse(raw) as FeatureCollection<Geometry, DistrictProps>);
  }
  return fcPromise;
}

export async function getBeijingMap(
  w: number,
  h: number,
  padding = 20,
): Promise<CachedMap> {
  const key = `${w}x${h}p${padding}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const fc = await loadFc();
  const bounds = computeBounds(fc);
  const project = makeProjection(bounds, w, h, padding);
  const paths = fc.features.map((f) => geometryToPath(f.geometry, project));
  const entry: CachedMap = {
    paths,
    bounds,
    projectPoint: (lng, lat) => project([lng, lat]),
  };
  cache.set(key, entry);
  return entry;
}

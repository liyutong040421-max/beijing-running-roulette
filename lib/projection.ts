/**
 * Manual linear projection for a small region (Beijing).
 *
 * Why not d3-geo: DataV's GeoJSON uses winding opposite RFC 7946, which causes
 * d3-geo's spherical projections to treat every polygon as "entire Earth minus
 * a small hole" → bounds = [[-180,-90],[180,90]] → broken fits.
 *
 * For a small region like Beijing, a simple Cartesian projection that
 * compensates for cos(latitude) gives a visually correct map without any
 * spherical/winding pitfalls.
 */

import type { FeatureCollection, Geometry, Position } from "geojson";

export type Bounds = {
  lngMin: number;
  lngMax: number;
  latMin: number;
  latMax: number;
};

export type Projection = (lngLat: Position) => [number, number];

export function computeBounds(fc: FeatureCollection): Bounds {
  let lngMin = Infinity,
    lngMax = -Infinity,
    latMin = Infinity,
    latMax = -Infinity;

  const visit = (lng: number, lat: number) => {
    if (lng < lngMin) lngMin = lng;
    if (lng > lngMax) lngMax = lng;
    if (lat < latMin) latMin = lat;
    if (lat > latMax) latMax = lat;
  };

  for (const f of fc.features) {
    forEachCoord(f.geometry, visit);
  }

  return { lngMin, lngMax, latMin, latMax };
}

export function makeProjection(
  bounds: Bounds,
  width: number,
  height: number,
  padding: number,
): Projection {
  const { lngMin, lngMax, latMin, latMax } = bounds;
  const latMid = (latMin + latMax) / 2;
  // At latitude φ, 1° lng = cos(φ) × the distance of 1° lat. Compensate so the
  // map preserves real-world aspect ratio at this latitude.
  const lngStretch = Math.cos((latMid * Math.PI) / 180);

  const lngSpan = (lngMax - lngMin) * lngStretch;
  const latSpan = latMax - latMin;
  const availW = width - 2 * padding;
  const availH = height - 2 * padding;

  const scale = Math.min(availW / lngSpan, availH / latSpan);
  const dx = padding + (availW - lngSpan * scale) / 2;
  const dy = padding + (availH - latSpan * scale) / 2;

  return ([lng, lat]: Position): [number, number] => [
    dx + (lng - lngMin) * lngStretch * scale,
    dy + (latMax - lat) * scale, // SVG y is inverted
  ];
}

export function geometryToPath(
  geometry: Geometry,
  project: Projection,
): string {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map((ring) => ringToPath(ring, project)).join(" ");
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .flatMap((poly) => poly.map((ring) => ringToPath(ring, project)))
      .join(" ");
  }
  return "";
}

function ringToPath(ring: Position[], project: Projection): string {
  if (ring.length === 0) return "";
  const [x0, y0] = project(ring[0]);
  let d = `M${x0.toFixed(1)},${y0.toFixed(1)}`;
  for (let i = 1; i < ring.length; i++) {
    const [x, y] = project(ring[i]);
    d += `L${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d + "Z";
}

function forEachCoord(
  geometry: Geometry,
  visit: (lng: number, lat: number) => void,
): void {
  switch (geometry.type) {
    case "Point":
      visit(geometry.coordinates[0], geometry.coordinates[1]);
      break;
    case "MultiPoint":
    case "LineString":
      geometry.coordinates.forEach(([lng, lat]) => visit(lng, lat));
      break;
    case "MultiLineString":
    case "Polygon":
      geometry.coordinates.forEach((ring) =>
        ring.forEach(([lng, lat]) => visit(lng, lat)),
      );
      break;
    case "MultiPolygon":
      geometry.coordinates.forEach((poly) =>
        poly.forEach((ring) =>
          ring.forEach(([lng, lat]) => visit(lng, lat)),
        ),
      );
      break;
    case "GeometryCollection":
      geometry.geometries.forEach((g) => forEachCoord(g, visit));
      break;
  }
}

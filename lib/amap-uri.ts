// 高德 unified URI — opens the 高德 app via deeplink and falls back to the web
// version automatically. Coordinate must be GCJ-02 ("gaode") which is what
// 高德's own data uses.
//
// Docs: https://lbs.amap.com/api/uri-api/

const APP_NAME = "beijing-running-roulette";

export function amapWalkUrl(
  to: { lng: number; lat: number; name: string }
): string {
  const params = new URLSearchParams({
    to: `${to.lng},${to.lat},${to.name}`,
    mode: "walk",
    policy: "1",
    src: APP_NAME,
    coordinate: "gaode",
    callnative: "1",
  });
  return `https://uri.amap.com/navigation?${params.toString()}`;
}

export function amapMarkerUrl(
  point: { lng: number; lat: number; name: string }
): string {
  const params = new URLSearchParams({
    markers: `${point.lng},${point.lat},${point.name}`,
    src: APP_NAME,
    coordinate: "gaode",
    callnative: "1",
  });
  return `https://uri.amap.com/marker?${params.toString()}`;
}

type AmapEnvelope<T> = {
  status: "0" | "1";
  info: string;
  infocode: string;
} & T;

type WalkingResponse = AmapEnvelope<{
  count?: string;
  route?: {
    origin?: string;
    destination?: string;
    paths?: Array<{
      distance?: string;
      duration?: string;
      steps?: Array<{
        instruction?: string;
        road?: string;
        distance?: string;
        duration?: string;
        polyline?: string;
      }>;
    }>;
  };
}>;

type PoiResponse = AmapEnvelope<{
  count?: string;
  pois?: Array<{
    id?: string;
    name?: string;
    type?: string;
    typecode?: string;
    address?: string;
    location?: string;
    distance?: string;
    tel?: string;
    pname?: string;
    cityname?: string;
    adname?: string;
    biz_ext?: {
      rating?: string;
      cost?: string;
      open_time?: string;
    };
    photos?: Array<{ title?: string; url?: string }>;
  }>;
}>;

type GeocodeResponse = AmapEnvelope<{
  count?: string;
  geocodes?: Array<{
    formatted_address?: string;
    province?: string;
    city?: string;
    district?: string;
    location?: string;
    level?: string;
  }>;
}>;

const AMAP_REST_BASE = "https://restapi.amap.com/v3";
const cache = new Map<string, { expiresAt: number; value: unknown }>();

export class AmapError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export async function fetchWalkingRoute(params: {
  origin: string;
  destination: string;
}): Promise<WalkingResponse> {
  const search = new URLSearchParams({
    key: getAmapWebServiceKey(),
    origin: params.origin,
    destination: params.destination,
    output: "json",
  });

  return cachedFetchAmap<WalkingResponse>(
    `${AMAP_REST_BASE}/direction/walking?${search.toString()}`,
  );
}

export async function fetchNearbyPois(params: {
  location: string;
  keywords?: string;
  types?: string;
  radius?: string;
  offset?: string;
  page?: string;
  extensions?: "base" | "all";
}): Promise<PoiResponse> {
  const search = new URLSearchParams({
    key: getAmapWebServiceKey(),
    location: params.location,
    radius: params.radius ?? "1200",
    offset: params.offset ?? "12",
    page: params.page ?? "1",
    extensions: params.extensions ?? "base",
    output: "json",
  });

  if (params.keywords) search.set("keywords", params.keywords);
  if (params.types) search.set("types", params.types);

  return cachedFetchAmap<PoiResponse>(
    `${AMAP_REST_BASE}/place/around?${search.toString()}`,
  );
}

export async function fetchGeocode(params: {
  address: string;
  city?: string;
}): Promise<GeocodeResponse> {
  const search = new URLSearchParams({
    key: getAmapWebServiceKey(),
    address: params.address,
    city: params.city ?? "北京",
    output: "json",
  });
  return cachedFetchAmap<GeocodeResponse>(
    `${AMAP_REST_BASE}/geocode/geo?${search.toString()}`,
  );
}

export function normalizeLngLat(value: string | null): string | null {
  if (!value) return null;
  const [lngRaw, latRaw] = value.split(",");
  const lng = Number(lngRaw);
  const lat = Number(latRaw);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < 115 || lng > 118 || lat < 39 || lat > 42) return null;
  return `${lng.toFixed(6)},${lat.toFixed(6)}`;
}

function getAmapWebServiceKey(): string {
  const key = process.env.AMAP_WEB_SERVICE_KEY ?? process.env.AMAP_SERVER_KEY;
  if (!key) throw new AmapError("Missing AMAP_WEB_SERVICE_KEY", 500);
  return key;
}

async function cachedFetchAmap<T extends AmapEnvelope<object>>(url: string): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && cached.expiresAt > now) return cached.value as T;

  const res = await fetch(url, { next: { revalidate: 60 * 60 } });
  if (!res.ok) throw new AmapError(`Amap HTTP ${res.status}`, 502);

  const data = (await res.json()) as T;
  if (data.status !== "1") {
    throw new AmapError(`Amap error ${data.infocode}: ${data.info}`, 502);
  }

  cache.set(url, {
    expiresAt: now + 1000 * 60 * 30,
    value: data,
  });
  return data;
}

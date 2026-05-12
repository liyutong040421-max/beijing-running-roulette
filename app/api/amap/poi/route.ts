import {
  AmapError,
  fetchNearbyPois,
  normalizeLngLat,
} from "@/lib/amap-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const location = normalizeLngLat(url.searchParams.get("location"));

    if (!location) {
      return Response.json(
        { error: "location must be lng,lat in Beijing bounds" },
        { status: 400 },
      );
    }

    const ext = url.searchParams.get("extensions");
    const data = await fetchNearbyPois({
      location,
      keywords: url.searchParams.get("keywords") ?? "美食",
      types: url.searchParams.get("types") ?? undefined,
      radius: url.searchParams.get("radius") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      extensions: ext === "all" || ext === "base" ? ext : undefined,
    });

    return Response.json({
      location,
      count: data.count,
      pois: data.pois ?? [],
    });
  } catch (error) {
    if (error instanceof AmapError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Unexpected AMap POI error" }, { status: 500 });
  }
}

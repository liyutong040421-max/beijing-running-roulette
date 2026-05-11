import {
  AmapError,
  fetchWalkingRoute,
  normalizeLngLat,
} from "@/lib/amap-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const origin = normalizeLngLat(url.searchParams.get("origin"));
    const destination = normalizeLngLat(url.searchParams.get("destination"));

    if (!origin || !destination) {
      return Response.json(
        { error: "origin and destination must be lng,lat in Beijing bounds" },
        { status: 400 },
      );
    }

    const data = await fetchWalkingRoute({ origin, destination });
    return Response.json({
      origin,
      destination,
      route: data.route,
    });
  } catch (error) {
    if (error instanceof AmapError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Unexpected AMap walking error" }, { status: 500 });
  }
}

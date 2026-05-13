import {
  AmapError,
  fetchTransitRoute,
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

    const data = await fetchTransitRoute({ origin, destination });
    const best = data.route?.transits?.[0];

    if (!best) {
      return Response.json({ origin, destination, plan: null });
    }

    const durationSec = Number(best.duration ?? 0);
    const walkingM = Number(best.walking_distance ?? 0);

    return Response.json({
      origin,
      destination,
      plan: {
        duration_min: Math.round(durationSec / 60),
        walking_m: Math.round(walkingM),
      },
    });
  } catch (error) {
    if (error instanceof AmapError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: "Unexpected AMap transit error" },
      { status: 500 },
    );
  }
}

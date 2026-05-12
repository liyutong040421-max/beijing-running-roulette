import { AmapError, fetchGeocode } from "@/lib/amap-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const address = (url.searchParams.get("address") ?? "").trim();
    if (!address) {
      return Response.json({ error: "address required" }, { status: 400 });
    }

    const data = await fetchGeocode({
      address,
      city: url.searchParams.get("city") ?? "北京",
    });

    const top = data.geocodes?.[0];
    if (!top?.location) {
      return Response.json({ error: "no result" }, { status: 404 });
    }
    const [lngStr, latStr] = top.location.split(",");
    const lng = Number(lngStr);
    const lat = Number(latStr);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return Response.json({ error: "invalid coords from AMap" }, { status: 502 });
    }

    return Response.json({
      lng,
      lat,
      formatted_address: top.formatted_address ?? address,
      level: top.level ?? "",
      district: top.district ?? "",
    });
  } catch (error) {
    if (error instanceof AmapError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Unexpected geocode error" }, { status: 500 });
  }
}

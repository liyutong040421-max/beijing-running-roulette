import { routes } from "@/lib/routes";

export function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const route = routes.find((item) => item.id === id);

  if (!route) {
    return Response.json({ error: "Unknown route id" }, { status: 404 });
  }

  if (!route.map_image?.src) {
    return Response.json(
      { error: "This route does not have a verified route image yet." },
      { status: 404 },
    );
  }

  return Response.redirect(new URL(route.map_image.src, url.origin), 302);
}

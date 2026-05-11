import routesData from "@/data/routes.json";
import type { Route } from "./types";

export const routes: Route[] = routesData as Route[];

export function pickRandomRoute(exclude?: string): Route {
  const pool = exclude ? routes.filter((r) => r.id !== exclude) : routes;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getRouteById(id: string): Route | undefined {
  return routes.find((r) => r.id === id);
}

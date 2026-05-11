import { PhotoReviewBoard } from "@/components/PhotoReviewBoard";
import { routes } from "@/lib/routes";

export default function ReviewPage() {
  const orderedRoutes = [...routes].sort((a, b) => {
    const indexDelta = (a.route_index ?? 999) - (b.route_index ?? 999);
    if (indexDelta !== 0) return indexDelta;
    return a.name.localeCompare(b.name, "zh-CN");
  });

  return <PhotoReviewBoard routes={orderedRoutes} />;
}

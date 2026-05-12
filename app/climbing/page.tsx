import { ClimbingRoulette } from "@/components/climbing/ClimbingRoulette";
import { loadPhotoManifest } from "@/lib/climbing-photos-server";

export default async function ClimbingPage() {
  const photoManifest = await loadPhotoManifest();
  return <ClimbingRoulette photoManifest={photoManifest} />;
}

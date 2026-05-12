import { climbingGyms } from "@/data/climbing-gyms";
import { loadPhotoManifest } from "@/lib/climbing-photos-server";
import { CurateBoard } from "@/components/climbing/CurateBoard";

export default async function ClimbingCuratePage() {
  const manifest = await loadPhotoManifest();
  return <CurateBoard gyms={climbingGyms} initialManifest={manifest} />;
}

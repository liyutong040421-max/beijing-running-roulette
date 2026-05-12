import type { Metadata } from "next";
import { climbingGyms } from "@/data/climbing-gyms";
import { loadPhotoManifest } from "@/lib/climbing-photos-server";
import { CurateBoard } from "@/components/climbing/CurateBoard";

export const metadata: Metadata = {
  title: "Curate · 北京攀岩轮盘",
};

export default async function ClimbingCuratePage() {
  const manifest = await loadPhotoManifest();
  return <CurateBoard gyms={climbingGyms} initialManifest={manifest} />;
}

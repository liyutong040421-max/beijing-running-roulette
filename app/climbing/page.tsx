import type { Metadata } from "next";
import { ClimbingRoulette } from "@/components/climbing/ClimbingRoulette";
import { loadPhotoManifest } from "@/lib/climbing-photos-server";

export const metadata: Metadata = {
  title: "北京攀岩轮盘 · 今天去哪爬？",
  description:
    "随机抽一家北京攀岩馆。45 家真实坐标，公平多人模式，爬完一键找补碳。",
  openGraph: {
    title: "北京攀岩轮盘 · 今天去哪爬？",
    description: "今天去哪爬？摇一摇。",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "北京攀岩轮盘 · 今天去哪爬？",
    description: "今天去哪爬？摇一摇。",
  },
};

export default async function ClimbingPage() {
  const photoManifest = await loadPhotoManifest();
  return <ClimbingRoulette photoManifest={photoManifest} />;
}

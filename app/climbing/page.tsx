import type { Metadata } from "next";
import { ClimbingRoulette } from "@/components/climbing/ClimbingRoulette";
import { loadPhotoManifest } from "@/lib/climbing-photos-server";
import { climbingGyms } from "@/data/climbing-gyms";

const DEFAULT_TITLE = "岩签 · 今晚去哪爬？";
const DEFAULT_DESC =
  "随机抽一家北京攀岩馆。45 家真实坐标，公平多人模式，爬完一键找补碳。";

type SearchParams = { [key: string]: string | string[] | undefined };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const gymId = typeof sp.gym === "string" ? sp.gym : undefined;
  const gym = gymId ? climbingGyms.find((g) => g.id === gymId) : undefined;

  const title = gym ? `${gym.name} · 岩签` : DEFAULT_TITLE;
  const description = gym
    ? `${gym.district} · ${gym.area} · ${gym.type}。今晚就这家。`
    : DEFAULT_DESC;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "zh_CN",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function ClimbingPage() {
  const photoManifest = await loadPhotoManifest();
  return <ClimbingRoulette photoManifest={photoManifest} />;
}

import type { Metadata } from "next";
import { ClimbingRoulette } from "@/components/climbing/ClimbingRoulette";
import { loadPhotoManifest } from "@/lib/climbing-photos-server";
import { climbingGyms } from "@/data/climbing-gyms";
import { getSiteUrl } from "@/lib/site-url";

const DEFAULT_TITLE = "北京攀岩轮盘 · 今天去哪爬？";
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

  // When the URL is a share link (?gym=…&p=…), point Open Graph at the
  // matching share-card image so WeChat / iMessage / Twitter previews show the
  // magazine cover instead of nothing. Absolute URL — most platforms refuse
  // relative paths.
  let ogImageUrl: string | undefined;
  if (gymId) {
    const ogParams = new URLSearchParams();
    ogParams.set("gym", gymId);
    const pVals = sp.p;
    const pList = Array.isArray(pVals) ? pVals : pVals ? [pVals] : [];
    for (const p of pList.slice(0, 4)) ogParams.append("p", p);
    ogImageUrl = `${getSiteUrl()}/api/share-card?${ogParams.toString()}`;
  }

  const title = gym
    ? `${gym.name} · 北京攀岩轮盘`
    : DEFAULT_TITLE;
  const description = gym
    ? `${gym.district} · ${gym.area} · ${gym.type}。今晚就这家。`
    : DEFAULT_DESC;

  const openGraph: Metadata["openGraph"] = {
    title,
    description,
    type: "website",
    locale: "zh_CN",
  };
  const twitter: Metadata["twitter"] = {
    card: "summary_large_image",
    title,
    description,
  };
  if (ogImageUrl) {
    openGraph.images = [
      { url: ogImageUrl, width: 1080, height: 1350, alt: gym?.name ?? "" },
    ];
    twitter.images = [ogImageUrl];
  }

  return { title, description, openGraph, twitter };
}

export default async function ClimbingPage() {
  const photoManifest = await loadPhotoManifest();
  return <ClimbingRoulette photoManifest={photoManifest} />;
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { climbingGyms, type ClimbingGym } from "@/data/climbing-gyms";
import { loadPhotoManifest } from "@/lib/climbing-photos-server";
import { pickFirstPhoto } from "@/lib/climbing-photos";
import { getGymSubway, subwayLabel } from "@/lib/climbing-subway";
import { haversineKm } from "@/lib/geo";
import { getSiteUrl } from "@/lib/site-url";
import { RefuelPanel } from "@/components/climbing/RefuelPanel";

type Params = { id: string };
type SearchParams = { [key: string]: string | string[] | undefined };

export function generateStaticParams(): Params[] {
  return climbingGyms.map((g) => ({ id: g.id }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const sp = await searchParams;
  const gym = climbingGyms.find((g) => g.id === id);
  if (!gym) return { title: "岩馆未找到 · 岩签" };

  const title = `${gym.name} · ${gym.district}${gym.area ? "·" + gym.area : ""} · 岩签`;
  const description =
    `${gym.name}：${gym.district}${gym.area ? "·" + gym.area : ""}的${gym.type}。` +
    `地址 ${gym.address}。` +
    (gym.audience ? `适合：${gym.audience}。` : "");

  // Build OG image URL — preserve any ?p=label:lng:lat passed via the share
  // link so the magazine-cover preview keeps the "with friends" chips.
  const ogParams = new URLSearchParams();
  ogParams.set("gym", gym.id);
  const pVals = sp.p;
  const pList = Array.isArray(pVals) ? pVals : pVals ? [pVals] : [];
  for (const p of pList.slice(0, 4)) ogParams.append("p", p);
  const ogImage = `${getSiteUrl()}/api/share-card?${ogParams.toString()}`;

  // Canonical drops the ?p= so duplicate party-link variants of the same gym
  // collapse to one indexable URL for search engines.
  const canonical = `${getSiteUrl()}/climbing/${gym.id}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "article",
      locale: "zh_CN",
      url: canonical,
      images: [{ url: ogImage, width: 1080, height: 1350, alt: gym.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function GymPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const gym = climbingGyms.find((g) => g.id === id);
  if (!gym) notFound();

  const manifest = await loadPhotoManifest();
  const photo = pickFirstPhoto(gym.id, gym.photos, manifest);
  const subway = getGymSubway(gym.id);
  const subwayText = subwayLabel(subway);

  // Same-district peers, nearest first, exclude self, cap at 5. Internal
  // linking is the cheapest SEO win for a static set of pages.
  const peers = climbingGyms
    .filter((g) => g.id !== gym.id && g.district === gym.district)
    .map((g) => ({ g, km: haversineKm(g, gym) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 5);

  const jsonLd = buildJsonLd(gym);

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <TopBar />

      <article className="mx-auto max-w-3xl px-5 pb-24 lg:max-w-4xl lg:px-8">
        <div className="relative mt-6 aspect-[4/3] w-full overflow-hidden border border-hairline lg:aspect-[16/9]">
          {photo ? (
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 896px"
              style={{ objectFit: "cover" }}
              priority
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-center"
              style={{ background: gymBackground(gym) }}
            >
              <span
                className="text-white/15"
                style={{
                  fontSize: 200,
                  fontWeight: 700,
                  letterSpacing: -8,
                  lineHeight: 1,
                }}
              >
                {gym.area.split(/[\/／]/)[0] ?? gym.area}
              </span>
            </div>
          )}
        </div>

        <header className="mt-8">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-white"
              style={{ background: typeColor(gym.type) }}
            >
              {shortType(gym.type)}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              {gym.district} · {gym.area}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight lg:text-5xl">
            {gym.name}
          </h1>
          <p className="mt-3 text-sm text-muted lg:text-base">{gym.address}</p>
        </header>

        <section className="mt-8 grid gap-x-8 gap-y-6 border-t border-hairline pt-6 sm:grid-cols-2">
          <Field label="地址">
            <a
              href={gym.amap_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-hairline decoration-1 underline-offset-4 hover:text-accent hover:decoration-accent"
            >
              高德地图打开 →
            </a>
            <div className="mt-1 text-xs text-muted">{gym.address}</div>
          </Field>
          {subwayText ? <Field label="地铁">{subwayText}</Field> : null}
          {gym.audience ? <Field label="适合谁">{gym.audience}</Field> : null}
          {gym.after ? <Field label="爬完顺路">{gym.after}</Field> : null}
          {gym.notes ? (
            <div className="sm:col-span-2">
              <Field label="备注">{gym.notes}</Field>
            </div>
          ) : null}
        </section>

        <section className="mt-10 border-t border-hairline pt-6">
          <h2 className="font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-fg">
            爬完去哪吃
          </h2>
          <div className="mt-3 border border-hairline bg-[#f7f7f3]">
            <RefuelPanel gym={gym} />
          </div>
        </section>

        {peers.length > 0 ? (
          <section className="mt-10 border-t border-hairline pt-6">
            <h2 className="font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-fg">
              {gym.district}区 · 同区域其他岩馆
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {peers.map(({ g, km }) => (
                <li key={g.id}>
                  <Link
                    href={`/climbing/${g.id}`}
                    className="group flex items-baseline justify-between gap-3 border border-hairline bg-bg px-3 py-2.5 transition-colors hover:border-fg"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg group-hover:text-accent">
                      {g.name}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                      {km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-12 border border-hairline bg-fg p-6 text-bg lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-70">
              不知道今晚去哪？
            </div>
            <div className="mt-1 text-xl font-bold leading-tight">
              让轮盘帮你抽一家
            </div>
          </div>
          <Link
            href="/climbing"
            className="mt-4 inline-block bg-bg px-5 py-2 font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-fg transition-opacity hover:opacity-80 lg:mt-0"
          >
            随机摇一家 →
          </Link>
        </section>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}

function TopBar() {
  return (
    <div className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-hairline bg-bg/95 px-5 backdrop-blur lg:px-8">
      <Link
        href="/climbing"
        className="font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-fg hover:text-accent"
      >
        ← 岩签
      </Link>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        北京岩馆抽签
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className="mt-1.5 text-sm leading-6 text-fg">{children}</div>
    </div>
  );
}

function typeColor(type: string): string {
  if (type.includes("抱石")) return "#ea580c";
  if (type.includes("难度")) return "#16a34a";
  return "#0a0a0a";
}
function gymBackground(gym: ClimbingGym): string {
  return typeColor(gym.type);
}
function shortType(type: string): string {
  if (type.includes("抱石")) return "抱石";
  if (type.includes("难度")) return "难度";
  return "综合";
}

// JSON-LD LocalBusiness — gives Google enough structured info to show rich
// results (address, type, geo). Keep it minimal; only include fields we
// actually have, otherwise schema validators complain.
function buildJsonLd(gym: ClimbingGym): Record<string, unknown> {
  const url = `${getSiteUrl()}/climbing/${gym.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: gym.name,
    description: `${gym.district} · ${gym.area} · ${gym.type}`,
    url,
    sameAs: gym.amap_url ? [gym.amap_url] : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: gym.address,
      addressLocality: `${gym.district}区`,
      addressRegion: "北京市",
      addressCountry: "CN",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: gym.lat,
      longitude: gym.lng,
    },
    sport: "Climbing",
  };
}

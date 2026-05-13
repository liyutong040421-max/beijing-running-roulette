// Resolves the site's canonical absolute base URL. Used for sitemap entries
// and Open Graph images, which must be absolute. Order: explicit env override
// → Vercel's auto-injected URL → localhost dev fallback.
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return stripTrailingSlash(explicit);
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

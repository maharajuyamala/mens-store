/** Canonical site origin for metadata, OG URLs, and sitemap. */
export function siteBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export function absoluteOgImageUrl(imageUrl: string): string {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  const base = siteBaseUrl();
  return `${base}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

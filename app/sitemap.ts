import type { MetadataRoute } from "next";
import { fetchListedExploreProducts } from "@/lib/server/product-queries";
import { siteBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteBaseUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/explore`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/wishlist`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/auth/sign-in`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/auth/sign-up`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/checkout`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const products = await fetchListedExploreProducts();
    productRoutes = products.map((p) => ({
      url: `${base}/product-details?id=${encodeURIComponent(p.doc_id)}`,
      lastModified: new Date(p.createdAtMs || Date.now()),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    /* Firestore unavailable during build or missing env */
  }

  return [...staticRoutes, ...productRoutes];
}

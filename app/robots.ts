import type { MetadataRoute } from "next";
import { siteBaseUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteBaseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

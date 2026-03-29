import type { Metadata } from "next";
import { ExplorePageClient } from "@/components/explore/ExplorePageClient";
import {
  fetchListedExploreProducts,
  firstListedProductImage,
} from "@/lib/server/product-queries";
import type { ExploreProduct } from "@/lib/explore/types";
import { absoluteOgImageUrl, siteBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

function safeSerializeProducts(products: ExploreProduct[]): ExploreProduct[] {
  try {
    return JSON.parse(JSON.stringify(products)) as ExploreProduct[];
  } catch {
    return [];
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const title = "Explore the collection";
  const description =
    "Browse curated men’s wear — shirts, pants, jackets, and accessories. Filter by category, size, color, and price.";
  try {
    const products = await fetchListedExploreProducts();
    const og = firstListedProductImage(products);
    return {
      title,
      description,
      openGraph: {
        title: "Explore the collection",
        description,
        url: `${siteBaseUrl()}/explore`,
        siteName: "SecondSkin",
        images: og
          ? [
              {
                url: absoluteOgImageUrl(og),
                width: 1200,
                height: 1200,
                alt: "SecondSkin",
              },
            ]
          : [],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return { title, description };
  }
}

export default async function ExplorePage() {
  let initialProducts: ExploreProduct[] = [];
  try {
    initialProducts = safeSerializeProducts(
      await fetchListedExploreProducts()
    );
  } catch (e) {
    console.error("[explore/page]", e);
  }
  return <ExplorePageClient initialProducts={initialProducts} />;
}

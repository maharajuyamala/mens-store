import HomePageClient from "@/components/HomePageClient";
import { fetchListedExploreProducts } from "@/lib/server/product-queries";
import type { ExploreProduct } from "@/lib/explore/types";

export const dynamic = "force-dynamic";

function safeSerializeProducts(products: ExploreProduct[]): ExploreProduct[] {
  try {
    return JSON.parse(JSON.stringify(products)) as ExploreProduct[];
  } catch {
    return [];
  }
}

export default async function Page() {
  let signatureProducts: ExploreProduct[] = [];
  try {
    signatureProducts = safeSerializeProducts(
      await fetchListedExploreProducts()
    );
  } catch (e) {
    console.error("[page]", e);
  }

  return <HomePageClient signatureProducts={signatureProducts} />;
}

import type { Metadata } from "next";
import { ProductDetailsClient } from "@/components/product-details/ProductDetailsClient";
import {
  fetchProductPageData,
  parseProductForMetadata,
} from "@/lib/server/product-queries";
import { absoluteOgImageUrl, siteBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ id?: string }> };

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const { id } = await searchParams;
  if (!id) {
    return {
      title: "Product | SecondSkin",
      description: "View product details at SecondSkin.",
    };
  }
  const product = await parseProductForMetadata(id);
  if (!product) {
    return {
      title: "Product not found | SecondSkin",
      description: "This product is unavailable.",
    };
  }
  const og = product.images[0];
  const desc =
    product.description.trim().slice(0, 160) ||
    `${product.name} — premium menswear at SecondSkin.`;
  const title = product.name;
  return {
    title,
    description: desc,
    openGraph: {
      title: product.name,
      description: desc,
      url: `${siteBaseUrl()}/product-details?id=${encodeURIComponent(id)}`,
      siteName: "SecondSkin",
      images: og
        ? [
            {
              url: absoluteOgImageUrl(og),
              width: 1200,
              height: 1200,
              alt: product.name,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
    },
  };
}

export default async function ProductDetailsPage({ searchParams }: PageProps) {
  const { id } = await searchParams;
  const productId = id ?? null;
  const { productData, related } = productId
    ? await fetchProductPageData(productId)
    : { productData: null, related: [] };

  return (
    <ProductDetailsClient
      productId={productId}
      initialProductData={productData}
      initialRelated={related}
    />
  );
}

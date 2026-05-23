import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailsClient } from "@/components/product-details/ProductDetailsClient";
import {
  fetchProductPageData,
  parseProductForMetadata,
} from "@/lib/server/product-queries";
import { absoluteOgImageUrl, siteBaseUrl } from "@/lib/site";
import { formatCategoryLabel, type ProductDetail } from "@/lib/product-detail";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ id?: string }> };

function buildProductJsonLd(
  product: ProductDetail,
  productId: string
): Record<string, unknown> {
  const base = siteBaseUrl();
  const url = `${base}/product-details?id=${encodeURIComponent(productId)}`;
  const images = product.images
    .map((img) => absoluteOgImageUrl(img))
    .filter(Boolean);
  const availability =
    product.totalStock > 0
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || `${product.name} from SecondSkin.`,
    image: images.length > 0 ? images : undefined,
    sku: productId,
    brand: { "@type": "Brand", name: "SecondSkin" },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "INR",
      price: product.price.toFixed(2),
      availability,
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}

function buildBreadcrumbJsonLd(
  product: ProductDetail,
  productId: string
): Record<string, unknown> {
  const base = siteBaseUrl();
  const categoryLabel = formatCategoryLabel(product.category);
  const categoryHref = product.category
    ? `${base}/explore?category=${encodeURIComponent(product.category)}`
    : `${base}/explore`;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: base },
      {
        "@type": "ListItem",
        position: 2,
        name: categoryLabel,
        item: categoryHref,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: `${base}/product-details?id=${encodeURIComponent(productId)}`,
      },
    ],
  };
}

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

  // Archived / unlisted / missing → real 404 so search engines de-index the URL.
  if (productId && !productData) {
    notFound();
  }

  const parsed =
    productId && productData
      ? await parseProductForMetadata(productId)
      : null;

  return (
    <>
      {parsed ? (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(buildProductJsonLd(parsed, productId!)),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(buildBreadcrumbJsonLd(parsed, productId!)),
            }}
          />
        </>
      ) : null}
      <ProductDetailsClient
        productId={productId}
        initialProductData={productData}
        initialRelated={related}
      />
    </>
  );
}

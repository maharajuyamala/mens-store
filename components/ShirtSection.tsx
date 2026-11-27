"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ProductImage, ProductImagePlaceholder } from "@/components/ProductImage";
import { imageKitLoaderFor } from "@/lib/uploads/imagekit-loader";
import { Reveal } from "@/components/motion/Reveal";
import Link from "next/link";
import type { ExploreProduct } from "@/lib/explore/types";
import { inr } from "@/lib/utils";

export function useScrollAnimation(): [
  React.RefObject<HTMLElement | null>,
  boolean,
] {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => {
      observer.unobserve(el);
    };
  }, []);

  return [ref, inView];
}

function formatCategoryLabel(category?: string) {
  if (!category?.trim()) return "Featured";
  const c = category.trim();
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
}

function ShirtCard({
  product,
  priority,
}: {
  product: ExploreProduct;
  priority: boolean;
}) {
  const href = `/product-details?id=${encodeURIComponent(product.doc_id)}`;
  const imageSrc =
    product.image?.trim() ||
    product.images.find((u) => u?.trim()) ||
    "";

  return (
    <Link href={href} className="group block shrink-0" data-motion-tap>
      <div className="relative h-[28rem] w-72 shrink-0 overflow-hidden rounded-2xl bg-photo-surface ring-1 ring-border md:h-[32rem] md:w-80">
        {imageSrc ? (
          <ProductImage src={imageSrc} loader={imageKitLoaderFor(imageSrc)} alt={product.name} fill
            className="object-contain" sizes="320px" priority={priority} />
        ) : <ProductImagePlaceholder />}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-6 pb-6 pt-16">
          <p className="text-xs uppercase tracking-widest text-on-photo-accent">{formatCategoryLabel(product.category)} collection</p>
          <h3 className="mt-1 text-2xl font-semibold text-on-photo">{product.name}</h3>
          <p className="text-lg font-medium text-on-photo-accent">{inr.format(product.price)}</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-on-photo motion-safe:transition-transform motion-safe:group-hover:translate-x-1">View details →</span>
        </div>
      </div>
    </Link>
  );
}

export function ShirtSection({ products }: { products: ExploreProduct[] }) {

  const featured = useMemo(() => {
    return [...products]
      .filter((p) => (p.image?.trim() || p.images.some((u) => u?.trim())))
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 24);
  }, [products]);

  if (featured.length === 0) {
    return (
      <section
        className="relative overflow-hidden bg-background py-16 text-foreground sm:py-20"
      >
        <Reveal className="mx-auto max-w-2xl px-4 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-brand">
            Signature
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Our signature collection
          </h2>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base">
            Listed pieces will appear here. Browse the shop to explore everything
            in stock.
          </p>
          <Link
            href="/explore"
            className="mt-6 inline-block text-sm font-semibold text-orange-400 underline-offset-4 hover:text-orange-300 hover:underline"
          >
            Explore the shop
          </Link>
        </Reveal>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden bg-background py-20 text-foreground sm:py-28"
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 to-transparent"
        aria-hidden
      />
      <Reveal
        className="relative mb-3 px-4 text-center"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-brand">
          Signature
        </p>
        <h2 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Our signature collection
        </h2>
      </Reveal>
      <Reveal delay={60}
        className="relative mx-auto mb-12 max-w-lg px-4 text-center text-sm text-muted-foreground sm:text-base"
      >
        Live from the catalog — newest listed first. Swipe or scroll to discover more.
      </Reveal>

      <div
        className="relative"
      >
        <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-20 bg-gradient-to-r from-background to-transparent sm:w-28" />
        <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-20 bg-gradient-to-l from-background to-transparent sm:w-28" />

        <div
          className="flex snap-x snap-proximity gap-6 overflow-x-auto px-6 sm:gap-8 sm:px-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {featured.map((product, index) => (
            <Reveal key={product.doc_id} className="shrink-0 snap-start" delay={(index % 3) * 45}>
              <ShirtCard product={product} priority={index === 0} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

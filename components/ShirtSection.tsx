"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
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
  const overlayVariants = {
    rest: { opacity: 0 },
    hover: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    rest: { opacity: 0, y: 20 },
    hover: { opacity: 1, y: 0 },
  };

  const href = `/product-details?id=${encodeURIComponent(product.doc_id)}`;
  const imageSrc =
    product.image?.trim() ||
    product.images.find((u) => u?.trim()) ||
    "";

  return (
    <Link href={href} className="block shrink-0">
      <motion.div
        className="group relative h-[28rem] w-72 shrink-0 overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/10 transition-shadow duration-300 hover:ring-orange-500/25 md:h-[32rem] md:w-80"
        whileHover={{ scale: 1.03, zIndex: 10, transition: { duration: 0.3 } }}
        style={{ perspective: "800px" }}
      >
        <motion.div
          className="absolute inset-0"
          whileHover={{
            rotateY: -15,
            rotateX: 10,
            transition: { type: "spring", stiffness: 300, damping: 20 },
          }}
        >
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-125"
              sizes="320px"
              priority={priority}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-sm text-zinc-500">
              No image
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
        </motion.div>

        <div className="pointer-events-none absolute bottom-0 left-0 z-10 w-full p-6">
          <motion.h3
            className="text-2xl font-semibold text-white"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
          >
            {product.name}
          </motion.h3>
          <motion.p
            className="text-lg font-medium text-orange-400"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, type: "spring" }}
          >
            {inr.format(product.price)}
          </motion.p>
        </div>

        <motion.div
          variants={overlayVariants}
          initial="rest"
          animate="rest"
          whileHover="hover"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 p-6 text-center backdrop-blur-md"
        >
          <motion.p
            variants={itemVariants}
            className="mb-2 text-sm text-gray-200"
          >
            {formatCategoryLabel(product.category)} collection
          </motion.p>
          <motion.div
            variants={itemVariants}
            className="my-2 h-px w-16 bg-orange-500"
          />
          <motion.span
            variants={itemVariants}
            className="mt-4 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-orange-500/20 ring-1 ring-white/10"
          >
            View details
          </motion.span>
        </motion.div>
      </motion.div>
    </Link>
  );
}

export function ShirtSection({ products }: { products: ExploreProduct[] }) {
  const [sectionRef, inView] = useScrollAnimation();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const scrollDirectionRef = useRef(1);

  const featured = useMemo(() => {
    return [...products]
      .filter((p) => (p.image?.trim() || p.images.some((u) => u?.trim())))
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 24);
  }, [products]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !inView) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;

    if (!isHovering && featured.length > 0) {
      intervalId = setInterval(() => {
        if (
          container.scrollLeft + container.clientWidth >=
          container.scrollWidth - 1
        ) {
          scrollDirectionRef.current = -1;
        } else if (container.scrollLeft <= 0) {
          scrollDirectionRef.current = 1;
        }
        container.scrollBy({
          left: scrollDirectionRef.current * 1,
          behavior: "smooth",
        });
      }, 25);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [inView, isHovering, featured.length]);

  const titleVariants = {
    hidden: { opacity: 0, y: -30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  const textVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        delay: 0.2,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
  };

  if (featured.length === 0) {
    return (
      <section
        ref={sectionRef}
        className="relative overflow-hidden bg-zinc-950 py-16 text-white sm:py-20"
      >
        <div className="mx-auto max-w-2xl px-4 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-orange-400/90">
            Signature
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Our signature collection
          </h2>
          <p className="mt-4 text-sm text-zinc-400 sm:text-base">
            Listed pieces will appear here. Browse the shop to explore everything
            in stock.
          </p>
          <Link
            href="/explore"
            className="mt-6 inline-block text-sm font-semibold text-orange-400 underline-offset-4 hover:text-orange-300 hover:underline"
          >
            Explore the shop
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-zinc-950 py-20 text-white sm:py-28"
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 to-transparent"
        aria-hidden
      />
      <motion.div
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        variants={titleVariants}
        className="relative mb-3 px-4 text-center"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-orange-400/90">
          Signature
        </p>
        <h2 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
          Our signature collection
        </h2>
      </motion.div>
      <motion.p
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
        variants={textVariants}
        className="relative mx-auto mb-12 max-w-lg px-4 text-center text-sm text-zinc-400 sm:text-base"
      >
        Live from the catalog — newest listed first. Hover to pause. Drag to
        scroll.
      </motion.p>

      <div
        className="relative"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-20 bg-gradient-to-r from-zinc-950 to-transparent sm:w-28" />
        <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-20 bg-gradient-to-l from-zinc-950 to-transparent sm:w-28" />

        <motion.div
          ref={scrollContainerRef}
          className="flex cursor-grab gap-6 overflow-x-auto px-6 active:cursor-grabbing sm:gap-8 sm:px-8 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {featured.map((product, index) => (
            <ShirtCard
              key={product.doc_id}
              product={product}
              priority={index === 0}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

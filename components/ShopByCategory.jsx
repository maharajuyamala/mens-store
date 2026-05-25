"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useScrollAnimation } from "./ShirtSection";

const categories = [
  {
    index: "01",
    name: "Men",
    slug: "men",
    image: "/men-shirt.png",
    blurb: "Sherwanis, kurtas & everyday tailoring.",
    cta: "Explore Men",
  },
  {
    index: "02",
    name: "Women",
    slug: "women",
    // Woman in a traditional Indian saree.
    image:
      "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?q=80&w=1200&auto=format&fit=crop",
    blurb: "Sarees, lehengas & contemporary edits.",
    cta: "Explore Women",
  },
  {
    index: "03",
    name: "Kids",
    slug: "kids",
    image: "/kids-shirt.png",
    // Kids portrait has the subject high in the frame — anchor at top so the
    // cover crop trims the bottom instead of the head.
    objectPosition: "center top",
    blurb: "Festive looks & play-ready comfort.",
    cta: "Explore Kids",
  },
];

export const CategorySection = () => {
  const [ref, inView] = useScrollAnimation();
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.14, delayChildren: 0.18 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 32 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-zinc-950 px-4 py-16 text-white sm:px-8 sm:py-24"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/35 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-10 -z-0 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-500/[0.06] blur-[120px]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-orange-400/85 sm:text-[11px]">
            Shop by
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-white sm:text-4xl md:text-5xl">
            Who are you{" "}
            <span className="bg-gradient-to-r from-orange-300 to-amber-200 bg-clip-text font-medium italic text-transparent">
              shopping for
            </span>
            ?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
            Three edits — one promise. The same Second Skin standard, sized for
            everyone in the room.
          </p>
        </div>

        <motion.div
          className="mt-10 grid grid-cols-1 gap-5 sm:mt-14 sm:gap-6 md:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          {categories.map((category) => (
            <motion.div
              key={category.slug}
              variants={itemVariants}
              className="group relative"
            >
              <Link
                href={`/explore?audience=${category.slug}`}
                prefetch={false}
                className="relative block cursor-pointer overflow-hidden rounded-3xl ring-1 ring-white/10 transition-[box-shadow,transform] duration-500 hover:ring-orange-500/35 hover:shadow-[0_24px_60px_-24px_rgba(249,115,22,0.45)]"
                aria-label={`${category.cta} — ${category.blurb}`}
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden">
                  <Image
                    src={category.image}
                    alt={category.name}
                    fill
                    className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
                    style={{
                      objectPosition: category.objectPosition ?? "center",
                    }}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    unoptimized
                  />

                  {/* Warm tint sweep on hover for a cinematic feel */}
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-orange-500/0 via-amber-300/0 to-transparent transition-colors duration-700 group-hover:from-orange-500/10 group-hover:via-amber-300/[0.04]"
                    aria-hidden
                  />

                  {/* Bottom-up text legibility scrim */}
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent"
                    aria-hidden
                  />
                  {/* Top hairline */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                    aria-hidden
                  />

                  {/* Index chip — top-left */}
                  <div className="pointer-events-none absolute left-5 top-5 flex items-center gap-2 sm:left-6 sm:top-6">
                    <span className="rounded-full border border-white/20 bg-black/30 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.18em] text-zinc-100 backdrop-blur-sm sm:text-[11px]">
                      {category.index}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-300/80 sm:text-[11px]">
                      Edit
                    </span>
                  </div>

                  {/* Always-visible CTA arrow — top-right */}
                  <div className="pointer-events-none absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/35 text-zinc-100 backdrop-blur-sm transition-all duration-300 group-hover:border-orange-400/60 group-hover:bg-orange-500/20 group-hover:text-white sm:right-6 sm:top-6">
                    <ArrowUpRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </div>

                  {/* Bottom content block */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 sm:p-7">
                    <h3 className="text-3xl font-light leading-none tracking-tight text-white sm:text-4xl md:text-5xl">
                      <span className="font-medium italic">
                        {category.name}
                      </span>
                    </h3>
                    <p className="max-w-[18rem] text-[13px] leading-relaxed text-zinc-300/90 sm:text-sm">
                      {category.blurb}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/95 sm:text-xs">
                      <span>{category.cta}</span>
                      <span
                        className="h-px w-6 bg-orange-300/70 transition-all duration-300 group-hover:w-10"
                        aria-hidden
                      />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

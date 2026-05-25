"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useScrollAnimation } from "./ShirtSection";

// Each tile routes to /explore?category=<encoded>. The explore filter matches
// these names case-insensitively against the `categories` field on the product
// doc, so the labels here line up 1:1 with the admin category list.
const tiles = [
  {
    label: "Shirts",
    cat: "Casual Shirts",
    image:
      "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?q=80&w=1200&auto=format&fit=crop",
  },
  {
    label: "T-Shirts",
    cat: "T-Shirts",
    image:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1200&auto=format&fit=crop",
  },
  {
    label: "Pants",
    cat: "Jeans",
    image:
      "https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=1200&auto=format&fit=crop",
  },
  {
    label: "Jackets",
    cat: "Jackets",
    image:
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=1200&auto=format&fit=crop",
  },
  {
    label: "Hoodies",
    cat: "Hoodies",
    image:
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=1200&auto=format&fit=crop",
  },
  {
    label: "Ethnic Wear",
    cat: "Ethnic Wear",
    image:
      "https://images.unsplash.com/photo-1610030469983-98e550d6193c?q=80&w=1200&auto=format&fit=crop",
  },
  {
    label: "Wedding Wear",
    cat: "Wedding Wear",
    image:
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?q=80&w=1200&auto=format&fit=crop",
  },
  {
    label: "Lounge Set",
    cat: "Lounge Set",
    image:
      "https://images.unsplash.com/photo-1581655353564-df123a1eb820?q=80&w=1200&auto=format&fit=crop",
  },
  {
    label: "Accessories",
    // Stored as a lowercase tag on products with itemSelection = "Accessories".
    cat: "accessories",
    image:
      "https://images.unsplash.com/photo-1688382654723-a7366006519b?q=80&w=1200&auto=format&fit=crop",
  },
  {
    label: "One Piece · Women",
    // Stored as a lowercase tag on products with itemSelection = "One Piece".
    cat: "one piece",
    audience: "women",
    image:
      "https://images.unsplash.com/photo-1668371679302-a8ec781e876e?q=80&w=1200&auto=format&fit=crop",
  },
];

export const CategoryGallery = () => {
  const [ref, inView] = useScrollAnimation();

  const gridVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 18 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-zinc-950 px-4 py-16 text-white sm:px-8 sm:py-24"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-0 top-12 -z-0 h-72 w-72 rounded-full bg-amber-400/[0.06] blur-[120px]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-orange-400/85 sm:text-[11px]">
            Shop by category
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-tight text-white sm:text-4xl md:text-5xl">
            Curated{" "}
            <span className="bg-gradient-to-r from-orange-300 to-amber-200 bg-clip-text font-medium italic text-transparent">
              edits
            </span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
            From quiet basics to occasion pieces — find your moment.
          </p>
        </div>

        <motion.div
          className="mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-5 md:grid-cols-3 lg:grid-cols-4"
          variants={gridVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          {tiles.map((tile) => {
            const href = tile.audience
              ? `/explore?category=${encodeURIComponent(tile.cat)}&audience=${tile.audience}`
              : `/explore?category=${encodeURIComponent(tile.cat)}`;
            return (
              <motion.div key={`${tile.cat}-${tile.audience ?? "all"}`} variants={itemVariants}>
              <Link
                href={href}
                prefetch={false}
                className="group relative block aspect-square w-full cursor-pointer overflow-hidden rounded-2xl ring-1 ring-white/10 transition-[box-shadow,transform] duration-500 hover:ring-orange-500/35 hover:shadow-[0_18px_40px_-20px_rgba(249,115,22,0.4)]"
                aria-label={`Shop ${tile.label}`}
              >
                <div className="absolute inset-0">
                  <Image
                    src={tile.image}
                    alt={tile.label}
                    fill
                    className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.08]"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    unoptimized
                  />

                  {/* Bottom-up scrim for label legibility */}
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"
                    aria-hidden
                  />
                  {/* Subtle warm tint on hover */}
                  <div
                    className="pointer-events-none absolute inset-0 bg-orange-500/0 transition-colors duration-500 group-hover:bg-orange-500/[0.08]"
                    aria-hidden
                  />

                  {/* Always-visible arrow chip */}
                  <div className="pointer-events-none absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/40 text-zinc-100 backdrop-blur-sm transition-all duration-300 group-hover:border-orange-400/60 group-hover:bg-orange-500/25 group-hover:text-white sm:right-4 sm:top-4 sm:h-9 sm:w-9">
                    <ArrowUpRight
                      className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 sm:h-4 sm:w-4"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  </div>

                  {/* Label — bottom-left */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5">
                    <h3 className="text-base font-medium tracking-tight text-white sm:text-lg">
                      {tile.label}
                    </h3>
                    <span
                      className="mt-1.5 block h-px w-6 bg-orange-300/70 transition-all duration-300 group-hover:w-10"
                      aria-hidden
                    />
                  </div>
                </div>
              </Link>
            </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

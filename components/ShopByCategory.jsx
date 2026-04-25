import React from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useScrollAnimation } from "./ShirtSection";

const categories = [
  {
    name: "Men",
    slug: "men",
    image:
      "https://images.unsplash.com/photo-1617137968427-85924c800a22?q=80&w=1200&auto=format&fit=crop",
    blurb: "Tailoring & everyday essentials",
  },
  {
    name: "Women",
    slug: "women",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=1200&auto=format&fit=crop",
    blurb: "Style that moves with you",
  },
  {
    name: "Kids",
    slug: "kids",
    image:
      "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?q=80&w=1200&auto=format&fit=crop",
    blurb: "Play-ready comfort",
  },
];

export const CategorySection = () => {
  const [ref, inView] = useScrollAnimation();
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 28 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-zinc-950 px-4 py-20 sm:px-8 sm:py-28"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent"
        aria-hidden
      />
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center sm:mb-16">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-orange-400/90">
            Browse
          </p>
          <h2 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            Shop by category
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-zinc-400 sm:text-base">
            Men, women, and kids — jump into the catalog with the right filter
            already applied.
          </p>
        </div>

        <motion.div
          className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6"
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
        >
          {categories.map((category) => (
            <motion.div
              key={category.slug}
              variants={itemVariants}
              className="min-h-[280px] sm:min-h-[340px]"
            >
              <Link
                href={`/explore?category=${category.slug}`}
                className="group relative block h-full min-h-[inherit] overflow-hidden rounded-2xl ring-1 ring-white/10 transition-[box-shadow,transform] duration-500 hover:ring-orange-500/30"
              >
                <Image
                  src={category.image}
                  alt={category.name}
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, 33vw"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20 transition-opacity duration-500 group-hover:from-black/95 group-hover:via-black/60" />
                <div className="absolute inset-0 bg-orange-500/0 transition-colors duration-500 group-hover:bg-orange-500/5" />

                <div className="relative flex h-full min-h-[inherit] flex-col justify-end p-7 sm:p-8">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wider text-orange-300/90 opacity-90 transition-transform duration-300 group-hover:translate-y-0 sm:mb-2">
                    {category.blurb}
                  </p>
                  <h3 className="text-2xl font-bold text-white sm:text-3xl">
                    {category.name}
                  </h3>
                  <div className="mt-4 flex translate-y-1 items-center gap-2 text-sm font-semibold text-orange-400 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    <span>Shop now</span>
                    <ArrowRight className="h-4 w-4" aria-hidden />
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

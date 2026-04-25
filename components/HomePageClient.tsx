"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hero } from "@/components/Hero";
import { ShirtSection } from "@/components/ShirtSection";
import { Testimonials } from "@/components/Testimonial";
import { WhyChooseUs } from "@/components/WhyUs";
import { CategorySection } from "@/components/ShopByCategory";
import { RecentlyViewedSection } from "@/components/RecentlyViewedSection";
import type { ExploreProduct } from "@/lib/explore/types";

export default function HomePageClient({
  signatureProducts,
}: {
  signatureProducts: ExploreProduct[];
}) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence>
        {loading && (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-zinc-950"
          >
            <div
              className="pointer-events-none absolute h-72 w-72 rounded-full bg-orange-500/20 blur-[100px]"
              aria-hidden
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <svg
                width="72"
                height="72"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-orange-500"
                aria-hidden
              >
                <motion.path
                  d="M12 2L2 7V17L12 22L22 17V7L12 2Z"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.85, ease: "easeInOut" }}
                />
                <motion.path
                  d="M2 7L12 12L22 7"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.85, delay: 0.25, ease: "easeInOut" }}
                />
                <motion.path
                  d="M12 12V22"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.85, delay: 0.45, ease: "easeInOut" }}
                />
              </svg>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.45 }}
              className="relative text-sm font-semibold uppercase tracking-[0.35em] text-zinc-300"
            >
              SecondSkin
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && (
        <main className="bg-zinc-950 text-white antialiased">
          <Hero />
          <ShirtSection products={signatureProducts} />
          <CategorySection />
          <RecentlyViewedSection variant="dark" />
          <WhyChooseUs />
          <Testimonials />
        </main>
      )}
    </>
  );
}

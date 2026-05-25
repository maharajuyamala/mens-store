"use client";

import React from "react";
import { motion } from "framer-motion";
import { Gem, RefreshCcw, Truck } from "lucide-react";
import { useScrollAnimation } from "./ShirtSection";

const points = [
  {
    title: "Free shipping",
    line: "On every order. Delivered to your door, no minimums.",
    Icon: Truck,
  },
  {
    title: "Premium fabric",
    line: "Hand-felt, milled to breathe — built to keep its shape wash after wash.",
    Icon: Gem,
  },
  {
    title: "Easy exchange",
    line: "7-day exchange on size or fit. No questions, no fine print.",
    Icon: RefreshCcw,
  },
];

export const WhyChooseUs = () => {
  const [ref, inView] = useScrollAnimation();

  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.55,
        delay: i * 0.08,
        ease: [0.22, 1, 0.36, 1],
      },
    }),
  };

  return (
    <section
      ref={ref}
      className="relative border-y border-white/[0.06] bg-zinc-950 px-4 py-16 text-white sm:px-8 sm:py-20"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/35 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-12 -z-0 h-64 w-64 -translate-x-1/2 rounded-full bg-orange-500/[0.06] blur-[110px]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-orange-400/85 sm:text-[11px]">
            Made to live in
          </p>
          <h2 className="mt-3 text-2xl font-light tracking-tight text-white sm:text-3xl md:text-4xl">
            Comfort you can{" "}
            <span className="bg-gradient-to-r from-orange-300 to-amber-200 bg-clip-text font-medium italic text-transparent">
              keep
            </span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
            Cloth chosen for the way it feels — and a promise we stand behind
            long after you take it home.
          </p>
        </div>

        <div
          className="relative mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mt-14 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:pb-0"
          role="list"
        >
          {points.map(({ title, line, Icon }, i) => (
            <motion.article
              key={title}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              role="listitem"
              className="group relative snap-start shrink-0 basis-[82%] overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 p-6 backdrop-blur-sm transition-colors duration-300 hover:border-orange-500/25 sm:basis-auto sm:p-7"
            >
              <div
                className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-orange-500/[0.08] blur-2xl transition-opacity duration-500 group-hover:bg-orange-500/[0.16]"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
                aria-hidden
              />

              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-orange-500/25 bg-orange-500/[0.08] text-orange-300">
                <Icon className="h-5 w-5" strokeWidth={1.4} aria-hidden />
              </div>

              <h3 className="relative mt-5 text-lg font-medium tracking-tight text-white sm:text-xl">
                {title}
              </h3>
              <p className="relative mt-2 text-[13px] leading-relaxed text-zinc-400 sm:text-sm">
                {line}
              </p>
            </motion.article>
          ))}
        </div>

        <div
          className="mx-auto mt-10 hidden h-px w-24 bg-gradient-to-r from-transparent via-orange-500/45 to-transparent sm:block"
          aria-hidden
        />
      </div>
    </section>
  );
};

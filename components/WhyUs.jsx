"use client";

import React from "react";
import { Reveal } from "@/components/motion/Reveal";
import { Gem, RefreshCcw, Truck } from "lucide-react";

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
  return (
    <section
      className="relative border-y border-border bg-background px-4 py-16 text-foreground sm:px-8 sm:py-20"
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
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-brand sm:text-[11px]">
            Made to live in
          </p>
          <h2 className="mt-3 text-2xl font-light tracking-tight text-foreground sm:text-3xl md:text-4xl">
            Comfort you can{" "}
            <span className="bg-gradient-to-r from-brand to-brand bg-clip-text font-medium italic text-transparent">
              keep
            </span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Cloth chosen for the way it feels — and a promise we stand behind
            long after you take it home.
          </p>
        </Reveal>

        <div
          className="relative mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:mt-14 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:pb-0"
          role="list"
        >
          {points.map(({ title, line, Icon }, i) => (
            <Reveal as="article"
              key={title}
              delay={i * 60}
              role="listitem"
              className="group relative snap-start shrink-0 basis-[82%] overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card/80 to-background/80 p-6 backdrop-blur-sm transition-colors duration-300 hover:border-orange-500/25 sm:basis-auto sm:p-7"
            >
              <div
                className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-orange-500/[0.08] blur-2xl transition-opacity duration-500 group-hover:bg-orange-500/[0.16]"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
                aria-hidden
              />

              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-orange-500/25 bg-orange-500/[0.08] text-brand">
                <Icon className="h-5 w-5 motion-safe:transition-transform motion-safe:group-hover:scale-110" strokeWidth={1.4} aria-hidden />
              </div>

              <h3 className="relative mt-5 text-lg font-medium tracking-tight text-foreground sm:text-xl">
                {title}
              </h3>
              <p className="relative mt-2 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
                {line}
              </p>
            </Reveal>
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

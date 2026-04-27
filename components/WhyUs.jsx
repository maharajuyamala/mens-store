import React from "react";
import { motion } from "framer-motion";
import { Gem, Ruler, PackageCheck } from "lucide-react";
import { useScrollAnimation } from "./ShirtSection";

const points = [
  {
    title: "Fabric",
    line: "Milled for hand-feel and longevity.",
    Icon: Gem,
  },
  {
    title: "Fit",
    line: "Clear sizing — less guesswork.",
    Icon: Ruler,
  },
  {
    title: "Dispatch",
    line: "Checked, packed, tracked to you.",
    Icon: PackageCheck,
  },
];

export const WhyChooseUs = () => {
  const [ref, inView] = useScrollAnimation();

  return (
    <section
      ref={ref}
      className="border-y border-white/[0.06] bg-zinc-950 px-4 py-12 text-white sm:px-8 sm:py-14"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400/75">
          Why us
        </p>
        <h2 className="mt-2 text-xl font-light tracking-tight text-white sm:text-2xl">
          Quiet quality
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-zinc-500 sm:text-sm">
          Thoughtful cloth, honest fits, orders treated with care.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mt-9 max-w-2xl sm:mt-10"
      >
        <div className="grid divide-y divide-white/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:divide-white/[0.06]">
          {points.map(({ title, line, Icon }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-2 px-4 py-5 text-center sm:py-4 sm:first:pl-0 sm:last:pr-0"
            >
              <Icon
                className="h-4 w-4 text-orange-400/70"
                strokeWidth={1.25}
                aria-hidden
              />
              <p className="text-[13px] font-medium tracking-tight text-zinc-200">
                {title}
              </p>
              <p className="max-w-[11rem] text-[11px] leading-snug text-zinc-500 sm:max-w-none sm:text-xs">
                {line}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

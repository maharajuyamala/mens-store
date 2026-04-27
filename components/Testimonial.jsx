import React from "react";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { useScrollAnimation } from "./ShirtSection";

const locations = ["Alwal", "Balkampet", "Quthbullapur", "Manoharabad"];

export const Testimonials = () => {
  const [ref, inView] = useScrollAnimation();

  return (
    <section
      ref={ref}
      className="border-t border-white/[0.06] bg-zinc-950 px-4 py-16 text-white sm:px-8 sm:py-20"
    >
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-400/80">
            Community
          </p>
          <h2 className="mt-2 text-2xl font-light tracking-tight text-white sm:text-3xl">
            Multiple stores across Hyderabad
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-500 sm:text-[15px]">
            Second Skin is a brand built over many years — trusted fits, honest
            quality, and service you can walk up to. Find us in four neighbourhoods
            across the city.
          </p>
        </div>

        <motion.ul
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:grid-cols-4 sm:gap-4"
        >
          {locations.map((name) => (
            <li
              key={name}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-zinc-900/40 px-3 py-5 text-center transition-colors hover:border-orange-500/25 hover:bg-zinc-900/70 sm:py-6"
            >
              <MapPin
                className="h-4 w-4 text-orange-400/70"
                strokeWidth={1.35}
                aria-hidden
              />
              <span className="text-[13px] font-medium tracking-tight text-zinc-100 sm:text-sm">
                {name}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-zinc-600">
                Hyderabad
              </span>
            </li>
          ))}
        </motion.ul>

        <p className="mx-auto mt-10 max-w-md text-center text-xs leading-relaxed text-zinc-600 sm:mt-12 sm:text-sm">
          Same Second Skin standard — in store, across Alwal, Balkampet,
          Quthbullapur, and Manoharabad.
        </p>
      </div>
    </section>
  );
};

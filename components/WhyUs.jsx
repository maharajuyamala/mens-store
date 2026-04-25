import React from "react";
import { motion } from "framer-motion";
import { Gem, Scissors, Leaf } from "lucide-react";
import { useScrollAnimation } from "./ShirtSection";

const features = [
  {
    title: "Premium fabrics",
    description:
      "Sourced from trusted mills for comfort that lasts wash after wash.",
    Icon: Gem,
  },
  {
    title: "Modern tailoring",
    description:
      "Clean lines and considered fits — sharp without feeling stiff.",
    Icon: Scissors,
  },
  {
    title: "Sustainable practices",
    description:
      "Ethical production and lower-impact materials wherever we can.",
    Icon: Leaf,
  },
];

export const WhyChooseUs = () => {
  const [ref, inView] = useScrollAnimation();

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.15, delayChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <section
      ref={ref}
      className="relative border-t border-white/5 bg-zinc-900 px-4 py-20 text-white sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center sm:mb-16">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-orange-400/90">
            Why us
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            The SecondSkin difference
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-zinc-400">
            More than clothing — a quiet standard for how pieces should feel
            and wear.
          </p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          className="grid gap-6 md:grid-cols-3 md:gap-8"
        >
          {features.map(({ title, description, Icon }) => (
            <motion.div
              key={title}
              variants={itemVariants}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/60 p-8 shadow-xl transition-colors duration-300 hover:border-orange-500/25 hover:bg-zinc-900/80"
            >
              <div className="mb-5 inline-flex rounded-xl bg-orange-500/10 p-3 text-orange-400 ring-1 ring-orange-500/20 transition-transform duration-300 group-hover:scale-105">
                <Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-zinc-400 sm:text-base">
                {description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

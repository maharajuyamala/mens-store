import { useEffect, useState } from "react";
import React from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Quote } from "lucide-react";
import { useScrollAnimation } from "./ShirtSection";

const testimonials = [
  {
    id: 1,
    quote:
      "The quality is unparalleled. SecondSkin has become my go-to for statement pieces.",
    name: "Alex Thompson",
    role: "Fashion blogger",
    avatar:
      "https://placehold.co/100x100/ffffff/000000?text=AT",
  },
  {
    id: 2,
    quote:
      "Unique designs and attention to detail — every piece feels considered.",
    name: "David Chen",
    role: "Creative director",
    avatar:
      "https://placehold.co/100x100/ffffff/000000?text=DC",
  },
  {
    id: 3,
    quote:
      "Modern masculinity done right. The fit, fabric, and feel are spot on.",
    name: "Marcus Reid",
    role: "Entrepreneur",
    avatar:
      "https://placehold.co/100x100/ffffff/000000?text=MR",
  },
];

export const Testimonials = () => {
  const [ref, inView] = useScrollAnimation();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [inView]);

  const t = testimonials[currentIndex];

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-zinc-950 px-4 py-20 text-white sm:px-8 sm:py-28"
    >
      <div
        className="pointer-events-none absolute -right-20 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-orange-500/10 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-orange-400/90">
          Community
        </p>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          From our customers
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-zinc-400 sm:text-base">
          Real words from people who live in the pieces.
        </p>
      </div>

      <div className="relative mx-auto mt-14 min-h-[280px] max-w-2xl sm:min-h-[260px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-0 top-0 flex flex-col items-center rounded-2xl border border-white/10 bg-zinc-900/70 p-8 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-10"
          >
            <Quote
              className="mb-4 h-9 w-9 text-orange-500/40"
              strokeWidth={1.25}
              aria-hidden
            />
            <p className="mb-8 text-center text-lg leading-relaxed text-zinc-200 sm:text-xl">
              &ldquo;{t.quote}&rdquo;
            </p>
            <div className="flex flex-col items-center gap-1">
              <Image
                src={t.avatar}
                alt=""
                width={56}
                height={56}
                className="mb-3 h-14 w-14 rounded-full border-2 border-orange-500/50 object-cover ring-2 ring-white/10"
                unoptimized
              />
              <h4 className="font-semibold text-white">{t.name}</h4>
              <p className="text-sm text-orange-400/90">{t.role}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-10 flex justify-center gap-2">
        {testimonials.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCurrentIndex(index)}
            aria-label={`Show testimonial ${index + 1}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              currentIndex === index
                ? "w-8 bg-orange-500"
                : "w-2 bg-zinc-600 hover:bg-zinc-500"
            }`}
          />
        ))}
      </div>
    </section>
  );
};

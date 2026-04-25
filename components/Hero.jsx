"use client";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";

export const Hero = () => {
  const videoRef = useRef(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const attemptPlay = () => {
      videoElement.play().catch((error) => {
        console.error("Video autoplay was prevented:", error);
      });
    };

    videoElement.addEventListener("canplay", attemptPlay);
    if (videoElement.readyState >= 3) {
      attemptPlay();
    }

    return () => {
      videoElement.removeEventListener("canplay", attemptPlay);
    };
  }, []);

  return (
    <section className="relative flex min-h-[90svh] items-center justify-center overflow-hidden bg-zinc-950 text-center text-white">
      <div
        className="pointer-events-none absolute -left-1/4 top-0 h-[70%] w-[70%] rounded-full bg-orange-500/15 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-1/4 bottom-0 h-[50%] w-[50%] rounded-full bg-amber-400/10 blur-[100px]"
        aria-hidden
      />

      <video
        ref={videoRef}
        loop
        muted
        playsInline
        className="absolute left-1/2 top-0 z-0 max-w-none min-h-full min-w-full -translate-x-1/2 object-cover object-top opacity-35"
      >
        <source
          src="https://www.secondskinmensworld.com/shirts.mov"
          type="video/mp4"
        />
        Your browser does not support the video tag.
      </video>

      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-zinc-950/80 via-zinc-950/40 to-zinc-950" />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(249,115,22,0.12),transparent_55%)]" />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mx-auto max-w-4xl px-5 pt-16 sm:px-8"
      >
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.35em] text-orange-400/95 sm:text-xs">
          SecondSkin
        </p>
        <h1 className="mb-6 bg-gradient-to-b from-white via-white to-zinc-400 bg-clip-text text-5xl font-extrabold leading-[1.05] tracking-tight text-transparent sm:text-6xl md:text-7xl lg:text-8xl">
          Style redefined.
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg md:text-xl">
          Curated menswear where premium craftsmanship meets contemporary
          design — built to move with you.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
          <Link href="/explore" className="inline-flex">
            <motion.span
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-500/25 ring-1 ring-white/10 transition-shadow hover:shadow-orange-500/35"
            >
              Explore collection
              <ArrowRight className="h-5 w-5" aria-hidden />
            </motion.span>
          </Link>
          <Link
            href="/explore"
            className="text-sm font-medium text-zinc-300 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            View new arrivals
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 z-10 hidden -translate-x-1/2 sm:block"
        aria-hidden
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="flex flex-col items-center gap-1 text-zinc-500"
        >
          <span className="text-[10px] font-medium uppercase tracking-widest">
            Scroll
          </span>
          <ChevronDown className="h-5 w-5 opacity-70" />
        </motion.div>
      </motion.div>
    </section>
  );
};

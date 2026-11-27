import React from "react";
import { Reveal } from "@/components/motion/Reveal";
import { MapPin } from "lucide-react";

const locations = ["Alwal", "Balkampet", "Quthbullapur", "Manoharabad"];

export const Testimonials = () => {

  return (
    <section
      className="border-t border-border bg-background px-4 py-16 text-foreground sm:px-8 sm:py-20"
    >
      <div className="mx-auto max-w-4xl">
        <Reveal className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">
            Community
          </p>
          <h2 className="mt-2 text-2xl font-light tracking-tight text-foreground sm:text-3xl">
            Multiple stores across Hyderabad
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            Second Skin is a brand built over many years — trusted fits, honest
            quality, and service you can walk up to. Find us in four neighbourhoods
            across the city.
          </p>
        </Reveal>

        <ul
          className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:grid-cols-4 sm:gap-4"
        >
          {locations.map((name, index) => (
            <Reveal as="li"
              key={name}
              delay={index * 45}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card/40 px-3 py-5 text-center transition-colors hover:border-orange-500/25 hover:bg-card/70 sm:py-6"
            >
              <MapPin
                className="h-4 w-4 text-brand"
                strokeWidth={1.35}
                aria-hidden
              />
              <span className="text-[13px] font-medium tracking-tight text-foreground sm:text-sm">
                {name}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Hyderabad
              </span>
            </Reveal>
          ))}
        </ul>

        <p className="mx-auto mt-10 max-w-md text-center text-xs leading-relaxed text-muted-foreground sm:mt-12 sm:text-sm">
          Same Second Skin standard — in store, across Alwal, Balkampet,
          Quthbullapur, and Manoharabad.
        </p>
      </div>
    </section>
  );
};

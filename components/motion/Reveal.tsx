"use client";

import { createElement, useEffect, useRef, type ComponentPropsWithoutRef, type CSSProperties } from "react";

type Props = ComponentPropsWithoutRef<"div"> & {
  as?: "div" | "article" | "section" | "li" | "header";
  delay?: number;
};

/** Progressive enhancement: content is visible by default, including without JS.
 * Observe once with a shared observer, animate near the viewport, then unobserve.
 */
let sharedObserver: IntersectionObserver | undefined;
function getObserver() {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).dataset.motionReveal = "visible";
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08, rootMargin: "0px 0px -16px 0px" });
  }
  return sharedObserver;
}

export function Reveal({ as = "div", delay = 0, style, ...props }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = getObserver();
    observer.observe(node);
    return () => observer.unobserve(node);
  }, []);
  return createElement(as, {
    ...props,
    ref: (node: HTMLElement | null) => { ref.current = node; },
    style: { ...style, "--motion-delay": Math.min(Math.max(delay, 0), 180) + "ms" } as CSSProperties,
    "data-motion-reveal": "ready",
  });
}

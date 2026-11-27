"use client";

import { createElement, useEffect, useRef, type ComponentPropsWithoutRef, type CSSProperties } from "react";

type Props = ComponentPropsWithoutRef<"div"> & {
  as?: "div" | "article" | "section" | "li" | "header";
  delay?: number;
};

/** Progressive enhancement: content is visible by default, including without JS.
 * Observe once, animate only near the viewport, and disconnect immediately.
 */
export function Reveal({ as = "div", delay = 0, style, ...props }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      node.dataset.motionReveal = "visible";
      observer.disconnect();
    }, { threshold: 0.08, rootMargin: "0px 0px -16px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return createElement(as, {
    ...props,
    ref: (node: HTMLElement | null) => { ref.current = node; },
    style: { ...style, "--motion-delay": Math.min(Math.max(delay, 0), 180) + "ms" } as CSSProperties,
    "data-motion-reveal": "ready",
  });
}

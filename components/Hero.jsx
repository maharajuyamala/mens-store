"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import styles from "./HeroCarousel.module.css";

const campaigns = [
  { id: "men", label: "The menswear edit", title: "Wear it like a", accent: "second skin.", description: "Cloth chosen for the way it feels — quiet luxury for the way you actually live.", image: "/men-shirt.png", cta: "Explore men", href: "/explore?audience=men" },
  { id: "women", label: "The womenswear edit", title: "Quiet elegance.", accent: "Your way.", description: "Discover contemporary pieces and timeless silhouettes.", image: "/women-edit.webp", cta: "Explore women", href: "/explore?audience=women" },
  { id: "kids", label: "The kidswear edit", title: "Little moments.", accent: "Big style.", description: "Comfort-first looks for play, celebrations and everything in between.", image: "/kids-shirt.png", cta: "Explore kids", href: "/explore?audience=kids" },
];
const duration = 6500;

export function Hero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [desktopVideo, setDesktopVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const touch = useRef(null);
  const video = useRef(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const update = () => {
      setReduced(motion.matches);
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const slow = connection?.saveData || ["slow-2g", "2g", "3g"].includes(connection?.effectiveType);
      setDesktopVideo(desktop.matches && !motion.matches && !slow);
    };
    const visibility = () => setVisible(!document.hidden);
    update(); visibility();
    const listen = (media) => {
      if (media.addEventListener) { media.addEventListener("change", update); return () => media.removeEventListener("change", update); }
      media.addListener(update); return () => media.removeListener(update);
    };
    const offMotion = listen(motion);
    const offDesktop = listen(desktop);
    document.addEventListener("visibilitychange", visibility);
    return () => { offMotion(); offDesktop(); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  const running = !paused && !hover && !focusWithin && !reduced && visible;
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => setActive((i) => (i + 1) % campaigns.length), duration);
    return () => window.clearTimeout(id);
  }, [running, active]);

  useEffect(() => {
    const player = video.current;
    if (!player) return;
    if (desktopVideo && active === 0 && !paused && !reduced && visible) player.play().catch(() => {});
    else player.pause();
  }, [desktopVideo, active, paused, reduced, visible]);

  const move = (delta) => setActive((i) => (i + delta + campaigns.length) % campaigns.length);
  const onTouchStart = (event) => {
    if (event.touches.length !== 1 || event.target.closest("button, a")) { touch.current = null; return; }
    const point = event.touches[0];
    touch.current = { x: point.clientX, y: point.clientY };
  };
  const onTouchEnd = (event) => {
    const start = touch.current;
    touch.current = null;
    if (!start || !event.changedTouches.length) return;
    const point = event.changedTouches[0];
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.35) move(dx < 0 ? 1 : -1);
    else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) setPaused((value) => !value);
  };

  return (
    <section
      className={styles.hero}
      aria-label="SecondSkin featured collections"
      aria-roledescription="carousel"
      aria-describedby="hero-carousel-instructions"
      tabIndex={0}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") setHover(true); }}
      onPointerLeave={() => setHover(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false); }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => { touch.current = null; }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1);
        } else if (event.key === " ") {
          event.preventDefault(); setPaused((value) => !value);
        }
      }}
    >
      <h1 className="sr-only">SecondSkin — curated fashion for men, women and kids</h1>
      <p id="hero-carousel-instructions" className="sr-only">Swipe or use the left and right arrow keys to change collections. Tap the banner or press Space to toggle automatic rotation.</p>
      <div className={styles.stage}>
        {campaigns.map((campaign, index) => {
          const selected = index === active;
          return (
            <div key={campaign.id} className={styles.slide} data-active={selected} aria-hidden={!selected} inert={!selected}
              role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${campaigns.length}: ${campaign.label}`}>
              <div className={styles.photo}>
                <Image src={campaign.image} alt="" fill sizes="(max-width: 640px) 100vw, 100vw"
                  priority={index === 0} loading={index === 0 ? undefined : "lazy"} className={styles.image} />
                {index === 0 && desktopVideo && (
                  <video ref={video} muted loop playsInline preload="metadata" aria-hidden="true"
                    onCanPlay={() => setVideoReady(true)} onError={() => setVideoReady(false)}
                    className={styles.video} data-ready={videoReady}>
                    <source src="https://www.secondskinmensworld.in/shirts.mov" type="video/mp4" />
                  </video>
                )}
              </div>
              <div className={styles.copy}>
                <p className={styles.eyebrow}>SecondSkin · {campaign.label}</p>
                <h2 className={styles.title}>{campaign.title}{" "}<br className={styles.mobileBreak} /><em>{campaign.accent}</em></h2>
                <p className={styles.description}>{campaign.description}</p>
                <Link href={campaign.href} className={styles.cta} prefetch={false}>
                  {campaign.cta}<ArrowRight size={17} aria-hidden="true" />
                </Link>
                <ul className={styles.perks} aria-label="Shopping perks">
                  <li>Free shipping</li><li>7-day exchange</li><li>Cash on delivery</li>
                </ul>
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.scrollHint} aria-hidden="true">
        <span>Scroll</span><ChevronDown size={20} />
      </div>
      <span className="sr-only" aria-live={running ? "off" : "polite"}>{campaigns[active].label}{paused ? " — rotation paused" : ""}</span>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import styles from "./Hero.module.css";

export function Hero() {
  const [desktopVideo, setDesktopVideo] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const video = useRef(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const update = () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const slow = connection?.saveData || ["slow-2g", "2g", "3g"].includes(connection?.effectiveType);
      setDesktopVideo(desktop.matches && !motion.matches && !slow);
    };
    const visibility = () => setVisible(!document.hidden);
    update();
    visibility();
    const listen = (media) => {
      if (media.addEventListener) {
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
      }
      media.addListener(update);
      return () => media.removeListener(update);
    };
    const offMotion = listen(motion);
    const offDesktop = listen(desktop);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      offMotion();
      offDesktop();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    const player = video.current;
    if (!player) return;
    if (desktopVideo && visible) player.play().catch(() => {});
    else player.pause();
  }, [desktopVideo, visible]);

  return (
    <section className={styles.hero} aria-label="SecondSkin menswear collection">
      <div className={styles.stage}>
        <div className={styles.photo}>
          <Image src="/men-shirt.png" alt="" fill sizes="100vw" priority className={styles.image} />
          {desktopVideo && (
            <video ref={video} muted loop playsInline preload="metadata" aria-hidden="true"
              onCanPlay={() => setVideoReady(true)} onError={() => setVideoReady(false)}
              className={styles.video} data-ready={videoReady}>
              <source src="https://www.secondskinmensworld.in/shirts.mov" type="video/mp4" />
            </video>
          )}
        </div>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>SecondSkin · The menswear edit</p>
          <h1 className={styles.title}>Wear it like a{" "}<br className={styles.mobileBreak} /><em>second skin.</em></h1>
          <p className={styles.description}>Cloth chosen for the way it feels — quiet luxury for the way you actually live.</p>
          <Link href="/explore?audience=men" className={styles.cta} prefetch={false}>
            Explore men<ArrowRight size={17} aria-hidden="true" />
          </Link>
          <ul className={styles.perks} aria-label="Shopping perks">
            <li>Free shipping</li><li>7-day exchange</li><li>Cash on delivery</li>
          </ul>
        </div>
      </div>
      <div className={styles.scrollHint} aria-hidden="true">
        <span>Scroll</span><ChevronDown size={20} />
      </div>
    </section>
  );
}

"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Force every client-side navigation to land at the top of the page.
 *
 * Why this is needed: Next.js' built-in scroll restoration tries to be smart
 * (focuses the first heading, restores the previous offset on back-nav, etc.),
 * but our pages stream content (suspense fallbacks for product lists, related
 * grids, etc.) so the browser sometimes settles mid-page instead of at the
 * top. This component listens for any pathname or query-string change and
 * snaps the viewport back to (0, 0) on the next frame.
 *
 * Mounted once inside `<StoreChrome />` and once inside `<AdminShell />` so
 * both surfaces get the same behaviour.
 */
function ScrollToTopInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Defer to the next frame so the new route has actually painted before
    // we scroll. Without rAF the scroll fires before React has swapped the
    // tree and the browser undoes it.
    const id = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      // Some browsers (mainly mobile Safari) keep momentum scroll on
      // <html>/<body>; clear both so the snap actually sticks.
      if (document.scrollingElement) {
        document.scrollingElement.scrollTop = 0;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [pathname, searchParams]);

  return null;
}

/**
 * `useSearchParams` requires a Suspense boundary; wrap so consumers can mount
 * us in any layout without worrying about that.
 */
export function ScrollToTop() {
  return (
    <Suspense fallback={null}>
      <ScrollToTopInner />
    </Suspense>
  );
}

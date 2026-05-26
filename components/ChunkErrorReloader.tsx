"use client";

import { useEffect } from "react";

const RELOAD_FLAG = "mens-store-chunk-reload";

function isChunkError(message: string): boolean {
  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk \d+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

export function ChunkErrorReloader() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const tryReloadOnce = () => {
      try {
        if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;
        sessionStorage.setItem(RELOAD_FLAG, "1");
      } catch {
        // sessionStorage may be unavailable (private mode) — fall through.
      }
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => {
      const msg = e?.error?.message ?? e?.message ?? "";
      if (isChunkError(String(msg))) tryReloadOnce();
    };
    const onUnhandled = (e: PromiseRejectionEvent) => {
      const reason = e?.reason;
      const msg =
        typeof reason === "string"
          ? reason
          : reason?.message ?? String(reason ?? "");
      if (isChunkError(msg)) tryReloadOnce();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);

    // Clear the reload flag after a clean load so a *new* chunk failure later
    // can still trigger one reload attempt.
    const clearFlagTimer = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        // ignore
      }
    }, 5000);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
      window.clearTimeout(clearFlagTimer);
    };
  }, []);

  return null;
}

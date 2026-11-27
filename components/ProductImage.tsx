"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { ImageOff, Shirt } from "lucide-react";

type Props = Omit<ImageProps, "src" | "onLoad" | "onError" | "placeholder" | "blurDataURL"> & {
  src: string;
  compact?: boolean;
};

// Keep the existing Next.js optimizer allowlist intact. Invalid catalog URLs
// should render a placeholder instead of throwing during next/image rendering.
const remoteHosts = new Set([
  "ik.imagekit.io",
  "firebasestorage.googleapis.com",
  "lh3.googleusercontent.com",
  "thefoomer.in",
]);

function usableSource(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  if (/^data:image\//i.test(src) || src.startsWith("blob:")) return true;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && remoteHosts.has(url.hostname) && !url.port;
  } catch {
    return false;
  }
}

export function ProductImagePlaceholder({
  loading = false,
  compact = false,
}: { loading?: boolean; compact?: boolean }) {
  const Icon = loading ? Shirt : ImageOff;
  return (
    <div
      data-product-image-placeholder
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden bg-[#e8e4de] px-2 text-center text-[#66594b]"
      role="img"
      aria-label={loading ? "Product photo loading" : "Product photo unavailable"}
    >
      <Icon aria-hidden="true" className={compact ? "size-5" : "size-9 stroke-[1.25] sm:size-12"} />
      {!compact && (
        <>
          <span aria-hidden="true" className="text-[10px] font-semibold uppercase tracking-[0.18em]">SecondSkin</span>
          <span aria-hidden="true" className="text-[11px] leading-snug">{loading ? "Loading photo…" : "Photo unavailable"}</span>
        </>
      )}
    </div>
  );
}

function ImageWithStatus({ src, compact, style, ...props }: Props) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  if (!usableSource(src) || status === "error") {
    return <ProductImagePlaceholder compact={compact} />;
  }
  return (
    <>
      {status !== "loaded" && <ProductImagePlaceholder loading compact={compact} />}
      <Image
        {...props}
        src={src}
        style={{ ...style, opacity: status === "loaded" ? 1 : 0 }}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </>
  );
}

/** A new source gets its own loading/error state; never retry a broken URL in a loop. */
export function ProductImage(props: Props) {
  return <ImageWithStatus key={props.src} {...props} />;
}

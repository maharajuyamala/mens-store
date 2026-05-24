"use client";

/**
 * Printable sheet of per-variant QR labels.
 *
 * Each (color × size) combination of a product gets its own small label with:
 *   - price
 *   - product name
 *   - variant label ("Wine red · M")
 *   - QR encoding a deep link `…/admin/inventory/scan?product=&color=&size=`
 *
 * Cashier prints the sheet once and snips out the labels they need. Sizing is
 * tuned so labels stay readable when sliced into ~2 in stickers.
 *
 * When the product has no per-color sizing yet (legacy data with only one
 * implicit variant), we fall back to a single product-level QR so the sheet
 * remains useful.
 */

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { productScanStockUrl } from "@/lib/barcode/payload";
import {
  parseColorVariants,
  variantLabel,
  type ColorVariant,
} from "@/lib/products/color-variants";
import { inr } from "@/lib/utils";

export type VariantQrSheetProps = {
  productId: string;
  productName: string;
  price: number;
  /**
   * Raw product doc (or a partial that includes `colorVariants`). The grid
   * is derived from this. Pass the same object you'd persist to Firestore.
   */
  productData?: Record<string, unknown> | null;
  /**
   * Optional override: explicit list of variants to render. Useful right
   * after `addDoc` when the doc isn't fetched back yet.
   */
  variants?: ColorVariant[];
};

type Combo = {
  key: string;
  color: string;
  colorLabel: string;
  size: string;
  qty: number;
};

function buildCombos(variants: ColorVariant[]): Combo[] {
  const out: Combo[] = [];
  for (const v of variants) {
    const label = variantLabel(v);
    const entries = Object.entries(v.sizes ?? {});
    if (entries.length === 0) {
      // No per-size stock yet — still render one QR per color so the cashier
      // can label a hanging swatch.
      out.push({
        key: `${v.color}::__`,
        color: v.color,
        colorLabel: label,
        size: "",
        qty: 0,
      });
      continue;
    }
    for (const [size, qty] of entries) {
      out.push({
        key: `${v.color}::${size}`,
        color: v.color,
        colorLabel: label,
        size,
        qty: Number(qty) || 0,
      });
    }
  }
  return out;
}

function QrThumb({ url, size = 128 }: { url: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url, size]);
  if (!src) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed border-border text-[10px] text-muted-foreground"
        style={{ width: size, height: size }}
      >
        …
      </div>
    );
  }
  // Plain <img> so we can `unoptimized` it cleanly inside a print sheet.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} />;
}

export function VariantQrSheet({
  productId,
  productName,
  price,
  productData,
  variants: explicitVariants,
}: VariantQrSheetProps) {
  const variants = useMemo<ColorVariant[]>(() => {
    if (explicitVariants && explicitVariants.length > 0) {
      return explicitVariants;
    }
    if (productData) return parseColorVariants(productData);
    return [];
  }, [explicitVariants, productData]);

  const combos = useMemo(() => buildCombos(variants), [variants]);
  const hasCombos = combos.length > 0;

  // Fallback: legacy product with no variants — one big QR for the product.
  if (!hasCombos) {
    const url = productScanStockUrl(productId);
    return (
      <div
        id="variant-qr-print-root"
        className="space-y-4 rounded-xl border border-border bg-background p-4 text-foreground print:rounded-none print:border-0 print:p-0"
      >
        <header className="text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Single product QR
          </p>
          <h3 className="mt-1 truncate text-lg font-semibold">
            {productName}
          </h3>
          <p className="text-sm font-medium text-orange-500">
            {inr.format(price)}
          </p>
        </header>
        <div className="flex justify-center">
          <QrThumb url={url} size={200} />
        </div>
        <p className="break-all text-center font-mono text-[10px] leading-snug text-muted-foreground">
          {url}
        </p>
      </div>
    );
  }

  return (
    <div
      id="variant-qr-print-root"
      className="space-y-4 rounded-xl border border-border bg-background p-4 text-foreground print:rounded-none print:border-0 print:p-0"
    >
      <header className="text-center print:hidden">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {combos.length} QR label{combos.length === 1 ? "" : "s"} —{" "}
          one per color × size
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Print this sheet and snip out the labels you need.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 print:grid-cols-3 sm:grid-cols-3">
        {combos.map((c) => {
          const url = productScanStockUrl(productId, {
            color: c.color,
            size: c.size,
          });
          return (
            <div
              key={c.key}
              className="variant-qr-label flex flex-col items-center gap-1 rounded-lg border border-border bg-background px-2 py-2 text-center print:gap-0.5 print:rounded-md print:border print:border-black print:px-1.5 print:py-1.5"
            >
              <p className="w-full truncate text-[11px] font-semibold leading-tight text-foreground print:text-[8pt] print:text-black">
                {productName}
              </p>
              <p className="text-[18px] font-bold leading-none tabular-nums text-foreground print:text-[12pt] print:text-black">
                {inr.format(price)}
              </p>
              <QrThumb url={url} size={104} />
              <p className="w-full truncate text-[10px] font-medium leading-tight text-foreground print:text-[7pt] print:text-black">
                {c.colorLabel}
                {c.size ? ` · ${c.size}` : ""}
              </p>
              {c.qty > 0 ? (
                <p className="text-[9px] text-muted-foreground print:text-[6pt] print:text-black/60">
                  {c.qty} in stock
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

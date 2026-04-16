import type { CSSProperties } from "react";
import {
  colorSwatchByValue,
  QUICK_ADD_COLOR_SWATCHES,
} from "@/lib/add-product/quick-add-options";
import { swatchColor } from "@/lib/explore/color-swatches";

const MULTI_PRINT_BG =
  "conic-gradient(from 45deg, #e53935, #fbc02d, #43a047, #1e88e5, #ab47bc, #e53935)";

/** All color names on the product (`colors[]`, or legacy single `color`). */
export function listProductColors(data: Record<string, unknown>): string[] {
  const arr = data.colors;
  if (Array.isArray(arr)) {
    const out = arr
      .map((c) => String(c).trim())
      .filter((s) => s.length > 0);
    return [...new Set(out)];
  }
  const single = data.color;
  if (typeof single === "string" && single.trim()) {
    return [single.trim()];
  }
  return [];
}

/** Inline style for a small round swatch from catalog / quick-add / fallback. */
export function productColorSwatchStyle(
  displayName: string,
  data: Record<string, unknown>
): CSSProperties {
  const low = displayName.toLowerCase();
  if (
    low === "multi / print" ||
    low === "multi-print" ||
    displayName === "multi-print"
  ) {
    return { background: MULTI_PRINT_BG };
  }
  const cv = data.colorValue;
  if (typeof cv === "string" && cv) {
    const hit = colorSwatchByValue(cv);
    if (hit) return { backgroundColor: hit.hex };
  }
  const byLabel = QUICK_ADD_COLOR_SWATCHES.find(
    (c) => c.label.toLowerCase() === low
  );
  if (byLabel) return { backgroundColor: byLabel.hex };
  return { backgroundColor: swatchColor(displayName) };
}

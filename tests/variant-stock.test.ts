import { describe, it, expect } from "vitest";
import {
  decrementVariantStock,
  incrementVariantStock,
  decrementLegacyStock,
  hasVariantStock,
  VariantStockError,
} from "@/lib/products/variant-stock-write";

function variantProduct() {
  return {
    colorVariants: [
      { color: "wine", images: ["a.jpg"], sizes: { M: 2, L: 1 } },
      { color: "navy", images: ["b.jpg"], sizes: { M: 0, L: 3 } },
    ],
  };
}

describe("hasVariantStock", () => {
  it("detects variant-aware products", () => {
    expect(hasVariantStock(variantProduct())).toBe(true);
    expect(hasVariantStock({ stock: 5 })).toBe(false);
  });
});

describe("decrementVariantStock", () => {
  it("decrements the exact (color,size) cell", () => {
    const patch = decrementVariantStock(variantProduct(), [{ color: "wine", size: "M", quantity: 1 }]) as {
      colorVariants: { color: string; sizes: Record<string, number> }[];
      stock: number;
    };
    const wine = patch.colorVariants.find((v) => v.color === "wine")!;
    expect(wine.sizes.M).toBe(1);
    expect(patch.stock).toBe(5); // 1 + 1 + 0 + 3
  });

  it("throws on insufficient stock", () => {
    expect(() =>
      decrementVariantStock(variantProduct(), [{ color: "wine", size: "M", quantity: 5 }])
    ).toThrow(VariantStockError);
  });

  it("throws when the color no longer exists", () => {
    expect(() =>
      decrementVariantStock(variantProduct(), [{ color: "teal", size: "M", quantity: 1 }])
    ).toThrow(/no longer available/i);
  });
});

describe("incrementVariantStock (restore)", () => {
  it("is the inverse of a decrement", () => {
    const afterDec = decrementVariantStock(variantProduct(), [{ color: "wine", size: "M", quantity: 1 }]) as {
      colorVariants: { color: string; sizes: Record<string, number> }[];
      stock: number;
    };
    const restored = incrementVariantStock(afterDec, [{ color: "wine", size: "M", quantity: 1 }]) as {
      colorVariants: { color: string; sizes: Record<string, number> }[];
      stock: number;
    };
    const wine = restored.colorVariants.find((v) => v.color === "wine")!;
    expect(wine.sizes.M).toBe(2);
    expect(restored.stock).toBe(6);
  });

  it("skips a color that no longer exists (tolerant restore)", () => {
    const patch = incrementVariantStock(variantProduct(), [{ color: "teal", size: "M", quantity: 1 }]) as {
      stock: number;
    };
    expect(patch.stock).toBe(6); // unchanged total
  });
});

describe("decrementLegacyStock", () => {
  it("decrements a per-size map", () => {
    const patch = decrementLegacyStock({ sizes: { M: 3, L: 2 } }, [{ color: "", size: "M", quantity: 2 }]) as {
      sizes: Record<string, number>;
      stock: number;
    };
    expect(patch.sizes.M).toBe(1);
    expect(patch.stock).toBe(3);
  });

  it("decrements an aggregate stock when no size map exists", () => {
    const patch = decrementLegacyStock({ stock: 10 }, [{ color: "", size: "", quantity: 3 }]) as {
      stock: number;
    };
    expect(patch.stock).toBe(7);
  });

  it("throws when aggregate stock is insufficient", () => {
    expect(() =>
      decrementLegacyStock({ stock: 1 }, [{ color: "", size: "", quantity: 3 }])
    ).toThrow(VariantStockError);
  });
});

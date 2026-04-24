"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, Search, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { ExploreProductCard } from "@/components/explore/ExploreProductCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { swatchColor } from "@/lib/explore/color-swatches";
import { inr } from "@/lib/utils";
import {
  categoryFilterOptions,
  EXPLORE_SIZES,
  filterExploreProducts,
  sortExploreProducts,
  uniqueColors,
  type ExploreFilterInput,
} from "@/lib/explore/filters";
import {
  priceBounds,
  type ExploreProduct,
  type SortMode,
} from "@/lib/explore/types";
import { cn } from "@/lib/utils";
import { useCartDrawerStore } from "@/store/cartDrawerStore";
import { useCartStore } from "@/store/cartStore";
import { toast } from "sonner";

const RecentlyViewedSection = dynamic(
  () =>
    import("@/components/RecentlyViewedSection").then(
      (m) => m.RecentlyViewedSection
    ),
  { ssr: false, loading: () => null }
);

function parseListParam(sp: URLSearchParams, key: string): string[] {
  return (
    sp
      .get(key)
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? []
  );
}

function parsePriceRange(
  sp: URLSearchParams,
  bounds: [number, number]
): [number, number] {
  const raw = sp.get("price");
  if (!raw) return bounds;
  const parts = raw.split(/[,-]/).map((x) => Number.parseFloat(x.trim()));
  if (
    parts.length >= 2 &&
    parts.every((n) => !Number.isNaN(n)) &&
    parts[0] !== undefined &&
    parts[1] !== undefined
  ) {
    const a = Math.min(parts[0], parts[1]);
    const b = Math.max(parts[0], parts[1]);
    return [a, b];
  }
  return bounds;
}

function parseSort(sp: URLSearchParams): SortMode {
  const s = sp.get("sort");
  if (
    s === "newest" ||
    s === "price-asc" ||
    s === "price-desc" ||
    s === "match"
  ) {
    return s;
  }
  return "newest";
}

export function ExploreShell() {
  return (
    <div className="min-h-screen bg-black pb-16 pt-28 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Skeleton className="mx-auto mb-4 h-10 w-72 rounded-lg bg-gray-800" />
        <Skeleton className="mx-auto mb-10 h-6 w-96 max-w-full rounded-md bg-gray-800" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="aspect-[3/4] rounded-2xl bg-gray-800"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FiltersBlock({
  products,
  searchParams,
  replaceQuery,
  sliderValue,
  onSliderChange,
  onPriceCommit,
  bounds,
  className,
}: {
  products: ExploreProduct[];
  searchParams: URLSearchParams;
  replaceQuery: (fn: (p: URLSearchParams) => void) => void;
  sliderValue: [number, number];
  onSliderChange: (v: number[]) => void;
  onPriceCommit: (v: number[]) => void;
  bounds: [number, number];
  className?: string;
}) {
  const spKey = searchParams.toString();
  const categoriesSel = useMemo(
    () => parseListParam(searchParams, "category").map((c) => c.toLowerCase()),
    [spKey, searchParams]
  );
  const sizesSel = useMemo(
    () =>
      parseListParam(searchParams, "size").map((s) => s.trim().toUpperCase()),
    [spKey, searchParams]
  );
  const colorsSel = useMemo(
    () => parseListParam(searchParams, "color").map((c) => c.toLowerCase()),
    [spKey, searchParams]
  );
  const inStockOnly = searchParams.get("inStock") === "1";

  const catOptions = useMemo(
    () => categoryFilterOptions(products),
    [products]
  );
  const colorOptions = useMemo(() => uniqueColors(products), [products]);

  const toggleList = (
    key: "category" | "size" | "color",
    value: string,
    normalize: (s: string) => string
  ) => {
    const norm = normalize(value);
    const current = parseListParam(searchParams, key).map(normalize);
    const next = current.includes(norm)
      ? current.filter((x) => x !== norm)
      : [...current, norm];
    replaceQuery((p) => {
      if (next.length) p.set(key, next.join(","));
      else p.delete(key);
    });
  };

  return (
    <div className={cn("space-y-8", className)}>
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Filter className="h-4 w-4 text-orange-500" />
          Category
        </h3>
        <div className="flex flex-col gap-2">
          {catOptions.map((c) => (
            <label
              key={c}
              className="flex cursor-pointer items-center gap-2 text-sm text-gray-300"
            >
              <Checkbox
                checked={categoriesSel.includes(c)}
                onCheckedChange={() =>
                  toggleList("category", c, (s) => s.toLowerCase())
                }
              />
              <span className="capitalize">{c}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">Size</h3>
        <div className="flex flex-col gap-2">
          {EXPLORE_SIZES.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 text-sm text-gray-300"
            >
              <Checkbox
                checked={sizesSel.includes(s)}
                onCheckedChange={() =>
                  toggleList("size", s, (x) => x.trim().toUpperCase())
                }
              />
              {s}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-white">Price</h3>
        <div className="px-1 pt-2 pb-4">
          <Slider
            value={sliderValue}
            min={bounds[0]}
            max={bounds[1]}
            step={1}
            minStepsBetweenThumbs={1}
            onValueChange={onSliderChange}
            onValueCommit={onPriceCommit}
            className="w-full"
          />
          <div className="mt-2 flex justify-between text-xs text-gray-400">
            <span>{inr.format(sliderValue[0] ?? bounds[0])}</span>
            <span>{inr.format(sliderValue[1] ?? bounds[1])}</span>
          </div>
        </div>
      </div>

      {colorOptions.length > 0 ? (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-white">Color</h3>
          <div className="flex flex-wrap gap-2">
            {colorOptions.map((c) => {
              const on = colorsSel.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() =>
                    toggleList("color", c, (x) => x.toLowerCase())
                  }
                  className={cn(
                    "size-9 rounded-full border-2 transition-transform hover:scale-105",
                    on
                      ? "border-orange-500 ring-2 ring-orange-500/40"
                      : "border-gray-600"
                  )}
                  style={{ backgroundColor: swatchColor(c) }}
                  aria-label={c}
                  aria-pressed={on}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-900/80 px-3 py-3">
        <Label htmlFor="in-stock-only" className="text-sm text-gray-300">
          In stock only
        </Label>
        <Switch
          id="in-stock-only"
          checked={inStockOnly}
          onCheckedChange={(checked) =>
            replaceQuery((p) => {
              if (checked) p.set("inStock", "1");
              else p.delete("inStock");
            })
          }
        />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full border-gray-600 text-gray-200 hover:bg-gray-800"
        onClick={() =>
          replaceQuery((p) => {
            p.delete("category");
            p.delete("size");
            p.delete("color");
            p.delete("price");
            p.delete("inStock");
          })
        }
      >
        Clear filters
      </Button>
    </div>
  );
}

function ExploreCatalog({
  initialProducts,
}: {
  initialProducts: ExploreProduct[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const spKey = searchParams.toString();

  const products = initialProducts;
  const loading = false;
  const [searchDraft, setSearchDraft] = useState(
    () => searchParams.get("q") ?? ""
  );
  const [sliderValue, setSliderValue] = useState<[number, number]>([0, 500]);

  const bounds = useMemo(() => priceBounds(products), [products]);

  const replaceQuery = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const p = new URLSearchParams(searchParams.toString());
      mutate(p);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const priceFromUrl = useMemo(
    () => parsePriceRange(searchParams, bounds),
    [spKey, searchParams, bounds]
  );

  useEffect(() => {
    setSliderValue(priceFromUrl);
  }, [priceFromUrl[0], priceFromUrl[1], bounds[0], bounds[1]]);

  const qParam = searchParams.get("q") ?? "";
  useEffect(() => {
    setSearchDraft(qParam);
  }, [qParam]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const trimmed = searchDraft.trim();
      if (trimmed === (searchParams.get("q") ?? "").trim()) return;
      replaceQuery((p) => {
        if (trimmed) p.set("q", trimmed);
        else p.delete("q");
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [searchDraft, replaceQuery, searchParams]);

  const sort = useMemo(() => parseSort(searchParams), [spKey, searchParams]);

  const filterInput: ExploreFilterInput = useMemo(() => {
    const [pMin, pMax] = parsePriceRange(searchParams, bounds);
    return {
      categories: parseListParam(searchParams, "category").map((c) =>
        c.toLowerCase()
      ),
      sizes: parseListParam(searchParams, "size").map((s) =>
        s.trim().toUpperCase()
      ),
      colors: parseListParam(searchParams, "color").map((c) =>
        c.toLowerCase()
      ),
      priceMin: pMin,
      priceMax: pMax,
      inStockOnly: searchParams.get("inStock") === "1",
      sort,
      query: searchParams.get("q") ?? "",
    };
  }, [spKey, searchParams, bounds, sort]);

  const visible = useMemo(() => {
    const filtered = filterExploreProducts(products, filterInput);
    return sortExploreProducts(filtered, sort, filterInput.query);
  }, [products, filterInput, sort]);

  const addItem = useCartStore((s) => s.addItem);
  const setCartOpen = useCartDrawerStore((s) => s.setOpen);

  const onQuickAdd = useCallback(
    (p: ExploreProduct) => {
      if (p.stockStatus === "out_of_stock") {
        toast.error("Out of stock", { description: p.name });
        return;
      }
      const size = p.sizes.length > 0 ? p.sizes[0]! : "";
      const color = p.colors.length > 0 ? p.colors[0]! : "";
      addItem({
        productId: p.doc_id,
        name: p.name,
        image: p.image,
        price: p.price,
        size,
        color,
        quantity: 1,
      });
      toast.success("Added to cart", { description: p.name });
      setCartOpen(true);
    },
    [addItem, setCartOpen]
  );

  const onPriceCommit = (v: number[]) => {
    if (v.length < 2) return;
    const a = Math.min(v[0]!, v[1]!);
    const b = Math.max(v[0]!, v[1]!);
    replaceQuery((p) => {
      if (a <= bounds[0] && b >= bounds[1]) p.delete("price");
      else p.set("price", `${Math.round(a)},${Math.round(b)}`);
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-black pb-24 text-white"
    >
      <div className="mx-auto max-w-7xl px-4 pt-28 sm:px-6">
        <div className="mb-10 text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
            SecondSkin
          </p>
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
            Explore the Collection
          </h1>
          <p className="text-sm text-gray-400 sm:text-base">
            Find your next signature piece.
          </p>
          <div className="relative mx-auto mt-6 max-w-lg">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              placeholder="Search products…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              className="w-full rounded-full border border-gray-700/80 bg-gray-900 py-3 pl-11 pr-4 text-sm text-white placeholder:text-gray-600 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
              aria-label="Search products"
            />
          </div>
        </div>

        <RecentlyViewedSection variant="dark" />

        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-32 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
              <h2 className="mb-4 text-lg font-semibold">Filters</h2>
              {products.length > 0 ? (
                <FiltersBlock
                  products={products}
                  searchParams={searchParams}
                  replaceQuery={replaceQuery}
                  sliderValue={sliderValue}
                  onSliderChange={(v) =>
                    setSliderValue([v[0] ?? bounds[0], v[1] ?? bounds[1]])
                  }
                  onPriceCommit={onPriceCommit}
                  bounds={bounds}
                />
              ) : (
                <p className="text-sm text-gray-500">No products yet.</p>
              )}
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-full border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-800 hover:text-white lg:hidden"
                  >
                    <SlidersHorizontal className="mr-2 h-4 w-4 text-orange-500" />
                    Filters
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-[min(100%,360px)] border-gray-800 bg-gray-950 text-white"
                >
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
                    {products.length > 0 ? (
                      <FiltersBlock
                        products={products}
                        searchParams={searchParams}
                        replaceQuery={replaceQuery}
                        sliderValue={sliderValue}
                        onSliderChange={(v) =>
                          setSliderValue([
                            v[0] ?? bounds[0],
                            v[1] ?? bounds[1],
                          ])
                        }
                        onPriceCommit={onPriceCommit}
                        bounds={bounds}
                      />
                    ) : null}
                  </div>
                </SheetContent>
              </Sheet>

              <div className="flex flex-1 items-center justify-end gap-2">
                <Label htmlFor="explore-sort" className="sr-only">
                  Sort
                </Label>
                <Select
                  value={sort}
                  onValueChange={(v) =>
                    replaceQuery((p) => {
                      if (v === "newest") p.delete("sort");
                      else p.set("sort", v);
                    })
                  }
                >
                  <SelectTrigger
                    id="explore-sort"
                    className="w-full rounded-full border-gray-700 bg-gray-900 text-sm text-white sm:w-[180px]"
                  >
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent className="border-gray-700 bg-gray-900 text-white">
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price-asc">Price: low to high</SelectItem>
                    <SelectItem value="price-desc">Price: high to low</SelectItem>
                    <SelectItem value="match">Best match</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/40 px-6 py-20 text-center">
                <p className="text-xl font-semibold text-gray-200">
                  No products match these filters
                </p>
                <p className="mt-2 text-gray-500">
                  Try clearing a filter, widening the price range, or searching
                  with a different term. Shareable links keep your filters in the
                  URL — tweak and send again.
                </p>
                <Button
                  type="button"
                  className="mt-6 bg-orange-600 hover:bg-orange-500"
                  onClick={() =>
                    replaceQuery((p) => {
                      p.delete("category");
                      p.delete("size");
                      p.delete("color");
                      p.delete("price");
                      p.delete("inStock");
                      p.delete("q");
                      p.delete("sort");
                    })
                  }
                >
                  Reset all filters
                </Button>
              </div>
            ) : (
              <motion.div
                layout
                className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-5"
              >
                {visible.map((p, i) => (
                  <ExploreProductCard
                    key={p.doc_id}
                    product={p}
                    onQuickAdd={onQuickAdd}
                    imagePriority={i < 6}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ExplorePageClient({
  initialProducts,
}: {
  initialProducts: ExploreProduct[];
}) {
  return (
    <Suspense fallback={<ExploreShell />}>
      <ExploreCatalog initialProducts={initialProducts} />
    </Suspense>
  );
}

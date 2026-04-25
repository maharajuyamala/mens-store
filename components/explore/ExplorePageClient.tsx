"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, ListFilter, Search, Sparkles } from "lucide-react";
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
  SheetDescription,
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

/** Number of “filter groups” active (for badge on filter trigger). */
function countActiveExploreFilters(
  sp: URLSearchParams,
  bounds: [number, number]
): number {
  let n = 0;
  if (parseListParam(sp, "category").length > 0) n++;
  if (parseListParam(sp, "size").length > 0) n++;
  if (parseListParam(sp, "color").length > 0) n++;
  const [lo, hi] = parsePriceRange(sp, bounds);
  if (lo > bounds[0] || hi < bounds[1]) n++;
  if (sp.get("inStock") === "1") n++;
  return n;
}

export function ExploreShell() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 pb-24 pt-28 text-white">
      <div
        className="pointer-events-none absolute left-1/4 top-0 h-[40vh] w-[50vw] -translate-x-1/2 rounded-full bg-orange-500/8 blur-[100px]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-8 max-w-xl space-y-3 text-center">
          <Skeleton className="mx-auto h-3 w-24 rounded-full bg-zinc-800" />
          <Skeleton className="mx-auto h-12 w-full max-w-md rounded-xl bg-zinc-800/90" />
          <Skeleton className="mx-auto h-4 w-3/4 max-w-sm rounded-md bg-zinc-800/70" />
        </div>
        <Skeleton className="mx-auto mb-10 h-12 max-w-3xl rounded-2xl bg-zinc-800/60" />
        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              className="aspect-[3/4] rounded-2xl bg-zinc-800/80 ring-1 ring-white/5"
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

  const sectionTitle =
    "mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400";

  return (
    <div className={cn("space-y-0 divide-y divide-zinc-800/70", className)}>
      <div className="pb-6">
        <h3 className={sectionTitle}>
          <Filter className="h-3.5 w-3.5 text-orange-500" aria-hidden />
          Category
        </h3>
        <div className="flex flex-col gap-1">
          {catOptions.map((c) => (
            <label
              key={c}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5 text-sm text-zinc-200 transition-colors hover:bg-white/5"
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

      <div className="pb-6 pt-6">
        <h3 className={sectionTitle}>Size</h3>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3">
          {EXPLORE_SIZES.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-zinc-200 transition-colors hover:bg-white/5"
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

      <div className="pb-6 pt-6">
        <h3 className={sectionTitle}>Price range</h3>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-3 py-4">
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
          <div className="mt-3 flex justify-between font-medium tabular-nums text-xs text-zinc-400">
            <span>{inr.format(sliderValue[0] ?? bounds[0])}</span>
            <span>{inr.format(sliderValue[1] ?? bounds[1])}</span>
          </div>
        </div>
      </div>

      {colorOptions.length > 0 ? (
        <div className="pb-6 pt-6">
          <h3 className={sectionTitle}>Color</h3>
          <div className="flex flex-wrap gap-2.5">
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
                    "size-10 rounded-full border-2 shadow-inner transition-transform hover:scale-105 active:scale-95",
                    on
                      ? "border-orange-500 ring-2 ring-orange-500/35"
                      : "border-zinc-600 hover:border-zinc-500"
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

      <div className="pb-6 pt-6">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/90 bg-gradient-to-r from-zinc-900/80 to-zinc-900/40 px-4 py-3.5">
          <Label
            htmlFor="in-stock-only"
            className="text-sm font-medium text-zinc-200"
          >
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
      </div>

      <div className="pt-6 pb-1">
        <Button
          type="button"
          variant="outline"
          className="w-full border-zinc-700 bg-transparent text-zinc-200 hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-white"
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
          Clear all filters
        </Button>
      </div>
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

  const activeFilterCount = useMemo(
    () => countActiveExploreFilters(searchParams, bounds),
    [spKey, searchParams, bounds]
  );

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
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative min-h-screen overflow-x-hidden bg-zinc-950 pb-28 text-white"
    >
      <div
        className="pointer-events-none absolute -left-32 top-24 h-72 w-72 rounded-full bg-orange-500/12 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-0 top-[40%] h-96 w-96 translate-x-1/3 rounded-full bg-amber-400/8 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.4)_100%)] opacity-40"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 pt-28 sm:px-6">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 text-center sm:mb-12"
        >
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-orange-400/95">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            SecondSkin
          </p>
          <h1 className="mx-auto max-w-4xl bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-3xl font-extrabold leading-[1.08] tracking-tight text-transparent md:text-5xl lg:text-6xl">
            Explore the collection
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-zinc-400 sm:text-base">
            Curated pieces — search, sort, and filter until something feels
            exactly right.
          </p>
          <div className="mx-auto mt-3 h-px w-16 bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mb-6 w-full max-w-3xl sm:mb-12"
        >
          <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-1.5 shadow-xl shadow-black/20 backdrop-blur-md sm:p-2">
            <div className="flex flex-row items-stretch gap-2 sm:gap-3">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 sm:left-4"
                  aria-hidden
                />
                <input
                  type="search"
                  placeholder="Search by name, style…"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-700/50 bg-zinc-950/80 py-2.5 pl-10 pr-3 text-sm text-white shadow-inner placeholder:text-zinc-500 transition-all focus:border-orange-500/45 focus:outline-none focus:ring-2 focus:ring-orange-500/20 sm:pl-11 sm:pr-4"
                  aria-label="Search products"
                />
              </div>

              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label="Open filters"
                    className="relative flex h-11 min-w-11 shrink-0 items-center justify-center gap-0 rounded-xl border-orange-500/25 bg-gradient-to-b from-zinc-800/90 to-zinc-900/90 px-3 text-sm font-semibold text-zinc-100 shadow-sm transition-all hover:border-orange-500/45 hover:from-zinc-800 hover:to-zinc-900 hover:shadow-orange-500/10 sm:min-w-[120px] sm:justify-start sm:gap-2 sm:px-4"
                  >
                    <ListFilter
                      className="h-4 w-4 shrink-0 text-orange-400"
                      aria-hidden
                    />
                    <span className="hidden sm:inline">Filters</span>
                    {activeFilterCount > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold leading-none text-white shadow-lg shadow-orange-500/30 ring-2 ring-zinc-950">
                        {activeFilterCount > 9 ? "9+" : activeFilterCount}
                      </span>
                    ) : null}
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="flex h-full w-full max-w-[min(100vw,420px)] flex-col gap-0 border-l border-zinc-800/90 bg-zinc-950/98 p-0 text-white shadow-2xl shadow-black/60 backdrop-blur-xl sm:max-w-md"
                >
                  <SheetHeader className="shrink-0 space-y-1.5 border-b border-zinc-800/90 bg-zinc-950/50 px-6 pb-5 pt-7 pr-14 text-left">
                    <SheetTitle className="text-xl font-semibold tracking-tight text-white">
                      Filters
                    </SheetTitle>
                    <SheetDescription className="text-left text-sm leading-relaxed text-zinc-500">
                      Refine by category, size, price, color, and availability.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-6 pb-10">
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
                    ) : (
                      <p className="text-sm text-zinc-500">No products yet.</p>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </motion.div>

        <div className="mb-6 flex flex-row items-center justify-between gap-3 border-b border-white/5 pb-6">
          <p className="min-w-0 flex-1 text-xs leading-none tabular-nums text-zinc-500 sm:text-sm">
            Showing{" "}
            <span className="font-semibold text-zinc-200">
              {visible.length}
            </span>{" "}
            {visible.length === 1 ? "piece" : "pieces"}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            
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
                size="sm"
                className="h-7 w-[7.25rem] rounded-md border-zinc-700/80 bg-zinc-900/90 px-2 text-[11px] font-medium text-zinc-200 shadow-none backdrop-blur-sm transition-colors hover:border-zinc-600 sm:h-8 sm:w-[9.5rem] sm:px-2.5 sm:text-xs [&_svg]:size-3"
              >
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900 text-white">
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-asc">Price: low to high</SelectItem>
                <SelectItem value="price-desc">Price: high to low</SelectItem>
                <SelectItem value="match">Best match</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="min-w-0">
          {visible.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-2xl border border-dashed border-zinc-700/60 bg-gradient-to-b from-zinc-900/50 to-zinc-950/80 px-6 py-16 text-center sm:py-20"
            >
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.06),transparent_65%)]"
                aria-hidden
              />
              <div className="relative mx-auto max-w-md">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
                  <Search className="h-6 w-6 text-orange-400/90" aria-hidden />
                </div>
                <p className="text-xl font-semibold tracking-tight text-zinc-100 sm:text-2xl">
                  Nothing matches yet
                </p>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500 sm:text-base">
                  Loosen a filter, widen the price range, or try another search.
                  Your choices stay in the URL so you can share or bookmark.
                </p>
                <Button
                  type="button"
                  className="mt-8 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-8 font-semibold text-white shadow-lg shadow-orange-500/25 hover:from-orange-400 hover:to-amber-400"
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
                  Reset everything
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6"
            >
              {visible.map((p, i) => (
                <motion.div
                  key={p.doc_id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: Math.min(i * 0.04, 0.4),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="min-h-0 h-full"
                >
                  <ExploreProductCard
                    className="h-full"
                    product={p}
                    onQuickAdd={onQuickAdd}
                    imagePriority={i < 6}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        <div className="mt-16 border-t border-white/5 pt-10">
          <RecentlyViewedSection variant="dark" />
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { doc, getDoc } from "firebase/firestore";
import { Html5Qrcode } from "html5-qrcode";
import { Loader2, ScanBarcode, Video, VideoOff } from "lucide-react";
import { getDb } from "@/app/firebase";
import { applyStockDelta } from "@/lib/admin/stock-increment";
import { getSizesMap } from "@/lib/admin/inventory";
import { parseProductIdFromScan } from "@/lib/barcode/payload";
import { CheckoutStockError } from "@/lib/checkout/stock";
import { placePosSale } from "@/lib/checkout/placePosSale";
import {
  normalizeImageUrls,
  resolvePrice,
  resolveStock,
} from "@/lib/products/firestore-map";
import {
  listProductColors,
  productColorSwatchStyle,
} from "@/lib/products/product-colors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import type { CartItem } from "@/store/cartStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FirebaseError } from "firebase/app";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function resolveColor(data: Record<string, unknown>): string {
  const colors = data.colors;
  if (Array.isArray(colors) && colors.length > 0) {
    return String(colors[0]);
  }
  if (typeof data.color === "string") return data.color;
  return "";
}

function listSizeChoices(data: Record<string, unknown>): string[] {
  const map = getSizesMap(data);
  const keys = Object.keys(map);
  if (keys.length > 0) return [...keys].sort();
  const sizes = data.sizes;
  if (Array.isArray(sizes) && sizes.length > 0) {
    return sizes.map((s) => String(s));
  }
  return [""];
}

function needsExplicitSize(data: Record<string, unknown>): boolean {
  return Object.keys(getSizesMap(data)).length > 0;
}

export default function AdminInventoryScanPage() {
  const { user } = useAuth();
  const [manualRaw, setManualRaw] = useState("");
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [loaded, setLoaded] = useState<{
    id: string;
    data: Record<string, unknown>;
  } | null>(null);

  const [sellQty, setSellQty] = useState(1);
  const [sellPrice, setSellPrice] = useState("");
  const [restockQty, setRestockQty] = useState(1);
  const [lineSize, setLineSize] = useState("");
  const [sellSubmitting, setSellSubmitting] = useState(false);
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  const [camOn, setCamOn] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const decodeBusy = useRef(false);

  const stopCamera = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (!s) {
      setCamOn(false);
      return;
    }
    try {
      await s.stop();
    } catch {
      /* not running */
    }
    try {
      await s.clear();
    } catch {
      /* */
    }
    setCamOn(false);
  }, []);

  const loadProductById = useCallback(async (productId: string) => {
    setLoadingProduct(true);
    setLoaded(null);
    try {
      const snap = await getDoc(doc(getDb(), "products", productId));
      if (!snap.exists()) {
        toast.error("No product found for this code.");
        return;
      }
      const data = snap.data() as Record<string, unknown>;
      setLoaded({ id: snap.id, data });
      const p = resolvePrice(data);
      setSellPrice(String(p));
      setSellQty(1);
      setRestockQty(1);
      toast.success("Product loaded");
    } catch (e) {
      console.error(e);
      toast.error("Could not load product.");
    } finally {
      setLoadingProduct(false);
    }
  }, []);

  useEffect(() => {
    if (!loaded) {
      setLineSize("");
      return;
    }
    const opts = listSizeChoices(loaded.data);
    const map = getSizesMap(loaded.data);
    const preferred =
      opts.find((k) => k && (map[k] ?? 0) > 0) ?? opts.find(Boolean) ?? "";
    setLineSize(preferred);
  }, [loaded?.id, loaded?.data]);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  const onDecoded = useCallback(
    (text: string) => {
      if (decodeBusy.current) return;
      const id = parseProductIdFromScan(text);
      if (!id) return;
      decodeBusy.current = true;
      void (async () => {
        try {
          await stopCamera();
          await loadProductById(id);
        } finally {
          decodeBusy.current = false;
        }
      })();
    },
    [loadProductById, stopCamera]
  );

  const startCamera = async () => {
    await stopCamera();
    const readerId = "inventory-scan-reader";
    try {
      const scanner = new Html5Qrcode(readerId, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => onDecoded(decoded),
        () => {}
      );
      setCamOn(true);
    } catch (e) {
      console.error(e);
      toast.error("Could not start camera. Check permissions or use manual entry.");
      scannerRef.current = null;
      setCamOn(false);
    }
  };

  const onManualLookup = () => {
    const id = parseProductIdFromScan(manualRaw);
    if (!id) {
      toast.error("Unrecognized code. Paste JSON, product id, or mens:id.");
      return;
    }
    void loadProductById(id);
  };

  const clearLoaded = () => {
    setLoaded(null);
    setManualRaw("");
    decodeBusy.current = false;
  };

  const onSell = async () => {
    if (!loaded || !user?.uid) {
      toast.error("Sign in as admin to record a sale.");
      return;
    }
    const needSize = needsExplicitSize(loaded.data);
    if (needSize && !lineSize) {
      toast.error("Select a size.");
      return;
    }
    const qty = Math.max(1, Math.floor(sellQty));
    const unit = Number(sellPrice);
    if (!Number.isFinite(unit) || unit <= 0) {
      toast.error("Enter a valid sale price.");
      return;
    }
    const imgs = normalizeImageUrls(loaded.data);
    const item: CartItem = {
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `pos-${Date.now()}`,
      productId: loaded.id,
      name:
        typeof loaded.data.name === "string"
          ? loaded.data.name
          : String(loaded.data.name ?? "Product"),
      image: imgs[0] ?? "",
      price: unit,
      size: needSize ? lineSize : "",
      color: resolveColor(loaded.data),
      quantity: qty,
    };

    setSellSubmitting(true);
    try {
      const res = await placePosSale({ userId: user.uid, item });
      toast.success(`Order ${res.orderNumber} created (POS)`);
      clearLoaded();
    } catch (e) {
      if (e instanceof CheckoutStockError) {
        toast.error(e.message);
        return;
      }
      if (e instanceof FirebaseError && e.code === "permission-denied") {
        toast.error("Permission denied.", { description: e.message });
        return;
      }
      console.error(e);
      toast.error("Could not create order.");
    } finally {
      setSellSubmitting(false);
    }
  };

  const onRestock = async () => {
    if (!loaded) return;
    const needSize = needsExplicitSize(loaded.data);
    if (needSize && !lineSize) {
      toast.error("Select a size.");
      return;
    }
    const qty = Math.max(1, Math.floor(restockQty));
    setRestockSubmitting(true);
    try {
      await applyStockDelta(loaded.id, qty, {
        size: needSize ? lineSize : undefined,
      });
      toast.success(`Added ${qty} unit(s) to stock`);
      await loadProductById(loaded.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update stock.");
    } finally {
      setRestockSubmitting(false);
    }
  };

  const stockLabel = loaded
    ? resolveStock(loaded.data)
    : null;
  const sizeOpts = loaded ? listSizeChoices(loaded.data) : [];
  const map = loaded ? getSizesMap(loaded.data) : {};
  const showSizeSelect = loaded && (needsExplicitSize(loaded.data) || sizeOpts.some(Boolean));

  const availableColors = useMemo(
    () => (loaded ? listProductColors(loaded.data) : []),
    [loaded]
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8 text-foreground">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <ScanBarcode className="h-8 w-8 text-orange-500" aria-hidden />
          Scan & stock
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Scan a product QR or barcode, then record an in-store sale (creates an
          order and reduces stock) or add units back to inventory.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <Label className="text-foreground">Camera</Label>
        <div
          id="inventory-scan-reader"
          className={cn(
            "min-h-[200px] overflow-hidden rounded-lg border border-border bg-muted/30",
            !camOn && "flex items-center justify-center text-sm text-muted-foreground"
          )}
        >
          {!camOn ? "Camera preview appears here when started." : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!camOn ? (
            <Button
              type="button"
              variant="outline"
              className="border-border"
              onClick={() => void startCamera()}
            >
              <Video className="mr-2 h-4 w-4" />
              Start camera
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="border-border"
              onClick={() => void stopCamera()}
            >
              <VideoOff className="mr-2 h-4 w-4" />
              Stop camera
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm">
        <Label htmlFor="manual-scan">Manual code</Label>
        <Textarea
          id="manual-scan"
          placeholder='Paste JSON from QR, or raw product id, or "mens:PRODUCT_ID"'
          value={manualRaw}
          onChange={(e) => setManualRaw(e.target.value)}
          rows={3}
          className="border-border bg-background"
        />
        <Button
          type="button"
          className="bg-orange-600 text-white hover:bg-orange-500"
          onClick={() => onManualLookup()}
          disabled={loadingProduct}
        >
          {loadingProduct ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Load product
        </Button>
      </section>

      {loaded ? (
        <section className="space-y-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex gap-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
              {normalizeImageUrls(loaded.data)[0] ? (
                <Image
                  src={normalizeImageUrls(loaded.data)[0]!}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  No image
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight">
                {typeof loaded.data.name === "string"
                  ? loaded.data.name
                  : String(loaded.data.name ?? "")}
              </h2>
              <p className="text-sm text-muted-foreground">
                List {inr.format(resolvePrice(loaded.data))} · Stock{" "}
                <span className="font-medium text-foreground">{stockLabel}</span>
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {loaded.id}
              </p>
            </div>
          </div>

          {availableColors.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-foreground">Available colors</Label>
              <div className="flex flex-wrap gap-2">
                {availableColors.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-sm text-foreground"
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border border-black/15 shadow-sm dark:border-white/20"
                      style={productColorSwatchStyle(name, loaded.data)}
                      aria-hidden
                    />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No colors on file for this product.
            </p>
          )}

          {showSizeSelect ? (
            <div className="space-y-2">
              <Label>Size</Label>
              <Select value={lineSize} onValueChange={setLineSize}>
                <SelectTrigger className="border-border bg-background">
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  {sizeOpts
                    .filter((s) => s.length > 0)
                    .map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                        {map[s] !== undefined ? ` (${map[s]} on hand)` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Sell (POS)</h3>
              <p className="text-xs text-muted-foreground">
                Creates a cash-on-delivery order with placeholder shipping and
                decreases stock using the price you enter.
              </p>
              <div className="space-y-2">
                <Label htmlFor="sell-qty">Quantity</Label>
                <Input
                  id="sell-qty"
                  type="number"
                  min={1}
                  value={sellQty}
                  onChange={(e) => setSellQty(Number(e.target.value))}
                  className="border-border bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sell-price">Sold price (per unit)</Label>
                <Input
                  id="sell-price"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className="border-border bg-background"
                />
              </div>
              <Button
                type="button"
                className="w-full bg-orange-600 text-white hover:bg-orange-500"
                disabled={sellSubmitting}
                onClick={() => void onSell()}
              >
                {sellSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create order & reduce stock
              </Button>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Add stock
              </h3>
              <p className="text-xs text-muted-foreground">
                Increases inventory for this product (admin only).
              </p>
              <div className="space-y-2">
                <Label htmlFor="restock-qty">Quantity to add</Label>
                <Input
                  id="restock-qty"
                  type="number"
                  min={1}
                  value={restockQty}
                  onChange={(e) => setRestockQty(Number(e.target.value))}
                  className="border-border bg-background"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={restockSubmitting}
                onClick={() => void onRestock()}
              >
                {restockSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Increase stock
              </Button>
            </div>
          </div>

          <Button type="button" variant="ghost" onClick={() => clearLoaded()}>
            Scan another product
          </Button>
        </section>
      ) : null}
    </div>
  );
}

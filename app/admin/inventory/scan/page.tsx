"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { Html5Qrcode } from "html5-qrcode";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  ScanBarcode,
  ShoppingBag,
  Trash2,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { FirebaseError } from "firebase/app";
import { toast } from "sonner";

import { getDb } from "@/app/firebase";
import { useAuth } from "@/hooks/useAuth";
import { parseScanPayload } from "@/lib/barcode/payload";
import {
  parseColorVariants,
  sizesForColor,
  stockForColorSize,
  variantLabel,
  type ColorVariant,
} from "@/lib/products/color-variants";
import { getSizesMap } from "@/lib/admin/inventory";
import {
  normalizeImageUrls,
  resolvePrice,
} from "@/lib/products/firestore-map";
import { swatchColor } from "@/lib/explore/color-swatches";
import { placePosSale } from "@/lib/checkout/placePosSale";
import { CheckoutStockError } from "@/lib/checkout/stock";
import { fetchSignedReceipt, type SignedReceipt } from "@/lib/receipts/client";
import type { CartItem } from "@/store/cartStore";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const MAX_LINE_QTY = 99;
const READER_ID = "inventory-scan-reader";

type BucketLine = {
  lineId: string;
  productId: string;
  productName: string;
  image: string;
  color: string;
  colorLabel: string;
  size: string;
  unitPrice: number;
  qty: number;
  /** Max units we know are on hand, derived at scan-time. Defensive cap only. */
  maxQty: number;
  hasVariants: boolean;
};

type LoadedProduct = {
  id: string;
  data: Record<string, unknown>;
  variants: ColorVariant[];
};

type PendingResolve = {
  product: LoadedProduct;
  color: string;
  size: string;
};

type SaleSuccess = {
  orderId: string;
  orderNumber: string;
  receipt: SignedReceipt;
};

function genLineId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findVariant(
  variants: ColorVariant[],
  color: string
): ColorVariant | undefined {
  if (!color) return undefined;
  const target = color.toLowerCase();
  return variants.find((v) => v.color.toLowerCase() === target);
}

function pickStock(
  product: LoadedProduct,
  color: string,
  size: string
): number {
  if (product.variants.length > 0) {
    return stockForColorSize(product.variants, color, size);
  }
  const map = getSizesMap(product.data);
  if (size && map[size] != null) return Number(map[size]) || 0;
  return Math.max(0, Math.floor(Number(product.data.stock) || 0));
}

function pickColorLabel(
  product: LoadedProduct,
  color: string
): string {
  const v = findVariant(product.variants, color);
  return v ? variantLabel(v) : color;
}

function colorSwatchFill(
  product: LoadedProduct,
  color: string
): string {
  const v = findVariant(product.variants, color);
  return v?.hex ?? swatchColor(color);
}

function listColorOptions(product: LoadedProduct): ColorVariant[] {
  return product.variants;
}

function listSizeOptions(product: LoadedProduct, color: string): string[] {
  if (product.variants.length > 0) {
    if (!color) return [];
    const map = sizesForColor(product.variants, color);
    return Object.keys(map).sort();
  }
  const map = getSizesMap(product.data);
  const keys = Object.keys(map);
  if (keys.length > 0) return [...keys].sort();
  const sizes = product.data.sizes;
  if (Array.isArray(sizes) && sizes.length > 0) return sizes.map(String);
  return [];
}

function productHasSizes(product: LoadedProduct): boolean {
  if (product.variants.length > 0) {
    return product.variants.some((v) => Object.keys(v.sizes ?? {}).length > 0);
  }
  return Object.keys(getSizesMap(product.data)).length > 0;
}

export default function AdminInventoryScanPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
          Loading scan…
        </div>
      }
    >
      <AdminInventoryScanPageInner />
    </Suspense>
  );
}

function AdminInventoryScanPageInner() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // ── bucket state ────────────────────────────────────────────────────────
  const [bucket, setBucket] = useState<BucketLine[]>([]);
  const [pending, setPending] = useState<PendingResolve | null>(null);

  // ── scan / camera ───────────────────────────────────────────────────────
  const [manualRaw, setManualRaw] = useState("");
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const decodeBusy = useRef(false);

  // ── sell flow ───────────────────────────────────────────────────────────
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SaleSuccess | null>(null);
  const [copied, setCopied] = useState(false);

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

  useEffect(() => () => void stopCamera(), [stopCamera]);

  // ── add / mutate bucket helpers ─────────────────────────────────────────

  const addToBucket = useCallback(
    (product: LoadedProduct, color: string, size: string) => {
      const stock = pickStock(product, color, size);
      if (stock <= 0) {
        toast.error("Out of stock for this color/size.");
        return;
      }
      const colorLabel = pickColorLabel(product, color);
      const unitPrice = resolvePrice(product.data);
      const imgs = normalizeImageUrls(product.data);
      const productName =
        typeof product.data.name === "string"
          ? product.data.name
          : String(product.data.name ?? "Product");

      setBucket((prev) => {
        const idx = prev.findIndex(
          (l) =>
            l.productId === product.id &&
            l.color.toLowerCase() === color.toLowerCase() &&
            l.size === size
        );
        if (idx >= 0) {
          const cur = prev[idx]!;
          const nextQty = Math.min(stock, MAX_LINE_QTY, cur.qty + 1);
          if (nextQty === cur.qty) {
            toast.warning("Reached available stock for this variant.");
            return prev;
          }
          const updated: BucketLine = { ...cur, qty: nextQty, maxQty: stock };
          const copy = [...prev];
          copy[idx] = updated;
          return copy;
        }
        const line: BucketLine = {
          lineId: genLineId(),
          productId: product.id,
          productName,
          image: imgs[0] ?? "",
          color,
          colorLabel,
          size,
          unitPrice,
          qty: 1,
          maxQty: stock,
          hasVariants: product.variants.length > 0,
        };
        return [line, ...prev];
      });
      toast.success(
        `Added ${productName}${color ? ` (${colorLabel}${size ? ` · ${size}` : ""})` : ""}`
      );
    },
    []
  );

  const incLine = (lineId: string) => {
    setBucket((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        if (l.qty >= l.maxQty) {
          toast.warning("Reached available stock for this variant.");
          return l;
        }
        return { ...l, qty: Math.min(l.maxQty, MAX_LINE_QTY, l.qty + 1) };
      })
    );
  };

  const decLine = (lineId: string) => {
    setBucket((prev) =>
      prev
        .map((l) => (l.lineId === lineId ? { ...l, qty: l.qty - 1 } : l))
        .filter((l) => l.qty > 0)
    );
  };

  const removeLine = (lineId: string) => {
    setBucket((prev) => prev.filter((l) => l.lineId !== lineId));
  };

  const setLineQty = (lineId: string, raw: number) => {
    setBucket((prev) =>
      prev
        .map((l) => {
          if (l.lineId !== lineId) return l;
          const next = Math.max(0, Math.min(l.maxQty, MAX_LINE_QTY, Math.floor(raw)));
          return { ...l, qty: next };
        })
        .filter((l) => l.qty > 0)
    );
  };

  const clearBucket = () => setBucket([]);

  // ── product lookup + scan handling ──────────────────────────────────────

  const productCache = useRef(new Map<string, LoadedProduct>());

  const fetchProduct = useCallback(
    async (productId: string): Promise<LoadedProduct | null> => {
      const cached = productCache.current.get(productId);
      if (cached) return cached;
      setLoadingProduct(true);
      try {
        const snap = await getDoc(doc(getDb(), "products", productId));
        if (!snap.exists()) {
          toast.error("No product found for this code.");
          return null;
        }
        const data = snap.data() as Record<string, unknown>;
        const loaded: LoadedProduct = {
          id: snap.id,
          data,
          variants: parseColorVariants(data),
        };
        productCache.current.set(productId, loaded);
        return loaded;
      } catch (e) {
        console.error(e);
        toast.error("Could not load product.");
        return null;
      } finally {
        setLoadingProduct(false);
      }
    },
    []
  );

  const handleScan = useCallback(
    async (raw: string) => {
      const parsed = parseScanPayload(raw);
      if (!parsed) {
        toast.error("Unrecognized code.");
        return;
      }
      const product = await fetchProduct(parsed.productId);
      if (!product) return;

      const hasVariants = product.variants.length > 0;
      const hasSizes = productHasSizes(product);

      // QR-perfect path: variant-aware QR with both color and size.
      if (hasVariants && parsed.color && parsed.size) {
        addToBucket(product, parsed.color, parsed.size);
        return;
      }

      // Legacy product (no variants) and no sizes → just add it.
      if (!hasVariants && !hasSizes) {
        addToBucket(product, "", "");
        return;
      }

      // Otherwise ask the cashier to pick what's missing.
      const initialColor =
        parsed.color ??
        (hasVariants
          ? (product.variants.find((v) =>
              Object.values(v.sizes).some((q) => Number(q) > 0)
            )?.color ?? product.variants[0]?.color ?? "")
          : "");
      const initialSizes = listSizeOptions(product, initialColor);
      const initialSize =
        parsed.size ??
        initialSizes.find((s) => pickStock(product, initialColor, s) > 0) ??
        initialSizes[0] ??
        "";

      setPending({ product, color: initialColor, size: initialSize });
    },
    [addToBucket, fetchProduct]
  );

  // Opened from a printed QR deep link: `?product=…&color=…&size=…`
  const initialDeeplinkHandled = useRef(false);
  useEffect(() => {
    if (initialDeeplinkHandled.current) return;
    const raw = searchParams.get("product")?.trim();
    if (!raw) return;
    initialDeeplinkHandled.current = true;
    // Re-build the equivalent URL so parseScanPayload can normalize it.
    const url = window.location.href;
    void handleScan(url);
  }, [searchParams, handleScan]);

  const startCamera = async () => {
    await stopCamera();
    try {
      const scanner = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (decodeBusy.current) return;
          decodeBusy.current = true;
          void (async () => {
            try {
              await stopCamera();
              await handleScan(decoded);
            } finally {
              decodeBusy.current = false;
            }
          })();
        },
        () => {}
      );
      setCamOn(true);
    } catch (e) {
      console.error(e);
      toast.error(
        "Could not start camera. Allow camera access or use manual entry."
      );
      scannerRef.current = null;
      setCamOn(false);
    }
  };

  const onManualLookup = () => {
    const trimmed = manualRaw.trim();
    if (!trimmed) return;
    setManualRaw("");
    void handleScan(trimmed);
  };

  // ── pending picker actions ─────────────────────────────────────────────

  const confirmPending = () => {
    if (!pending) return;
    const { product, color, size } = pending;
    if (product.variants.length > 0 && !color) {
      toast.error("Pick a color.");
      return;
    }
    if (productHasSizes(product) && !size) {
      toast.error("Pick a size.");
      return;
    }
    addToBucket(product, color, size);
    setPending(null);
  };

  // ── totals ─────────────────────────────────────────────────────────────

  const total = useMemo(
    () => bucket.reduce((sum, l) => sum + l.qty * l.unitPrice, 0),
    [bucket]
  );

  const totalUnits = useMemo(
    () => bucket.reduce((s, l) => s + l.qty, 0),
    [bucket]
  );

  // ── sell ───────────────────────────────────────────────────────────────

  const openSellSheet = () => {
    if (bucket.length === 0) {
      toast.error("Bucket is empty.");
      return;
    }
    setCustomerPhone("");
    setCustomerName("");
    setPhoneOpen(true);
  };

  const submitSale = async () => {
    if (!user?.uid) {
      toast.error("Sign in as admin to record a sale.");
      return;
    }
    const cleanedPhone = customerPhone.replace(/\D/g, "");
    if (cleanedPhone.length < 10) {
      toast.error("Enter a valid 10-digit mobile number.");
      return;
    }
    if (bucket.length === 0) {
      toast.error("Bucket is empty.");
      return;
    }

    const items: CartItem[] = bucket.map((l) => ({
      id: l.lineId,
      productId: l.productId,
      name: l.productName,
      image: l.image,
      price: l.unitPrice,
      size: l.size,
      color: l.color,
      quantity: l.qty,
    }));

    setSubmitting(true);
    try {
      const placed = await placePosSale({
        userId: user.uid,
        items,
        customerName: customerName.trim() || null,
        customerPhone: cleanedPhone,
      });
      // Mint the 30-day receipt link on the server, then surface it.
      const receipt = await fetchSignedReceipt(placed.orderId);
      setSuccess({
        orderId: placed.orderId,
        orderNumber: placed.orderNumber,
        receipt,
      });
      setBucket([]);
      productCache.current.clear();
      setPhoneOpen(false);
      toast.success(`Order ${placed.orderNumber} created.`);
    } catch (e) {
      if (e instanceof CheckoutStockError) {
        toast.error(e.message);
      } else if (e instanceof FirebaseError && e.code === "permission-denied") {
        toast.error("Permission denied.", { description: e.message });
      } else {
        console.error(e);
        toast.error(e instanceof Error ? e.message : "Could not create order.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyReceipt = async () => {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.receipt.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed.");
    }
  };

  // ── success screen ─────────────────────────────────────────────────────
  if (success) {
    return (
      <SaleSuccessScreen
        success={success}
        onCopy={copyReceipt}
        copied={copied}
        onNewSale={() => {
          setSuccess(null);
          setCustomerPhone("");
          setCustomerName("");
        }}
      />
    );
  }

  // ── main view ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-6 text-foreground">
      <style>{`
        /* Make the camera preview fill its parent square. html5-qrcode injects
           a <video>; we don't control the markup. */
        #${READER_ID} video,
        #${READER_ID} canvas {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border-radius: inherit;
        }
      `}</style>

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <ScanBarcode className="h-7 w-7 text-orange-500" aria-hidden />
          Scan & sell
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan a variant QR or enter a code, build the bucket, then ring up.
        </p>
      </header>

      {/* ── Camera + manual entry ───────────────────────────────────────── */}
      <section className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <Label className="text-foreground">Camera</Label>
          {/*
            html5-qrcode owns the inside of this div: it calls
            `element.innerHTML = ""` on init and injects its own video/canvas.
            We MUST NOT put any React-rendered children inside it — otherwise
            React's reconciler can't find the nodes the library wiped, throws
            "Node to be removed is not a child", and the admin error boundary
            catches it. The placeholder lives as an absolute sibling instead.
          */}
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl border border-border bg-black/40">
            <div id={READER_ID} className="absolute inset-0" />
            {!camOn ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
                Tap Start to use the camera.
              </div>
            ) : null}
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
            {loadingProduct ? (
              <span className="inline-flex items-center text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Loading…
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="manual-scan" className="text-foreground">
            Or paste a code
          </Label>
          <Textarea
            id="manual-scan"
            placeholder="Paste the full scan URL, product id, mens:ID, or legacy JSON…"
            value={manualRaw}
            onChange={(e) => setManualRaw(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || e.key === "Tab") {
                /* leave default */
              }
            }}
            rows={4}
            className="border-border bg-background"
          />
          <Button
            type="button"
            className="w-full bg-orange-600 text-white hover:bg-orange-500"
            onClick={onManualLookup}
            disabled={!manualRaw.trim() || loadingProduct}
          >
            Add to bucket
          </Button>
        </div>
      </section>

      {/* ── Pending color/size picker ───────────────────────────────────── */}
      {pending ? (
        <PendingPicker
          pending={pending}
          setPending={setPending}
          onConfirm={confirmPending}
        />
      ) : null}

      {/* ── Bucket ──────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-orange-500" aria-hidden />
            <h2 className="text-sm font-semibold">
              Bucket{" "}
              <span className="text-muted-foreground">
                ({totalUnits} {totalUnits === 1 ? "unit" : "units"})
              </span>
            </h2>
          </div>
          {bucket.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={clearBucket}
            >
              Clear
            </Button>
          ) : null}
        </header>

        {bucket.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nothing scanned yet. Scan a QR or paste a code above.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {bucket.map((line) => (
              <BucketRow
                key={line.lineId}
                line={line}
                onInc={() => incLine(line.lineId)}
                onDec={() => decLine(line.lineId)}
                onRemove={() => removeLine(line.lineId)}
                onSetQty={(n) => setLineQty(line.lineId, n)}
              />
            ))}
          </ul>
        )}

        {bucket.length > 0 ? (
          <footer className="space-y-3 border-t border-border p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-2xl font-bold tabular-nums text-orange-500">
                {inr.format(total)}
              </span>
            </div>
            <Button
              type="button"
              className="w-full bg-orange-600 py-6 text-base text-white hover:bg-orange-500"
              onClick={openSellSheet}
              disabled={submitting}
            >
              Sell ({inr.format(total)})
            </Button>
          </footer>
        ) : null}
      </section>

      {/* ── Phone capture sheet ─────────────────────────────────────────── */}
      <Dialog open={phoneOpen} onOpenChange={(o) => !submitting && setPhoneOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customer details</DialogTitle>
            <DialogDescription>
              Mobile number is required — it doubles as the customer ID on the
              receipt and the link we share for reprints.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cust-phone">Mobile number *</Label>
              <Input
                id="cust-phone"
                type="tel"
                inputMode="numeric"
                placeholder="10-digit mobile"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                autoFocus
                className="border-border bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cust-name">Customer name (optional)</Label>
              <Input
                id="cust-name"
                placeholder="Walk-in customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="border-border bg-background"
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {totalUnits} {totalUnits === 1 ? "unit" : "units"}
                </span>
                <span className="text-lg font-semibold tabular-nums text-orange-500">
                  {inr.format(total)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setPhoneOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="bg-orange-600 text-white hover:bg-orange-500"
              onClick={() => void submitSale()}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Complete sale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BucketRow({
  line,
  onInc,
  onDec,
  onRemove,
  onSetQty,
}: {
  line: BucketLine;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
  onSetQty: (n: number) => void;
}) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 gap-3">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {line.image ? (
            <Image
              src={line.image}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{line.productName}</p>
          {line.color || line.size ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[line.colorLabel, line.size].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {inr.format(line.unitPrice)} ea
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
        <div className="flex items-center gap-1 rounded-full border border-border bg-background p-0.5">
          <button
            type="button"
            onClick={onDec}
            className="grid h-8 w-8 place-items-center rounded-full text-foreground hover:bg-muted"
            aria-label="Decrease"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            min={1}
            max={Math.min(line.maxQty, MAX_LINE_QTY)}
            value={line.qty}
            onChange={(e) => onSetQty(Number(e.target.value) || 0)}
            className="w-12 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
            aria-label="Quantity"
          />
          <button
            type="button"
            onClick={onInc}
            disabled={line.qty >= line.maxQty}
            className="grid h-8 w-8 place-items-center rounded-full text-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Increase"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {inr.format(line.unitPrice * line.qty)}
          </span>
          <button
            type="button"
            onClick={onRemove}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Remove line"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

function PendingPicker({
  pending,
  setPending,
  onConfirm,
}: {
  pending: PendingResolve;
  setPending: (p: PendingResolve | null) => void;
  onConfirm: () => void;
}) {
  const colors = listColorOptions(pending.product);
  const sizes = listSizeOptions(pending.product, pending.color);
  const name =
    typeof pending.product.data.name === "string"
      ? pending.product.data.name
      : "Product";
  const hasSizes = productHasSizes(pending.product);
  const hasVariants = pending.product.variants.length > 0;

  // When color changes, reset size to first available with stock.
  useEffect(() => {
    if (!hasSizes) return;
    const opts = listSizeOptions(pending.product, pending.color);
    if (opts.length === 0) return;
    if (opts.includes(pending.size)) return;
    const next =
      opts.find((s) => pickStock(pending.product, pending.color, s) > 0) ??
      opts[0] ??
      "";
    if (next !== pending.size) setPending({ ...pending, size: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.color]);

  return (
    <section className="rounded-2xl border border-orange-500/40 bg-orange-500/5 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-orange-500">
            Pick variant
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-foreground">
            {name}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setPending(null)}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {hasVariants ? (
        <div className="mt-3 space-y-2">
          <Label className="text-xs text-foreground">Color</Label>
          <div className="flex flex-wrap gap-2">
            {colors.map((v) => {
              const selected = v.color === pending.color;
              const fill = v.hex ?? swatchColor(v.color);
              const totalForColor = Object.values(v.sizes).reduce(
                (a, b) => a + (Number(b) || 0),
                0
              );
              return (
                <button
                  key={v.color}
                  type="button"
                  onClick={() => setPending({ ...pending, color: v.color })}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
                    selected
                      ? "border-orange-500 bg-orange-500/15"
                      : "border-border bg-background hover:border-orange-500/40"
                  )}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/15 shadow-sm dark:border-white/20"
                    style={{ backgroundColor: fill }}
                  />
                  {variantLabel(v)}
                  <span className="text-[10px] text-muted-foreground">
                    ({totalForColor})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {hasSizes ? (
        <div className="mt-3 space-y-2">
          <Label className="text-xs text-foreground">Size</Label>
          <Select
            value={pending.size}
            onValueChange={(s) => setPending({ ...pending, size: s })}
          >
            <SelectTrigger className="border-border bg-background">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((s) => {
                const stock = pickStock(pending.product, pending.color, s);
                return (
                  <SelectItem key={s} value={s} disabled={stock <= 0}>
                    {s} {stock > 0 ? `(${stock} on hand)` : "— out"}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setPending(null)}>
          Cancel
        </Button>
        <Button
          type="button"
          className="bg-orange-600 text-white hover:bg-orange-500"
          onClick={onConfirm}
        >
          Add to bucket
        </Button>
      </div>
    </section>
  );
}

function SaleSuccessScreen({
  success,
  copied,
  onCopy,
  onNewSale,
}: {
  success: SaleSuccess;
  copied: boolean;
  onCopy: () => void;
  onNewSale: () => void;
}) {
  const expiresAt = new Date(success.receipt.expiresAt);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6 py-10 text-center">
      <div className="rounded-full bg-emerald-500/10 p-4">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Sale complete</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Order #{success.orderNumber}
        </p>
      </div>

      <div className="w-full rounded-2xl border border-border bg-card p-5 text-left shadow-sm">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Receipt link
        </p>
        <p className="mt-2 break-all rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs">
          {success.receipt.url}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Valid until {expiresAt.toLocaleString("en-IN")}. Every visit
          re-renders the receipt — nothing is stored.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Button variant="outline" onClick={onCopy}>
            {copied ? (
              <Check className="mr-2 h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button asChild variant="outline">
            <Link href={success.receipt.path} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open receipt
            </Link>
          </Button>
          <Button asChild variant="outline" className="col-span-2 sm:col-span-1">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Your SecondSkin receipt: ${success.receipt.url}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Share on WhatsApp
            </a>
          </Button>
        </div>
      </div>

      <Button
        className="bg-orange-600 px-6 text-white hover:bg-orange-500"
        onClick={onNewSale}
      >
        Start a new sale
      </Button>
    </div>
  );
}

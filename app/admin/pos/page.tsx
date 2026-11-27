"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Html5Qrcode } from "html5-qrcode";
import { doc, getDoc } from "firebase/firestore";
import {
  Camera,
  CameraOff,
  Loader2,
  Minus,
  Plus,
  Receipt,
  ScanLine,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { getDb } from "@/app/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseScanPayload } from "@/lib/barcode/payload";
import {
  imagesForColor,
  parseColorVariants,
  stockForColorSize,
} from "@/lib/products/color-variants";
import { placePosSale } from "@/lib/checkout/placePosSale";
import { fetchSignedReceipt } from "@/lib/receipts/client";
import { imageKitLoaderFor } from "@/lib/uploads/imagekit-loader";
import type { CartItem } from "@/store/cartStore";
import { inr } from "@/lib/utils";

const READER_ID = "pos-reader";

type PosLine = {
  key: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  color: string;
  size: string;
  quantity: number;
  stock: number;
};

type Resolved =
  | {
      productId: string;
      name: string;
      image: string;
      price: number;
      color: string;
      size: string;
      stock: number;
    }
  | { error: string };

function readNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

/** Short success/failure beep via WebAudio — no asset needed. */
function beep(ok: boolean) {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.value = ok ? 880 : 200;
    gain.gain.value = 0.07;
    osc.start();
    setTimeout(
      () => {
        try {
          osc.stop();
          void ctx.close();
        } catch {
          /* noop */
        }
      },
      ok ? 80 : 180
    );
  } catch {
    /* audio not available */
  }
}

async function resolveScannedItem(
  payload: { productId: string; color?: string; size?: string }
): Promise<Resolved> {
  const snap = await getDoc(doc(getDb(), "products", payload.productId));
  if (!snap.exists()) return { error: "Product not found." };
  const data = snap.data() as Record<string, unknown>;
  if (data.archived === true || data.active === false) {
    return { error: "Product is no longer for sale." };
  }
  const price = readNum(data.price);
  if (!Number.isFinite(price) || price < 0) {
    return { error: "Product has no valid price." };
  }
  const name = typeof data.name === "string" ? data.name : "Item";
  const color = payload.color ?? "";
  const size = payload.size ?? "";

  const variants = parseColorVariants(data);
  let stock = 0;
  let image = "";

  if (variants.length > 0 && color) {
    stock = stockForColorSize(variants, color, size);
    const imgs = imagesForColor(
      variants,
      color,
      Array.isArray(data.images)
        ? (data.images as unknown[]).filter(
            (x): x is string => typeof x === "string"
          )
        : []
    );
    image = imgs[0] ?? "";
  } else {
    const sizes =
      data.sizes && typeof data.sizes === "object" && !Array.isArray(data.sizes)
        ? (data.sizes as Record<string, unknown>)
        : null;
    if (sizes && size) {
      const n = readNum(sizes[size]);
      stock = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    } else {
      const n = readNum(data.stock);
      stock = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    }
    image =
      (Array.isArray(data.images)
        ? (data.images as unknown[]).find(
            (x): x is string => typeof x === "string" && x.length > 0
          )
        : undefined) ?? (typeof data.image === "string" ? data.image : "");
  }

  return { productId: payload.productId, name, image, price, color, size, stock };
}

export default function PosPage() {
  const { user } = useAuth();
  const [lines, setLines] = useState<PosLine[]>([]);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [placing, setPlacing] = useState(false);
  const [result, setResult] = useState<{
    orderNumber: string;
    total: number;
    receiptUrl: string | null;
  } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const linesRef = useRef<PosLine[]>([]);
  const busyRef = useRef(false);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const units = lines.reduce((s, l) => s + l.quantity, 0);

  const addScanned = useCallback(async (raw: string) => {
    const now = Date.now();
    if (busyRef.current) return;
    // Debounce: ignore the same code within 1.5s (camera fires ~10x/sec).
    if (lastScanRef.current.code === raw && now - lastScanRef.current.at < 1500) {
      return;
    }
    lastScanRef.current = { code: raw, at: now };

    const payload = parseScanPayload(raw);
    if (!payload) {
      beep(false);
      toast.error("Unrecognized code.");
      return;
    }
    if (!payload.color || !payload.size) {
      beep(false);
      toast.error("That label has no size — use a per-size label.");
      return;
    }

    busyRef.current = true;
    try {
      const resolved = await resolveScannedItem(payload);
      if ("error" in resolved) {
        beep(false);
        toast.error(resolved.error);
        return;
      }
      const key = `${resolved.productId}|${resolved.color}|${resolved.size}`;
      const existing = linesRef.current.find((l) => l.key === key);
      if (resolved.stock <= 0) {
        beep(false);
        toast.error(
          `${resolved.name} (${resolved.color}/${resolved.size}) is out of stock.`
        );
        return;
      }
      if (existing && existing.quantity >= resolved.stock) {
        beep(false);
        toast.warning(`Only ${resolved.stock} in stock for ${resolved.name}.`);
        return;
      }

      setLines((prev) => {
        const idx = prev.findIndex((l) => l.key === key);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx]!, quantity: next[idx]!.quantity + 1 };
          return next;
        }
        return [
          ...prev,
          {
            key,
            productId: resolved.productId,
            name: resolved.name,
            image: resolved.image,
            price: resolved.price,
            color: resolved.color,
            size: resolved.size,
            quantity: 1,
            stock: resolved.stock,
          },
        ];
      });
      beep(true);
      toast.success(`Added ${resolved.name} · ${resolved.color}/${resolved.size}`);
    } catch {
      beep(false);
      toast.error("Could not look up that item. Try again.");
    } finally {
      busyRef.current = false;
    }
  }, []);

  // Start / stop the camera when `scanning` toggles.
  useEffect(() => {
    if (!scanning) return;
    setCamError(null);
    const scanner = new Html5Qrcode(READER_ID, { verbose: false });
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          void addScanned(decoded);
        },
        undefined
      )
      .catch((e: unknown) => {
        setCamError(
          e instanceof Error
            ? `Camera error: ${e.message}`
            : "Could not start the camera. Check permissions."
        );
        setScanning(false);
      });

    return () => {
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {
            /* already stopped */
          });
      }
    };
  }, [scanning, addScanned]);

  const updateQty = (key: string, delta: number) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      if (idx < 0) return prev;
      const line = prev[idx]!;
      const q = line.quantity + delta;
      if (q <= 0) return prev.filter((l) => l.key !== key);
      if (q > line.stock) {
        toast.warning(`Only ${line.stock} in stock.`);
        return prev;
      }
      const next = [...prev];
      next[idx] = { ...line, quantity: q };
      return next;
    });
  };

  const removeLine = (key: string) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const submitSale = async () => {
    if (lines.length === 0) {
      toast.error("Scan at least one item first.");
      return;
    }
    if (!user?.uid) {
      toast.error("Sign in as staff to record a sale.");
      return;
    }
    setPlacing(true);
    try {
      // Stop the camera while we commit.
      setScanning(false);
      const items: CartItem[] = lines.map((l) => ({
        id: l.key,
        productId: l.productId,
        name: l.name,
        image: l.image,
        price: l.price,
        size: l.size,
        color: l.color,
        quantity: l.quantity,
      }));
      const placed = await placePosSale({
        userId: user.uid,
        items,
        customerPhone: customerPhone.trim() || undefined,
      });
      // Best-effort bill link; the sale already succeeded if this throws.
      let receiptUrl: string | null = null;
      try {
        receiptUrl = (await fetchSignedReceipt(placed.orderId)).url;
      } catch {
        receiptUrl = null;
      }
      setResult({ orderNumber: placed.orderNumber, total, receiptUrl });
      setLines([]);
      setCustomerPhone("");
      toast.success(`Sale recorded · ${placed.orderNumber}`);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not record the sale. Try again."
      );
    } finally {
      setPlacing(false);
    }
  };

  const newSale = () => {
    setResult(null);
    setLines([]);
    setCustomerPhone("");
  };

  // ── Bill screen ────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="mx-auto max-w-md space-y-6 py-10 text-center">
        <div className="mx-auto w-fit rounded-full bg-emerald-500/10 p-3">
          <Receipt className="h-9 w-9 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sale complete</h1>
          <p className="mt-1 text-muted-foreground">
            Order <span className="font-mono">{result.orderNumber}</span>
          </p>
          <p className="mt-2 text-3xl font-bold text-orange-500">
            {inr.format(result.total)}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {result.receiptUrl ? (
            <a
              href={result.receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-orange-600 px-4 font-medium text-white hover:bg-orange-500"
            >
              <Receipt className="h-4 w-4" />
              Open / print bill
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">
              Bill link unavailable — find this order in Orders to reprint.
            </p>
          )}
          <Button type="button" variant="outline" onClick={newSale}>
            New sale
          </Button>
        </div>
      </div>
    );
  }

  // ── Sell screen ────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-lg space-y-5 pb-28">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Sell (POS)</h1>
        <span className="text-sm text-muted-foreground">
          {units} item{units === 1 ? "" : "s"}
        </span>
      </div>

      {/* Scanner */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div
          id={READER_ID}
          className={scanning ? "aspect-square w-full bg-black" : "hidden"}
        />
        <div className="p-3">
          {scanning ? (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={() => setScanning(false)}
            >
              <CameraOff className="h-4 w-4" />
              Stop camera
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full gap-2 bg-orange-600 text-white hover:bg-orange-500"
              onClick={() => setScanning(true)}
            >
              <Camera className="h-4 w-4" />
              Start scanning
            </Button>
          )}
          {camError ? (
            <p className="mt-2 text-sm text-destructive">{camError}</p>
          ) : (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Point the camera at a product label — it adds the exact size &amp;
              colour automatically.
            </p>
          )}
        </div>
      </div>

      {/* Manual / scan-gun entry */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const code = manualCode.trim();
          if (!code) return;
          void addScanned(code);
          setManualCode("");
        }}
        className="flex gap-2"
      >
        <Input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Or type / scan-gun a code, then Enter"
          className="flex-1"
          aria-label="Manual code entry"
        />
        <Button type="submit" variant="secondary" className="gap-1">
          <ScanLine className="h-4 w-4" />
          Add
        </Button>
      </form>

      {/* Cart */}
      {lines.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No items yet. Start scanning to build the bill.
        </p>
      ) : (
        <ul className="space-y-2">
          {lines.map((l) => (
            <li
              key={l.key}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-2"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                {l.image ? (
                  <Image
                    src={l.image}
                    loader={imageKitLoaderFor(l.image)}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                    unoptimized={
                      l.image.startsWith("data:") || l.image.startsWith("blob:")
                    }
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[l.color, l.size].filter(Boolean).join(" · ")} ·{" "}
                  {inr.format(l.price)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateQty(l.key, -1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted"
                  aria-label="Decrease"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm tabular-nums">
                  {l.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateQty(l.key, 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-muted"
                  aria-label="Increase"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeLine(l.key)}
                  className="ml-1 flex h-7 w-7 items-center justify-center rounded-md border border-border text-destructive hover:bg-destructive/10"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Optional customer phone */}
      <div className="space-y-1.5">
        <Label htmlFor="pos-phone">Customer phone (optional — for the bill)</Label>
        <Input
          id="pos-phone"
          inputMode="numeric"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="10-digit mobile"
          maxLength={10}
        />
      </div>

      {/* Sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-xl font-bold tabular-nums text-orange-500">
              {inr.format(total)}
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            disabled={placing || lines.length === 0}
            onClick={() => void submitSale()}
            className="gap-2 bg-orange-600 text-white hover:bg-orange-500"
          >
            {placing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Receipt className="h-4 w-4" />
                Submit &amp; bill
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

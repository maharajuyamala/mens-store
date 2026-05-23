"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  PlusCircle,
  Printer,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import { getClientFirebase } from "@/app/firebase";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import QRCode from "qrcode";
import { toast } from "sonner";
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
import { cn, inr } from "@/lib/utils";
import { productScanStockUrl } from "@/lib/barcode/payload";
import {
  QUICK_ADD_AUDIENCES,
  QUICK_ADD_STYLE_TAGS,
  type AudienceId,
} from "@/lib/add-product/quick-add-options";
import { buildImageStoragePath } from "@/lib/uploads/validate-image";
import {
  formatSizeLabel,
  getSizeOptions,
  inferSizeGroup,
} from "@/lib/products/size-options";
import {
  ColorVariantsEditor,
  canonicalVariantName,
  makeEmptyVariantDraft,
  type VariantDraft,
} from "@/components/admin/products/ColorVariantsEditor";

// ─── Types ────────────────────────────────────────────────────────────────────

type CreatedProduct = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
};

// ─── QR Success Screen ───────────────────────────────────────────────────────

function QrSuccessScreen({
  product,
  onDone,
}: {
  product: CreatedProduct;
  onDone: () => void;
}) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const deepLink = productScanStockUrl(product.productId);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(deepLink, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setQrSrc(url);
      })
      .catch(() => {
        if (!cancelled) setQrSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [deepLink]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-8 text-center">
      <div className="rounded-full bg-emerald-500/10 p-4">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Product added!</h2>
        <p className="mt-1 text-muted-foreground">{product.name}</p>
        <p className="text-lg font-semibold text-orange-500">
          {inr.format(product.price)}
        </p>
      </div>

      {product.imageUrl && (
        <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-xl border border-border">
          <Image
            src={product.imageUrl}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Scan QR to open{" "}
          <span className="font-medium">Scan & stock</span> for this product.
        </p>
        {qrSrc ? (
          <img
            src={qrSrc}
            alt="QR code for this product"
            width={200}
            height={200}
            className="rounded-xl"
          />
        ) : (
          <div className="flex h-[200px] w-[200px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            Generating QR…
          </div>
        )}
        <p className="max-w-[300px] break-all text-center font-mono text-[10px] leading-snug text-muted-foreground">
          {deepLink}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Product ID:{" "}
        <span className="font-mono text-orange-400">{product.productId}</span>
      </p>

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.print()}
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          Print QR
        </Button>
        <Button
          type="button"
          onClick={onDone}
          className="gap-2 bg-orange-600 text-white hover:bg-orange-500"
        >
          <PlusCircle className="h-4 w-4" />
          Add another product
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AddProductPage() {
  // Form state
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [colorDrafts, setColorDrafts] = useState<VariantDraft[]>(() => [
    makeEmptyVariantDraft(),
  ]);
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>(
    {}
  );
  const [selectedAudience, setSelectedAudience] = useState<AudienceId | "">("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Post-create state
  const [createdProduct, setCreatedProduct] = useState<CreatedProduct | null>(
    null
  );

  const resetForm = useCallback(() => {
    setProductName("");
    setPrice("");
    setSizeQuantities({});
    setSelectedAudience("");
    setSelectedStyles([]);
    setColorDrafts((prev) => {
      // Revoke blob URLs we own so we don't leak previews.
      for (const d of prev) {
        for (const img of d.images) {
          if (img.kind === "new") URL.revokeObjectURL(img.preview);
        }
      }
      return [makeEmptyVariantDraft()];
    });
    setError(null);
    setCreatedProduct(null);
  }, []);

  const handleQuantityChange = (size: string, qty: number) => {
    setSizeQuantities((prev) => ({ ...prev, [size]: Math.max(0, qty) }));
  };


  // Sizes depend on department + style — kids get age brackets, "pants" style
  // gets numeric waist sizes, everything else gets the alpha XS–6XL set.
  const sizeOptions = useMemo<readonly string[]>(() => {
    if (!selectedAudience) return [];
    return getSizeOptions(selectedAudience, selectedStyles);
  }, [selectedAudience, selectedStyles]);

  const sizeGroup = useMemo(
    () =>
      selectedAudience
        ? inferSizeGroup(selectedAudience, selectedStyles)
        : null,
    [selectedAudience, selectedStyles]
  );

  // Drop quantities entered against sizes that no longer apply (e.g. user
  // switched from Pants to Shirts after typing waist counts).
  useEffect(() => {
    setSizeQuantities((prev) => {
      const allowed = new Set(sizeOptions);
      let dirty = false;
      const next: Record<string, number> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (allowed.has(k)) next[k] = v;
        else dirty = true;
      }
      return dirty ? next : prev;
    });
  }, [sizeOptions]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const finalPrice = parseFloat(price);
    const sizesToSubmit = Object.entries(sizeQuantities)
      .filter(([, q]) => q > 0)
      .reduce(
        (acc, [size, q]) => {
          acc[size] = q;
          return acc;
        },
        {} as Record<string, number>
      );

    // Filter to drafts that have at least one image — empty placeholders are
    // ignored so admins don't have to clean them up manually.
    const usableDrafts = colorDrafts.filter((d) => d.images.length > 0);

    // Detect duplicate canonical names so two drafts don't collide silently.
    const nameCounts = new Map<string, number>();
    for (const d of usableDrafts) {
      const n = canonicalVariantName(d);
      nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
    }
    const hasDupes = Array.from(nameCounts.values()).some((c) => c > 1);

    if (
      !productName ||
      !price ||
      Number.isNaN(finalPrice) ||
      usableDrafts.length === 0 ||
      !selectedAudience ||
      Object.keys(sizesToSubmit).length === 0 ||
      selectedStyles.length === 0 ||
      hasDupes
    ) {
      const msg = hasDupes
        ? "Two colors share the same name. Give each color a unique name."
        : "Fill all fields: department, at least one style, at least one color with photos, price, name, and stock for at least one size.";
      setError(msg);
      toast.error("Complete the form", { description: msg });
      return;
    }

    const fb = getClientFirebase();
    if (!fb) {
      setError(
        "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* to .env.local and restart."
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };

      // Upload each color's photos in order so the array we persist matches
      // the order shown to the admin. /admin/add-product only creates NEW
      // images, but we defensively pass-through any "existing" URLs in case
      // this branch is reused for editing later.
      const colorVariants: Array<{
        color: string;
        label?: string;
        hex?: string;
        images: string[];
      }> = [];
      for (const draft of usableDrafts) {
        const urls: string[] = [];
        for (const img of draft.images) {
          if (img.kind === "existing") {
            urls.push(img.url);
            continue;
          }
          const compressed = await imageCompression(img.file, options);
          const imageRef = ref(
            fb.storage,
            buildImageStoragePath(img.file, "products")
          );
          await uploadBytes(imageRef, compressed);
          urls.push(await getDownloadURL(imageRef));
        }
        const colorName = canonicalVariantName(draft);
        const friendlyLabel = draft.label.trim();
        colorVariants.push({
          color: colorName,
          ...(friendlyLabel ? { label: friendlyLabel } : {}),
          ...(draft.hex ? { hex: draft.hex } : {}),
          images: urls,
        });
      }

      // Backward-compat: flatten so legacy consumers that read `images`/`colors`
      // still get a sensible value.
      const flatImages = colorVariants.flatMap((v) => v.images);
      const colorNames = colorVariants.map((v) => v.color);

      const productData = {
        id: `${Date.now()}`,
        name: productName,
        price: finalPrice,
        images: flatImages,
        image: flatImages[0] ?? "",
        tags: [selectedAudience, ...selectedStyles],
        audience: selectedAudience,
        colors: colorNames,
        colorVariants,
        description: "",
        size: [sizesToSubmit],
      };

      const newDoc = await addDoc(collection(fb.db, "products"), productData);

      toast.success("Product added!");
      setCreatedProduct({
        productId: newDoc.id,
        name: productName,
        price: finalPrice,
        imageUrl: flatImages[0] ?? null,
      });
    } catch (err) {
      console.error("Error adding product:", err);
      setError(
        err instanceof Error ? err.message : "Failed to add product."
      );
      toast.error("Could not add product");
    } finally {
      setIsLoading(false);
    }
  };

  // ── QR success screen ────────────────────────────────────────────────────
  if (createdProduct) {
    return <QrSuccessScreen product={createdProduct} onDone={resetForm} />;
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl pb-16">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        Add new product
      </h1>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-6"
      >
        {/* ── Name & Price ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ap-name">Product name</Label>
            <Input
              id="ap-name"
              placeholder="e.g. Onyx silk-blend shirt"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="border-border bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ap-price">Price (₹)</Label>
            <Input
              id="ap-price"
              type="number"
              placeholder="e.g. 1200"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="border-border bg-background"
            />
          </div>
        </div>

        {/* ── Department ────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label>Department</Label>
          <Select
            value={selectedAudience || undefined}
            onValueChange={(v) => {
              setSelectedAudience(v as AudienceId);
              setSelectedStyles([]);
            }}
          >
            <SelectTrigger className="w-full border-border bg-background">
              <SelectValue placeholder="Men, Women, or Kids" />
            </SelectTrigger>
            <SelectContent>
              {QUICK_ADD_AUDIENCES.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Style tags ────────────────────────────────────────────── */}
        {selectedAudience ? (
          <div className="space-y-2">
            <Label>Style & type (select one or more)</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_ADD_STYLE_TAGS.map((tag) => (
                <button
                  type="button"
                  key={tag.id}
                  onClick={() =>
                    setSelectedStyles((prev) =>
                      prev.includes(tag.id)
                        ? prev.filter((t) => t !== tag.id)
                        : [...prev, tag.id]
                    )
                  }
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2",
                    selectedStyles.includes(tag.id)
                      ? "bg-orange-600 text-white shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a department above to choose styles.
          </p>
        )}

        {/* ── Colors & per-color images ─────────────────────────────── */}
        <ColorVariantsEditor
          drafts={colorDrafts}
          onChange={setColorDrafts}
          disabled={isLoading}
        />

        {/* ── Sizes & stock ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <Label>Available sizes & stock</Label>
            {sizeGroup ? (
              <span className="text-xs text-muted-foreground">
                {sizeGroup === "kids"
                  ? "Kids — age brackets"
                  : sizeGroup === "numeric"
                    ? "Waist size (inches)"
                    : "Alpha sizes (XS–6XL)"}
              </span>
            ) : null}
          </div>
          {!selectedAudience ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
              Pick a department above to choose sizes.
            </p>
          ) : sizeOptions.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
              No size options for this combination.
            </p>
          ) : (
            <div
              className={cn(
                "grid gap-3",
                sizeGroup === "kids"
                  ? "grid-cols-2 sm:grid-cols-4"
                  : sizeGroup === "numeric"
                    ? "grid-cols-3 sm:grid-cols-4"
                    : "grid-cols-3 sm:grid-cols-5"
              )}
            >
              {sizeOptions.map((size) => (
                <div
                  key={size}
                  className="flex flex-col items-center gap-2 rounded-lg border border-border bg-muted/30 p-2"
                >
                  <span
                    className="text-sm font-medium"
                    title={formatSizeLabel(size)}
                  >
                    {size}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() =>
                        handleQuantityChange(
                          size,
                          (sizeQuantities[size] || 0) - 1
                        )
                      }
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      type="number"
                      className="h-7 w-12 border-border bg-background text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      value={sizeQuantities[size] || 0}
                      onChange={(e) =>
                        handleQuantityChange(
                          size,
                          parseInt(e.target.value, 10) || 0
                        )
                      }
                      min={0}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() =>
                        handleQuantityChange(
                          size,
                          (sizeQuantities[size] || 0) + 1
                        )
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Error ─────────────────────────────────────────────────── */}
        {error && (
          <p
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* ── Submit ────────────────────────────────────────────────── */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full mb-8 bg-orange-600 text-white hover:bg-orange-500 sm:w-auto"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading & saving…
            </>
          ) : (
            <>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add product
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

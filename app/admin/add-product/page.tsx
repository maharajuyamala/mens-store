"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  Loader2,
  PlusCircle,
  Printer,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import { getClientFirebase } from "@/app/firebase";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
import {
  QUICK_ADD_AUDIENCES,
  getQuickAddStyleTags,
  type AudienceId,
} from "@/lib/add-product/quick-add-options";
import { buildImageStoragePath } from "@/lib/uploads/validate-image";
import {
  getSizeOptions,
  inferSizeGroup,
} from "@/lib/products/size-options";
import type { ColorVariant } from "@/lib/products/color-variants";
import { VariantQrSheet } from "@/components/admin/products/VariantQrSheet";
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
  variants: ColorVariant[];
};

// ─── QR Success Screen ───────────────────────────────────────────────────────

function QrSuccessScreen({
  product,
  onDone,
}: {
  product: CreatedProduct;
  onDone: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-6">
      <style>{`
        @page { margin: 0.25in; size: auto; }
        @media print {
          body * { visibility: hidden !important; }
          #variant-qr-print-root,
          #variant-qr-print-root * { visibility: visible !important; }
          #variant-qr-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
          }
          .variant-qr-label { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="flex flex-col items-center gap-3 text-center print:hidden">
        <div className="rounded-full bg-emerald-500/10 p-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Product added!</h2>
          <p className="mt-1 text-muted-foreground">{product.name}</p>
          <p className="text-lg font-semibold text-orange-500">
            {inr.format(product.price)}
          </p>
        </div>

        {product.imageUrl ? (
          <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-border">
            <Image
              src={product.imageUrl}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Product ID:{" "}
          <span className="font-mono text-orange-400">{product.productId}</span>
        </p>
      </div>

      <VariantQrSheet
        productId={product.productId}
        productName={product.name}
        price={product.price}
        variants={product.variants}
      />

      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center print:hidden">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.print()}
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          Print labels
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

  const sizeGroupLabel = useMemo(() => {
    if (!sizeGroup) return undefined;
    return sizeGroup === "kids"
      ? "Kids — age brackets"
      : sizeGroup === "numeric"
        ? "Waist (inches)"
        : "Alpha (XS–6XL)";
  }, [sizeGroup]);

  // Drop stock entered against sizes that no longer apply (e.g. user switched
  // from Pants to Shirts after typing waist counts). We mutate per-draft here
  // so the editor doesn't have to.
  useEffect(() => {
    setColorDrafts((prev) => {
      const allowed = new Set(sizeOptions);
      let dirty = false;
      const next = prev.map((d) => {
        const cleaned: Record<string, number> = {};
        for (const [k, v] of Object.entries(d.sizes)) {
          if (allowed.has(k)) cleaned[k] = v;
          else dirty = true;
        }
        return dirty ? { ...d, sizes: cleaned } : d;
      });
      return dirty ? next : prev;
    });
  }, [sizeOptions]);

  // Drop previously-picked style chips that the new audience doesn't offer
  // (e.g. "shirts" was set under Men, then merchant flips to Women where
  // the palette is Top / Bottom / Casual / Formal / Sports / Undergarments).
  useEffect(() => {
    if (!selectedAudience) return;
    const allowed = new Set(
      getQuickAddStyleTags(selectedAudience).map((t) => t.id)
    );
    setSelectedStyles((prev) => {
      const next = prev.filter((id) => allowed.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [selectedAudience]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const finalPrice = parseFloat(price);

    // A variant is usable when it has at least one image AND at least one
    // size with stock > 0. Empty placeholder rows are simply ignored.
    const usableDrafts = colorDrafts.filter(
      (d) =>
        d.images.length > 0 &&
        Object.values(d.sizes).some((q) => Number(q) > 0)
    );

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
      selectedStyles.length === 0 ||
      hasDupes
    ) {
      const msg = hasDupes
        ? "Two colors share the same name. Give each color a unique name."
        : "Fill every section: department, at least one style, and at least one color with photos AND per-size stock.";
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
        sizes: Record<string, number>;
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
        // Strip empty / zero entries so the doc stays clean.
        const sizesClean: Record<string, number> = {};
        for (const [k, v] of Object.entries(draft.sizes)) {
          const n = Math.max(0, Math.floor(Number(v) || 0));
          if (n > 0) sizesClean[k] = n;
        }
        colorVariants.push({
          color: colorName,
          ...(friendlyLabel ? { label: friendlyLabel } : {}),
          ...(draft.hex ? { hex: draft.hex } : {}),
          images: urls,
          sizes: sizesClean,
        });
      }

      // Backward-compat mirrors so legacy listing / filter / inventory code
      // that hasn't been migrated to colorVariants still sees correct data.
      const flatImages = colorVariants.flatMap((v) => v.images);
      const colorNames = colorVariants.map((v) => v.color);
      const unionSizes: Record<string, number> = {};
      for (const v of colorVariants) {
        for (const [k, n] of Object.entries(v.sizes)) {
          unionSizes[k] = (unionSizes[k] ?? 0) + n;
        }
      }
      const totalStock = Object.values(unionSizes).reduce((a, b) => a + b, 0);

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
        sizes: unionSizes,
        stock: totalStock,
      };

      const newDoc = await addDoc(collection(fb.db, "products"), productData);

      toast.success("Product added!");
      setCreatedProduct({
        productId: newDoc.id,
        name: productName,
        price: finalPrice,
        imageUrl: flatImages[0] ?? null,
        variants: colorVariants,
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
              {getQuickAddStyleTags(selectedAudience).map((tag) => (
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

        {/* ── Colors, photos & per-color sizes ──────────────────────── */}
        <ColorVariantsEditor
          drafts={colorDrafts}
          onChange={setColorDrafts}
          sizeOptions={sizeOptions}
          sizeGroupLabel={sizeGroupLabel}
          disabled={isLoading}
        />

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

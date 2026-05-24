"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import imageCompression from "browser-image-compression";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { Loader2 } from "lucide-react";
import { getDb, getFirebaseStorage } from "@/app/firebase";
import { buildImageStoragePath } from "@/lib/uploads/validate-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  normalizeImageUrls,
  resolveCategory,
  resolvePrice,
} from "@/lib/products/firestore-map";
import { getSizesMap } from "@/lib/admin/inventory";
import {
  PRODUCT_AUDIENCES,
  PRODUCT_CATEGORIES,
  productFormSchema,
  type ProductFormValues,
} from "@/lib/products/schema";
import {
  getSizeOptions,
  inferSizeGroup,
} from "@/lib/products/size-options";
import {
  buildNewProductData,
  buildUpdateProductData,
} from "@/lib/products/submit-helpers";
import {
  parseColorVariants,
  sanitizeVariantForWrite,
  type ColorVariant,
} from "@/lib/products/color-variants";
import { generateVariantCode } from "@/lib/products/variant-code";
import {
  ColorVariantsEditor,
  canonicalVariantName,
  makeEmptyVariantDraft,
  makeVariantDraftFromExisting,
  type DraftImage,
  type VariantDraft,
} from "@/components/admin/products/ColorVariantsEditor";

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPRESSION = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the initial color drafts for a product:
 *  • If the product already has `colorVariants`, load each one with its
 *    existing images + per-size stock.
 *  • Otherwise migrate the legacy flat `images` + `colors` + `sizes`/`size`
 *    fields into a single starter variant so admins can split into per-color
 *    groups later. The first legacy color (if any) seeds the variant name and
 *    the legacy size map seeds its stock.
 */
function buildInitialColorDrafts(
  data: Record<string, unknown> | null
): VariantDraft[] {
  if (!data) return [makeEmptyVariantDraft()];
  const existing = parseColorVariants(data);
  if (existing.length > 0) {
    return existing.map((v) => makeVariantDraftFromExisting(v));
  }
  const flatImages = normalizeImageUrls(data);
  const flatColors = Array.isArray(data.colors)
    ? data.colors.map((c) => String(c)).filter(Boolean)
    : [];
  // Pull the legacy size map (handles both `sizes` map and `size: [{...}]`).
  const legacySizes = getSizesMap(data);
  if (
    flatImages.length === 0 &&
    flatColors.length === 0 &&
    Object.keys(legacySizes).length === 0
  ) {
    return [makeEmptyVariantDraft()];
  }
  return [
    makeVariantDraftFromExisting({
      color: flatColors[0] ?? "default",
      images: flatImages,
      sizes: legacySizes,
    }),
  ];
}

/**
 * Form defaults — sizes / stock / colors are *placeholders* now; the real
 * values are derived from the variant editor on submit. They have to be
 * present to satisfy the existing zod schema, but are overwritten before
 * the doc is written.
 */
function formDefaultsFromDoc(
  data: Record<string, unknown> | null
): ProductFormValues {
  if (!data) {
    return {
      name: "",
      description: "",
      category: "shirts",
      audience: "men",
      price: 299,
      compareAtPrice: "",
      stock: 0,
      sizes: ["M"],
      colors: [],
    };
  }
  const { filter } = resolveCategory(data);
  const category = filter !== "other" ? filter : "shirts";
  const compareRaw = data.compareAtPrice;
  const compareStr =
    typeof compareRaw === "number"
      ? String(compareRaw)
      : typeof compareRaw === "string"
        ? compareRaw
        : "";
  const audRaw = data.audience;
  let audience: (typeof PRODUCT_AUDIENCES)[number] = "men";
  if (typeof audRaw === "string") {
    const a = audRaw.toLowerCase();
    if (a === "women" || a === "kids" || a === "men") audience = a;
  }
  return {
    name: typeof data.name === "string" ? data.name : String(data.name ?? ""),
    description: typeof data.description === "string" ? data.description : "",
    category,
    audience,
    price: Math.max(resolvePrice(data), 0.01),
    compareAtPrice: compareStr,
    stock: 0,
    sizes: ["M"],
    colors: [],
  };
}

async function uploadCompressedWithProgress(
  file: File,
  itemId: string,
  onProgress: (id: string, pct: number) => void
): Promise<string> {
  const compressed = await imageCompression(file, COMPRESSION);
  const storageRef = ref(getFirebaseStorage(), buildImageStoragePath(file, "products"));
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, compressed);
    task.on(
      "state_changed",
      (snap) => {
        const pct = snap.totalBytes
          ? (snap.bytesTransferred / snap.totalBytes) * 100
          : 0;
        onProgress(itemId, pct);
      },
      reject,
      async () => {
        onProgress(itemId, 100);
        resolve(await getDownloadURL(storageRef));
      }
    );
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProductCreatedMeta = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
};

export type ProductFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  productId: string | null;
  initialData: Record<string, unknown> | null;
  onSaved: (meta?: ProductCreatedMeta) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductFormDialog({
  open,
  onOpenChange,
  mode,
  productId,
  initialData,
  onSaved,
}: ProductFormDialogProps) {
  /** One row per colorway. Each row holds its own existing URLs + new uploads. */
  const [colorDrafts, setColorDrafts] = useState<VariantDraft[]>([
    makeEmptyVariantDraft(),
  ]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as Resolver<ProductFormValues>,
    defaultValues: formDefaultsFromDoc(null),
  });
  const { reset } = form;

  const watchedAudience = form.watch("audience");
  const watchedCategory = form.watch("category");

  // Size palette is decided by department + category. Kids → age brackets,
  // pants → numeric waist sizes, everything else → alpha XS–6XL.
  const sizeOptions = useMemo<readonly string[]>(
    () => getSizeOptions(watchedAudience, watchedCategory),
    [watchedAudience, watchedCategory]
  );
  const sizeGroup = useMemo(
    () => inferSizeGroup(watchedAudience, watchedCategory),
    [watchedAudience, watchedCategory]
  );
  const sizeGroupLabel = useMemo(() => {
    return sizeGroup === "kids"
      ? "Kids — age brackets"
      : sizeGroup === "numeric"
        ? "Waist (inches)"
        : "Alpha (XS–6XL)";
  }, [sizeGroup]);

  // Prune draft sizes that no longer apply when the admin flips
  // Men → Kids or Shirts → Pants. Keeps the variant doc consistent with the
  // displayed palette.
  useEffect(() => {
    const allowed = new Set(sizeOptions);
    setColorDrafts((prev) => {
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

  /** Revoke blob previews held by the current drafts (used on close/reset). */
  const revokeDraftBlobs = useCallback((drafts: VariantDraft[]) => {
    for (const d of drafts) {
      for (const img of d.images) {
        if (img.kind === "new") URL.revokeObjectURL(img.preview);
      }
    }
  }, []);

  // Reset everything when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setColorDrafts((prev) => {
        revokeDraftBlobs(prev);
        return [makeEmptyVariantDraft()];
      });
      setSubmitError(null);
      return;
    }
    reset(formDefaultsFromDoc(initialData));
    setColorDrafts(buildInitialColorDrafts(initialData));
    setSubmitError(null);
  }, [open, initialData, reset, revokeDraftBlobs]);

  // Submit
  const onSubmit = form.handleSubmit(async (values) => {
    // A variant is usable when it has at least one photo AND at least one
    // size with stock > 0. Empty placeholders are ignored.
    const usableDrafts = colorDrafts.filter(
      (d) =>
        d.images.length > 0 &&
        Object.values(d.sizes).some((q) => Number(q) > 0)
    );
    if (usableDrafts.length === 0) {
      setSubmitError(
        "Add at least one color with photos AND per-size stock."
      );
      return;
    }
    const nameCounts = new Map<string, number>();
    for (const d of usableDrafts) {
      const n = canonicalVariantName(d);
      nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
    }
    if (Array.from(nameCounts.values()).some((c) => c > 1)) {
      setSubmitError(
        "Two colors share the same name. Give each color a unique name."
      );
      return;
    }
    setSubmitError(null);
    setSubmitting(true);

    try {
      // For create flow, pre-allocate the doc id so deterministic variant
      // codes (which depend on productId) can be stamped into the same write.
      // For edit, we already know the id.
      const targetRef =
        mode === "create"
          ? doc(collection(getDb(), "products"))
          : productId
            ? doc(getDb(), "products", productId)
            : null;
      const targetId = targetRef?.id ?? productId ?? "";

      // Upload each variant's images in order; existing URLs are kept as-is.
      const variants: ColorVariant[] = [];
      for (const draft of usableDrafts) {
        const urls: string[] = [];
        for (const img of draft.images) {
          if (img.kind === "existing") {
            urls.push(img.url);
            continue;
          }
          const url = await uploadCompressedWithProgress(
            img.file,
            img.id,
            () => {}
          );
          urls.push(url);
        }
        const colorName = canonicalVariantName(draft);
        variants.push(
          sanitizeVariantForWrite({
            color: colorName,
            label: draft.label,
            hex: draft.hex,
            images: urls,
            sizes: draft.sizes,
            code: targetId ? generateVariantCode(targetId, colorName) : undefined,
          })
        );
      }

      // Flat code list mirrors the variants for Firestore array-contains.
      const variantCodes = variants
        .map((v) => v.code)
        .filter((c): c is string => Boolean(c));

      // Mirrors for legacy readers: flat images / colors, union sizes map,
      // aggregate stock total.
      const flatImages = variants.flatMap((v) => v.images);
      const flatColors = variants.map((v) => v.color);
      const unionSizes: Record<string, number> = {};
      for (const v of variants) {
        for (const [k, n] of Object.entries(v.sizes)) {
          unionSizes[k] = (unionSizes[k] ?? 0) + n;
        }
      }
      const unionSizeKeys = Object.keys(unionSizes).filter(
        (k) => unionSizes[k]! > 0
      );
      const stockTotal = Object.values(unionSizes).reduce(
        (a, b) => a + (Number(b) || 0),
        0
      );

      // Splice variants + derived mirrors into the buildXProductData payloads.
      const valuesForSubmit: ProductFormValues = {
        ...values,
        colors: flatColors,
        // Union of every size the product comes in (at least one stocked).
        sizes: unionSizeKeys.length > 0 ? unionSizeKeys : values.sizes,
        stock: stockTotal,
      };

      if (mode === "create" && targetRef) {
        await setDoc(targetRef, {
          ...buildNewProductData(valuesForSubmit, flatImages),
          colorVariants: variants,
          variantCodes,
          sizes: unionSizes, // size → total stock across colors (back-compat)
          image: flatImages[0] ?? "",
        });
        revokeDraftBlobs(colorDrafts);
        onSaved({
          productId: targetRef.id,
          name: values.name.trim(),
          price: values.price,
          imageUrl: flatImages[0] ?? null,
        });
      } else if (productId && targetRef) {
        await updateDoc(targetRef, {
          ...buildUpdateProductData(valuesForSubmit, flatImages),
          colorVariants: variants,
          variantCodes,
          sizes: unionSizes,
          image: flatImages[0] ?? "",
        });
        revokeDraftBlobs(colorDrafts);
        onSaved();
      } else {
        revokeDraftBlobs(colorDrafts);
        onSaved();
      }

      onOpenChange(false);
      reset(formDefaultsFromDoc(null));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save product."
      );
    } finally {
      setSubmitting(false);
    }
  });

  const newImageCount = useMemo(
    () =>
      colorDrafts.reduce(
        (acc, d) =>
          acc + d.images.filter((i: DraftImage) => i.kind === "new").length,
        0
      ),
    [colorDrafts]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card text-card-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add product" : "Edit product"}
          </DialogTitle>
          <DialogDescription>
            Compresses each image to max 1 MB / 1024 px before uploading.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="pf-name">Name</Label>
            <Input
              id="pf-name"
              {...form.register("name")}
              className="border-border bg-background"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="pf-desc">Description</Label>
            <Textarea
              id="pf-desc"
              rows={3}
              {...form.register("description")}
              className="border-border bg-background"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.watch("category")}
              onValueChange={(v) =>
                form.setValue("category", v as ProductFormValues["category"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full border-border bg-background">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Shop department (Explore filters + home “Shop by category”) */}
          <div className="space-y-2">
            <Label>Shop for</Label>
            <Select
              value={form.watch("audience")}
              onValueChange={(v) =>
                form.setValue("audience", v as ProductFormValues["audience"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full border-border bg-background">
                <SelectValue placeholder="Audience" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_AUDIENCES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pf-price">Price (₹)</Label>
              <Input
                id="pf-price"
                type="number"
                step="1"
                min={1}
                {...form.register("price", { valueAsNumber: true })}
                className="border-border bg-background"
              />
              {form.formState.errors.price && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.price.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-compare">Compare at ₹ (optional)</Label>
              <Input
                id="pf-compare"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 599"
                {...form.register("compareAtPrice")}
                className="border-border bg-background"
              />
            </div>
          </div>

          {/* Stock + sizes live INSIDE each color variant card now. */}
          <ColorVariantsEditor
            drafts={colorDrafts}
            onChange={setColorDrafts}
            sizeOptions={sizeOptions}
            sizeGroupLabel={sizeGroupLabel}
            disabled={submitting}
          />

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-orange-600 text-white hover:bg-orange-500"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {newImageCount > 0
                    ? `Uploading ${newImageCount} image${newImageCount !== 1 ? "s" : ""}…`
                    : "Saving…"}
                </>
              ) : mode === "create" ? (
                "Create product"
              ) : (
                "Save changes"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

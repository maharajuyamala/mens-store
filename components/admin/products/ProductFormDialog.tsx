"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import imageCompression from "browser-image-compression";
import {
  addDoc,
  collection,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { getDb, getFirebaseStorage } from "@/app/firebase";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  parseSizesFromDoc,
  resolveCategory,
  resolvePrice,
  resolveStock,
} from "@/lib/products/firestore-map";
import {
  PRODUCT_CATEGORIES,
  SIZE_OPTIONS,
  productFormSchema,
  type ProductFormValues,
} from "@/lib/products/schema";
import {
  buildNewProductData,
  buildUpdateProductData,
} from "@/lib/products/submit-helpers";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExistingItem = { kind: "existing"; id: string; url: string };
type NewItem = { kind: "new"; id: string; file: File; preview: string };
type ImageItem = ExistingItem | NewItem;

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPRESSION = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
} as const;

let _uid = 0;
function uid() {
  return `img-${++_uid}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formDefaultsFromDoc(
  data: Record<string, unknown> | null
): ProductFormValues {
  if (!data) {
    return {
      name: "",
      description: "",
      category: "shirts",
      price: 299,
      compareAtPrice: "",
      stock: 0,
      sizes: ["M"],
      colors: [],
    };
  }
  let sizes = parseSizesFromDoc(data);
  if (sizes.length === 0) sizes = ["M"];
  const { filter } = resolveCategory(data);
  const category = filter !== "other" ? filter : "shirts";
  const colors = Array.isArray(data.colors)
    ? data.colors.map((c) => String(c))
    : [];
  const compareRaw = data.compareAtPrice;
  const compareStr =
    typeof compareRaw === "number"
      ? String(compareRaw)
      : typeof compareRaw === "string"
        ? compareRaw
        : "";
  return {
    name: typeof data.name === "string" ? data.name : String(data.name ?? ""),
    description: typeof data.description === "string" ? data.description : "",
    category,
    price: Math.max(resolvePrice(data), 0.01),
    compareAtPrice: compareStr,
    stock: resolveStock(data),
    sizes,
    colors,
  };
}

async function uploadCompressedWithProgress(
  file: File,
  itemId: string,
  onProgress: (id: string, pct: number) => void
): Promise<string> {
  const compressed = await imageCompression(file, COMPRESSION);
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const path = `products/${Date.now()}-${itemId}-${safeName}`;
  const storageRef = ref(getFirebaseStorage(), path);
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
  // Unified image list — both existing URLs and new local files live here
  const [images, setImages] = useState<ImageItem[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const blobUrlsRef = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => fileInputRef.current?.click();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as Resolver<ProductFormValues>,
    defaultValues: formDefaultsFromDoc(null),
  });
  const { reset } = form;

  const [colorDraft, setColorDraft] = useState("");
  const watchedColors = form.watch("colors");
  const watchedSizes = form.watch("sizes");

  // Revoke all tracked blob URLs
  const revokeBlobs = useCallback(() => {
    blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    blobUrlsRef.current = [];
  }, []);

  // Reset everything when dialog opens/closes
  useEffect(() => {
    if (!open) {
      revokeBlobs();
      setImages([]);
      setProgress({});
      setSubmitError(null);
      setColorDraft("");
      return;
    }
    reset(formDefaultsFromDoc(initialData));
    const existingUrls = initialData ? normalizeImageUrls(initialData) : [];
    setImages(
      existingUrls.map((url) => ({ kind: "existing", id: uid(), url }))
    );
    setProgress({});
    setSubmitError(null);
  }, [open, initialData, reset, revokeBlobs]);

  // Pick files → add to unified list
  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    const additions: NewItem[] = Array.from(list).map((file) => {
      const preview = URL.createObjectURL(file);
      blobUrlsRef.current.push(preview);
      return { kind: "new", id: uid(), file, preview };
    });
    setImages((prev) => [...prev, ...additions]);
    e.target.value = "";
  };

  // Remove an item
  const removeImage = (id: string) => {
    setImages((prev) => {
      const item = prev.find((x) => x.id === id);
      if (item?.kind === "new") {
        URL.revokeObjectURL(item.preview);
        blobUrlsRef.current = blobUrlsRef.current.filter(
          (u) => u !== item.preview
        );
      }
      return prev.filter((x) => x.id !== id);
    });
  };

  // Move left / right
  const moveImage = (id: string, dir: -1 | 1) => {
    setImages((prev) => {
      const idx = prev.findIndex((x) => x.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx]!, next[idx]!];
      return next;
    });
  };

  // Color helpers
  const addColorTags = () => {
    const parts = colorDraft
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    form.setValue("colors", [...form.getValues("colors"), ...parts], {
      shouldValidate: true,
    });
    setColorDraft("");
  };
  const removeColorAt = (index: number) => {
    form.setValue(
      "colors",
      form.getValues("colors").filter((_, i) => i !== index),
      { shouldValidate: true }
    );
  };

  // Submit
  const onSubmit = form.handleSubmit(async (values) => {
    if (images.length < 1) {
      setSubmitError("Add at least one image.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    setProgress({});

    try {
      // Upload all new items, track progress per id
      const onProgress = (id: string, pct: number) =>
        setProgress((prev) => ({ ...prev, [id]: pct }));

      const uploadedUrls: Record<string, string> = {};
      for (const item of images) {
        if (item.kind === "new") {
          uploadedUrls[item.id] = await uploadCompressedWithProgress(
            item.file,
            item.id,
            onProgress
          );
        }
      }

      // Collect final ordered URL list
      const allUrls = images.map((item) =>
        item.kind === "existing" ? item.url : (uploadedUrls[item.id] ?? "")
      ).filter(Boolean);

      if (mode === "create") {
        const created = await addDoc(
          collection(getDb(), "products"),
          buildNewProductData(values, allUrls)
        );
        revokeBlobs();
        onSaved({
          productId: created.id,
          name: values.name.trim(),
          price: values.price,
          imageUrl: allUrls[0] ?? null,
        });
      } else if (productId) {
        await updateDoc(
          doc(getDb(), "products", productId),
          buildUpdateProductData(values, allUrls)
        );
        revokeBlobs();
        onSaved();
      } else {
        revokeBlobs();
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

  const newCount = images.filter((x) => x.kind === "new").length;

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

          {/* Stock */}
          <div className="space-y-2">
            <Label htmlFor="pf-stock">Stock quantity</Label>
            <Input
              id="pf-stock"
              type="number"
              min={0}
              step={1}
              {...form.register("stock", { valueAsNumber: true })}
              className="border-border bg-background"
            />
            {form.formState.errors.stock && (
              <p className="text-xs text-destructive">
                {form.formState.errors.stock.message}
              </p>
            )}
          </div>

          {/* Sizes */}
          <div className="space-y-2">
            <Label>Sizes</Label>
            <div className="flex flex-wrap gap-3">
              {SIZE_OPTIONS.map((size) => (
                <label
                  key={size}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={watchedSizes.includes(size)}
                    onCheckedChange={(checked) => {
                      const on = checked === true;
                      const next = on
                        ? [...new Set([...watchedSizes, size])]
                        : watchedSizes.filter((s) => s !== size);
                      form.setValue("sizes", next, { shouldValidate: true });
                    }}
                  />
                  {size}
                </label>
              ))}
            </div>
            {form.formState.errors.sizes && (
              <p className="text-xs text-destructive">
                {form.formState.errors.sizes.message}
              </p>
            )}
          </div>

          {/* Colors */}
          <div className="space-y-2">
            <Label>Colors</Label>
            <div className="flex gap-2">
              <Input
                value={colorDraft}
                onChange={(e) => setColorDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addColorTags();
                  }
                }}
                placeholder="Comma-separated or Enter"
                className="border-border bg-background"
              />
              <Button type="button" variant="secondary" onClick={addColorTags}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {watchedColors.map((color, index) => (
                <span
                  key={`${color}-${index}`}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {color}
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-background"
                    onClick={() => removeColorAt(index)}
                    aria-label={`Remove ${color}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* ── Images ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            {/* Single hidden file input — triggered via ref only */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onPickFiles}
              style={{ display: "none" }}
            />

            {/* Header row */}
            <div className="flex items-center justify-between">
              <Label>
                Images
                {images.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {images.length} photo{images.length !== 1 ? "s" : ""}
                    {newCount > 0 && ` · ${newCount} new`}
                  </span>
                )}
              </Label>
              <button
                type="button"
                onClick={openPicker}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-orange-500/70 bg-orange-500/5 px-3 py-1.5 text-xs font-semibold text-orange-500 transition-colors hover:bg-orange-500/10 active:bg-orange-500/20"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Add photos
              </button>
            </div>

            {/* Empty state — big tap target */}
            {images.length === 0 && (
              <button
                type="button"
                onClick={openPicker}
                className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/20 py-10 text-center transition-colors hover:border-orange-500/40 hover:bg-muted/40"
              >
                <div className="rounded-full bg-muted p-4">
                  <ImagePlus className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Tap to add product photos</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    JPG · PNG · WEBP — select multiple at once
                  </p>
                </div>
              </button>
            )}

            {/* Image grid */}
            {images.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  First image = card cover. ‹ › to reorder, × to remove.
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {images.map((item, idx) => {
                    const src =
                      item.kind === "existing" ? item.url : item.preview;
                    const uploadPct =
                      item.kind === "new" ? (progress[item.id] ?? 0) : 100;
                    const isUploading =
                      submitting && item.kind === "new" && uploadPct < 100;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "relative overflow-hidden rounded-xl border-2 bg-muted",
                          idx === 0 ? "border-orange-500" : "border-border"
                        )}
                      >
                        <div className="relative aspect-square">
                          <Image
                            src={src}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="100px"
                            unoptimized={item.kind === "new"}
                          />
                        </div>

                        {/* Upload progress overlay */}
                        {isUploading && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                            <Loader2 className="h-5 w-5 animate-spin text-white" />
                            <span className="mt-1 text-[10px] font-bold text-white">
                              {Math.round(uploadPct)}%
                            </span>
                            <div className="absolute bottom-0 inset-x-0 h-1 bg-black/30">
                              <div
                                className="h-full bg-orange-500 transition-all duration-200"
                                style={{ width: `${uploadPct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Cover / order badge */}
                        {idx === 0 ? (
                          <div className="absolute bottom-0 inset-x-0 bg-orange-500 py-0.5 text-center text-[9px] font-bold uppercase tracking-widest text-white">
                            Cover
                          </div>
                        ) : (
                          <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            {idx + 1}
                          </div>
                        )}

                        {/* Remove — always visible, top-right */}
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => removeImage(item.id)}
                          aria-label="Remove image"
                          className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white shadow transition-colors hover:bg-red-600 disabled:opacity-40"
                        >
                          <X className="h-3 w-3" />
                        </button>

                        {/* Move left — top-left (only when not first) */}
                        {idx > 0 && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => moveImage(item.id, -1)}
                            aria-label="Move left"
                            className="absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white shadow transition-colors hover:bg-black disabled:opacity-40"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                        )}

                        {/* Move right — bottom-right above cover badge */}
                        {idx < images.length - 1 && (
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => moveImage(item.id, 1)}
                            aria-label="Move right"
                            className="absolute bottom-5 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white shadow transition-colors hover:bg-black disabled:opacity-40"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        )}

                        {/* Orange dot = not yet uploaded */}
                        {item.kind === "new" && !submitting && (
                          <div className="absolute left-1 bottom-1 h-2 w-2 rounded-full bg-orange-400 ring-1 ring-white/50" />
                        )}
                      </div>
                    );
                  })}

                  {/* Add more tile */}
                  <button
                    type="button"
                    onClick={openPicker}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted/20 text-muted-foreground transition-colors hover:border-orange-500/50 hover:bg-muted/40 hover:text-orange-500"
                    style={{ aspectRatio: "1 / 1" }}
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-[10px] font-semibold">Add more</span>
                  </button>
                </div>
              </div>
            )}

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
          </div>

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
                  {newCount > 0
                    ? `Uploading ${newCount} image${newCount !== 1 ? "s" : ""}…`
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

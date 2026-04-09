"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
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
import { Loader2, Plus, X } from "lucide-react";
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

const COMPRESSION = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1024,
  useWebWorker: true,
} as const;

function formDefaultsFromDoc(
  data: Record<string, unknown> | null
): ProductFormValues {
  if (!data) {
    return {
      name: "",
      description: "",
      category: "shirts",
      price: 29.99,
      compareAtPrice: "",
      stock: 0,
      sizes: ["M"],
      colors: [],
    };
  }
  let sizes = parseSizesFromDoc(data);
  if (sizes.length === 0) sizes = ["M"];
  const { filter } = resolveCategory(data);
  const category =
    filter !== "other" ? filter : "shirts";
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
    description:
      typeof data.description === "string" ? data.description : "",
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
  key: string,
  onProgress: (pct: number) => void
): Promise<string> {
  const compressed = await imageCompression(file, COMPRESSION);
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const path = `products/${Date.now()}-${key}-${safeName}`;
  const storageRef = ref(getFirebaseStorage(), path);
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, compressed);
    task.on(
      "state_changed",
      (snap) => {
        const total = snap.totalBytes;
        const pct = total ? (snap.bytesTransferred / total) * 100 : 0;
        onProgress(pct);
      },
      reject,
      async () => {
        onProgress(100);
        const url = await getDownloadURL(storageRef);
        resolve(url);
      }
    );
  });
}

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
  /** Called after a successful save; includes `meta` when a new product was created. */
  onSaved: (meta?: ProductCreatedMeta) => void;
};

export function ProductFormDialog({
  open,
  onOpenChange,
  mode,
  productId,
  initialData,
  onSaved,
}: ProductFormDialogProps) {
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(
      productFormSchema
    ) as Resolver<ProductFormValues>,
    defaultValues: formDefaultsFromDoc(null),
  });
  const { reset } = form;

  const [colorDraft, setColorDraft] = useState("");
  const watchedColors = form.watch("colors");

  const resetDialogState = useCallback(() => {
    setNewFiles([]);
    setNewPreviews([]);
    setUploadProgress({});
    setSubmitError(null);
    setColorDraft("");
  }, []);

  useEffect(() => {
    if (!open) {
      resetDialogState();
      return;
    }
    const defaults = formDefaultsFromDoc(initialData);
    reset(defaults);
    setExistingImages(
      initialData ? normalizeImageUrls(initialData) : []
    );
    setNewFiles([]);
    setNewPreviews([]);
    setUploadProgress({});
    setSubmitError(null);
  }, [open, initialData, reset, resetDialogState]);

  const revokeNewPreviews = useCallback((urls: string[]) => {
    urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    setNewFiles((prev) => [...prev, ...Array.from(list)]);
    setNewPreviews((prev) => [
      ...prev,
      ...Array.from(list).map((f) => URL.createObjectURL(f)),
    ]);
    e.target.value = "";
  };

  const removeNewFile = (index: number) => {
    setNewPreviews((prev) => {
      const u = prev[index];
      if (u) URL.revokeObjectURL(u);
      return prev.filter((_, i) => i !== index);
    });
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (url: string) => {
    setExistingImages((prev) => prev.filter((u) => u !== url));
  };

  const addColorTags = () => {
    const parts = colorDraft
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...form.getValues("colors"), ...parts];
    form.setValue("colors", next, { shouldValidate: true });
    setColorDraft("");
  };

  const removeColorAt = (index: number) => {
    const next = form.getValues("colors").filter((_, i) => i !== index);
    form.setValue("colors", next, { shouldValidate: true });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const totalImages = existingImages.length + newFiles.length;
    if (totalImages < 1) {
      setSubmitError("Add at least one image.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    setUploadProgress({});

    try {
      const uploaded: string[] = [];
      for (let i = 0; i < newFiles.length; i++) {
        const file = newFiles[i];
        const key = `n${i}`;
        const url = await uploadCompressedWithProgress(file, key, (pct) => {
          setUploadProgress((prev) => ({ ...prev, [key]: pct }));
        });
        uploaded.push(url);
      }

      const allUrls = [...existingImages, ...uploaded];

      if (mode === "create") {
        const created = await addDoc(
          collection(getDb(), "products"),
          buildNewProductData(values, allUrls)
        );
        revokeNewPreviews(newPreviews);
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
        revokeNewPreviews(newPreviews);
        onSaved();
      } else {
        revokeNewPreviews(newPreviews);
        onSaved();
      }
      onOpenChange(false);
      resetDialogState();
      reset(formDefaultsFromDoc(null));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save product."
      );
    } finally {
      setSubmitting(false);
      setUploadProgress({});
    }
  });

  const watchedSizes = form.watch("sizes");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card text-card-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add product" : "Edit product"}
          </DialogTitle>
          <DialogDescription>
            Compresses images to max 1MB / 1024px, then uploads to Storage.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pf-name">Name</Label>
            <Input
              id="pf-name"
              {...form.register("name")}
              className="border-border bg-background"
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pf-desc">Description</Label>
            <Textarea
              id="pf-desc"
              rows={3}
              {...form.register("description")}
              className="border-border bg-background"
            />
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pf-price">Price</Label>
              <Input
                id="pf-price"
                type="number"
                step="0.01"
                min={0.01}
                {...form.register("price", { valueAsNumber: true })}
                className="border-border bg-background"
              />
              {form.formState.errors.price ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.price.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pf-compare">Compare at (optional)</Label>
              <Input
                id="pf-compare"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 49.99"
                {...form.register("compareAtPrice")}
                className="border-border bg-background"
              />
            </div>
          </div>

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
            {form.formState.errors.stock ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.stock.message}
              </p>
            ) : null}
          </div>

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
            {form.formState.errors.sizes ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.sizes.message}
              </p>
            ) : null}
          </div>

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

          <div className="space-y-2">
            <Label htmlFor="pf-images">Images</Label>
            <Input
              id="pf-images"
              type="file"
              accept="image/*"
              multiple
              onChange={onPickFiles}
              className="cursor-pointer border-border bg-background"
            />
            <div className="flex flex-wrap gap-2">
              {existingImages.map((url) => (
                <div
                  key={url}
                  className="relative h-16 w-16 overflow-hidden rounded-md border border-border"
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                    unoptimized={
                      url.startsWith("blob:") || url.startsWith("data:")
                    }
                  />
                  <button
                    type="button"
                    className="absolute right-0.5 top-0.5 rounded bg-black/70 p-0.5 text-white"
                    onClick={() => removeExistingImage(url)}
                    aria-label="Remove image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {newPreviews.map((src, i) => (
                <div
                  key={src}
                  className="relative h-16 w-16 overflow-hidden rounded-md border border-border"
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                    unoptimized
                  />
                  <button
                    type="button"
                    className="absolute right-0.5 top-0.5 rounded bg-black/70 p-0.5 text-white"
                    onClick={() => removeNewFile(i)}
                    aria-label="Remove new image"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            {newFiles.map((_, i) => {
              const key = `n${i}`;
              const pct = uploadProgress[key] ?? 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Upload {i + 1}</span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full bg-orange-500 transition-all duration-150",
                        submitting && pct < 100 && "animate-pulse"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {submitError ? (
            <p className="text-sm text-destructive">{submitError}</p>
          ) : null}

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
                  Saving…
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

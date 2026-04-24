"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ImagePlus, PlusCircle, UploadCloud, Loader2, Plus, Minus, X } from "lucide-react";
import imageCompression from "browser-image-compression";
import { getClientFirebase } from "@/app/firebase";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { toast } from "sonner";
import { useAdminAddProductStore } from "@/store/adminAddProductStore";
import { useProductBarcodeStore } from "@/store/productBarcodeStore";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { cn } from "@/lib/utils";
import {
  colorSwatchByValue,
  QUICK_ADD_AUDIENCES,
  QUICK_ADD_COLOR_SWATCHES,
  QUICK_ADD_STYLE_TAGS,
  type AudienceId,
} from "@/lib/add-product/quick-add-options";

const MULTI_PRINT_BG =
  "conic-gradient(from 45deg, #e53935, #fbc02d, #43a047, #1e88e5, #ab47bc, #e53935)";

function ColorSwatchDot({ value, hex }: { value: string; hex: string }) {
  if (value === "multi-print") {
    return (
      <span
        className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-border/80 shadow-sm"
        style={{ background: MULTI_PRINT_BG }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-border/70 shadow-sm"
      style={{ backgroundColor: hex }}
      aria-hidden
    />
  );
}

function ColorSwatchPickerBox({
  value,
  hex,
  label,
  selected,
  onPick,
}: {
  value: string;
  hex: string;
  label: string;
  selected: boolean;
  onPick: () => void;
}) {
  const isMulti = value === "multi-print";
  return (
    <button
      type="button"
      role="checkbox"
      title={label}
      aria-label={label}
      aria-checked={selected}
      onClick={onPick}
      className={cn(
        "aspect-square min-h-[2.25rem] w-full max-w-[2.75rem] rounded-lg border-2 p-0.5 outline-none transition-[transform,box-shadow] focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected
          ? "z-[1] border-orange-600 shadow-md ring-2 ring-orange-500 ring-offset-2 ring-offset-background"
          : "border-border/80 hover:z-[1] hover:scale-105 hover:border-orange-400/60 hover:shadow-sm"
      )}
    >
      <span
        className="block h-full w-full rounded-md border border-black/10 shadow-inner dark:border-white/15"
        style={
          isMulti
            ? { background: MULTI_PRINT_BG }
            : { backgroundColor: hex }
        }
        aria-hidden
      />
      {selected && (
        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-600 text-white text-xs font-bold">
          ✓
        </span>
      )}
    </button>
  );
}

/**
 * Controlled add-product dialog (sizes + stock per size). Open via store or AddProductOpenButton.
 */
export function AddItemDialog() {
  const open = useAdminAddProductStore((s) => s.open);
  const setOpen = useAdminAddProductStore((s) => s.setOpen);
  const openBarcodeSheet = useProductBarcodeStore((s) => s.openSheet);

  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [selectedColorValues, setSelectedColorValues] = useState<string[]>([]);
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>(
    {}
  );
  const [selectedAudience, setSelectedAudience] = useState<AudienceId | "">(
    ""
  );
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSizes = ["XS", "S", "M", "L", "XL", "XXL"];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setProductName("");
      setPrice("");
      setSelectedColorValues([]);
      setSizeQuantities({});
      setSelectedAudience("");
      setSelectedStyles([]);
      imagePreviews.forEach((u) => URL.revokeObjectURL(u));
      setImageFiles([]);
      setImagePreviews([]);
      setError(null);
    }
  };

  const handleImagePick = () => imageInputRef.current?.click();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list?.length) return;
    const newFiles = Array.from(list);
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setImageFiles((prev) => [...prev, ...newFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
    e.target.value = "";
  };

  const removeImageAt = (index: number) => {
    setImagePreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStyleToggle = (tagId: string) => {
    setSelectedStyles((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleQuantityChange = (size: string, newQuantity: number) => {
    const quantity = Math.max(0, newQuantity);
    setSizeQuantities((prev) => ({ ...prev, [size]: quantity }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const finalPrice = parseFloat(price);
    const sizesToSubmit = Object.entries(sizeQuantities)
      .filter(([, quantity]) => quantity > 0)
      .reduce(
        (acc, [size, quantity]) => {
          acc[size] = quantity;
          return acc;
        },
        {} as Record<string, number>
      );

    const colorLabels = selectedColorValues.map(value => 
      colorSwatchByValue(value)?.label ?? value
    );

    const validationMsg =
      "Fill all fields: department, at least one style, color, image, price, name, and stock for at least one size.";

    if (
      !productName ||
      !price ||
      Number.isNaN(finalPrice) ||
      imageFiles.length === 0 ||
      !selectedColorValues.length ||
      !selectedAudience ||
      Object.keys(sizesToSubmit).length === 0 ||
      selectedStyles.length === 0
    ) {
      setError(validationMsg);
      toast.error("Complete the form", { description: validationMsg });
      return;
    }

    const fb = getClientFirebase();
    if (!fb) {
      const msg =
        "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* to .env.local and restart.";
      setError(msg);
      toast.error("Firebase not configured", { description: msg });
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

      // Upload all images
      const imageUrls: string[] = [];
      for (const file of imageFiles) {
        const imageRef = ref(
          fb.storage,
          `products/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`
        );
        const compressedFile = await imageCompression(file, options);
        await uploadBytes(imageRef, compressedFile);
        imageUrls.push(await getDownloadURL(imageRef));
      }

      const tagsForSearch = [selectedAudience, ...selectedStyles];

      const productData = {
        id: `${Date.now()}`,
        name: productName,
        price: finalPrice,
        images: imageUrls,
        image: imageUrls[0] ?? "",
        tags: tagsForSearch,
        audience: selectedAudience,
        colors: colorLabels,
        description: "This is a description",
        size: [sizesToSubmit],
      };

      const newDoc = await addDoc(collection(fb.db, "products"), productData);

      handleOpenChange(false);
      openBarcodeSheet({
        productId: newDoc.id,
        name: productName,
        price: finalPrice,
        imageUrl: imageUrls[0] ?? null,
      });
    } catch (err) {
      console.error("Error adding product: ", err);
      const msg =
        "Failed to add product. Check the console and verify your Firestore rules.";
      setError(msg);
      toast.error("Could not add product", {
        description: err instanceof Error ? err.message : msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80svh] overflow-y-auto border-border bg-card text-card-foreground sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Add new product</DialogTitle>
          <DialogDescription>
            Choose department (Men / Women / Kids), then styles, color, image,
            price, and stock per size.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex flex-col gap-4"
        >
          <div className="max-h-[65vh] space-y-6 overflow-y-auto py-2 pr-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Product images
                {imagePreviews.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {imagePreviews.length} photo{imagePreviews.length !== 1 ? "s" : ""}
                  </span>
                )}
              </Label>
              {imagePreviews.length > 0 && (
                <button
                  type="button"
                  onClick={handleImagePick}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-orange-500/70 bg-orange-500/5 px-3 py-1.5 text-xs font-semibold text-orange-500 transition-colors hover:bg-orange-500/10"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Add more
                </button>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              style={{ display: "none" }}
            />

            {imagePreviews.length === 0 ? (
              <button
                type="button"
                onClick={handleImagePick}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 py-10 transition-colors hover:border-orange-500/40 hover:bg-muted/40"
              >
                <UploadCloud className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-orange-600">
                    Tap to select photos
                  </span>
                  {" "}— select multiple at once
                </p>
              </button>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  First image = card cover. Tap × to remove.
                </p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {imagePreviews.map((src, idx) => (
                    <div
                      key={src}
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
                          sizes="80px"
                          unoptimized
                        />
                      </div>
                      {idx === 0 && (
                        <div className="absolute bottom-0 inset-x-0 bg-orange-500 py-0.5 text-center text-[8px] font-bold uppercase tracking-widest text-white">
                          Cover
                        </div>
                      )}
                      {idx > 0 && (
                        <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[8px] font-bold text-white">
                          {idx + 1}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImageAt(idx)}
                        aria-label="Remove image"
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white shadow hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {/* Add more tile */}
                  <button
                    type="button"
                    onClick={handleImagePick}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted/20 text-muted-foreground transition-colors hover:border-orange-500/50 hover:text-orange-500"
                    style={{ aspectRatio: "1 / 1" }}
                  >
                    <PlusCircle className="h-5 w-5" />
                    <span className="text-[9px] font-semibold">Add</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product-name">Product name</Label>
              <Input
                id="product-name"
                placeholder="e.g. Onyx silk-blend shirt"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="border-border bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                placeholder="e.g. 1200"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="border-border bg-background"
              />
            </div>
          </div>
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

          {selectedAudience ? (
            <div className="space-y-2">
              <Label>Style & type (select one or more)</Label>
              <p className="text-xs text-muted-foreground">
                Tags for this department: sports, casual, formal, pants, shirts,
                undergarments.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {QUICK_ADD_STYLE_TAGS.map((tag) => (
                  <button
                    type="button"
                    key={tag.id}
                    onClick={() => handleStyleToggle(tag.id)}
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

          <div className="space-y-3">
            <div>
              <Label id="color-picker-label">Colors (select one or more)</Label>
              <p className="mt-0.5 text-xs text-muted-foreground" id="color-picker-hint">
                Click boxes to choose colors. Hover for the color name.
              </p>
            </div>
            <div
              role="group"
              aria-labelledby="color-picker-label"
              aria-describedby="color-picker-hint"
              className="grid max-h-[min(40vh,14rem)] grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 sm:max-h-[min(45vh,16rem)] sm:grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))]"
            >
              {QUICK_ADD_COLOR_SWATCHES.map((c) => (
                <ColorSwatchPickerBox
                  key={c.value}
                  value={c.value}
                  hex={c.hex}
                  label={c.label}
                  selected={selectedColorValues.includes(c.value)}
                  onPick={() => {
                    setSelectedColorValues(prev => 
                      prev.includes(c.value) 
                        ? prev.filter(v => v !== c.value)
                        : [...prev, c.value]
                    );
                  }}
                />
              ))}
            </div>
            {selectedColorValues.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedColorValues.map(value => (
                  <div key={value} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <ColorSwatchDot
                      value={value}
                      hex={colorSwatchByValue(value)?.hex ?? "#ccc"}
                    />
                    <span className="font-medium text-foreground">
                      {colorSwatchByValue(value)?.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedColorValues(prev => prev.filter(v => v !== value))}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${colorSwatchByValue(value)?.label}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No colors selected yet.</p>
            )}
          </div>

          <div className="space-y-3">
            <Label>Available sizes & stock</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {availableSizes.map((size) => (
                <div
                  key={size}
                  className="flex flex-col items-center gap-2 rounded-lg border border-border bg-muted/30 p-2"
                >
                  <span className="text-sm font-medium">{size}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() =>
                        handleQuantityChange(
                          size,
                          (sizeQuantities[size] || 0) - 1
                        )
                      }
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      className="h-8 w-12 border-border bg-background text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                      className="h-8 w-8"
                      onClick={() =>
                        handleQuantityChange(
                          size,
                          (sizeQuantities[size] || 0) + 1
                        )
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          </div>

          {error ? (
            <p
              className="shrink-0 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <DialogFooter className="shrink-0 sm:justify-end">
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-orange-600 text-white hover:bg-orange-500"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Add product"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Header / toolbar trigger — opens the same dialog as mobile + button */
export function AddProductOpenButton({
  className,
  variant = "header",
}: {
  className?: string;
  variant?: "header" | "icon-only";
}) {
  if (variant === "icon-only") {
    return (
      <Link
        href="/admin/add-product"
        className={cn(
          "inline-flex rounded-full border border-border p-2.5 text-foreground transition-colors hover:border-orange-500",
          className
        )}
        aria-label="Add product"
      >
        <PlusCircle className="h-5 w-5" />
      </Link>
    );
  }

  return (
    <Link
      href="/admin/add-product"
      className={cn(
        "hidden items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-500/20 md:inline-flex dark:text-orange-400",
        className
      )}
      aria-label="Add product"
    >
      <PlusCircle className="size-4 shrink-0" />
      Add product
    </Link>
  );
}

"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { PlusCircle, UploadCloud, Loader2, Plus, Minus } from "lucide-react";
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
      role="radio"
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
  const [selectedColorValue, setSelectedColorValue] = useState("");
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>(
    {}
  );
  const [selectedAudience, setSelectedAudience] = useState<AudienceId | "">(
    ""
  );
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSizes = ["XS", "S", "M", "L", "XL", "XXL"];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setProductName("");
      setPrice("");
      setSelectedColorValue("");
      setSizeQuantities({});
      setSelectedAudience("");
      setSelectedStyles([]);
      setImageFile(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      setError(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
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

    const colorLabel =
      colorSwatchByValue(selectedColorValue)?.label ?? selectedColorValue;

    const validationMsg =
      "Fill all fields: department, at least one style, color, image, price, name, and stock for at least one size.";

    if (
      !productName ||
      !price ||
      Number.isNaN(finalPrice) ||
      !imageFile ||
      !selectedColorValue ||
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
      const imageRef = ref(
        fb.storage,
        `products/${Date.now()}-${imageFile.name}`
      );
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(imageFile, options);
      await uploadBytes(imageRef, compressedFile);
      const imageUrl = await getDownloadURL(imageRef);

      const tagsForSearch = [selectedAudience, ...selectedStyles];

      const productData = {
        id: `${Date.now()}`,
        name: productName,
        price: finalPrice,
        image: imageUrl,
        tags: tagsForSearch,
        audience: selectedAudience,
        color: colorLabel,
        colorValue: selectedColorValue,
        description: "This is a description",
        size: [sizesToSubmit],
      };

      const newDoc = await addDoc(collection(fb.db, "products"), productData);

      handleOpenChange(false);
      openBarcodeSheet({
        productId: newDoc.id,
        name: productName,
        price: finalPrice,
        imageUrl: imageUrl,
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
          <div>
            <Label htmlFor="product-image">Product image</Label>
            <div className="relative mt-2 flex h-48 w-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/40 p-2 transition-colors hover:border-orange-500/50">
              {imagePreview ? (
                <Image
                  src={imagePreview}
                  alt="Preview"
                  fill
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="text-center">
                  <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-orange-600">
                      Click to upload
                    </span>
                  </p>
                </div>
              )}
              <Input
                id="product-image"
                type="file"
                onChange={handleImageChange}
                accept="image/*"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
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
              <Label id="color-picker-label">Color</Label>
              <p className="mt-0.5 text-xs text-muted-foreground" id="color-picker-hint">
                Click a box to choose. Hover for the color name.
              </p>
            </div>
            <div
              role="radiogroup"
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
                  selected={selectedColorValue === c.value}
                  onPick={() => setSelectedColorValue(c.value)}
                />
              ))}
            </div>
            {selectedColorValue ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <ColorSwatchDot
                  value={selectedColorValue}
                  hex={colorSwatchByValue(selectedColorValue)?.hex ?? "#ccc"}
                />
                <span className="font-medium text-foreground">
                  {colorSwatchByValue(selectedColorValue)?.label}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No color selected yet.</p>
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
  const openDialog = useAdminAddProductStore((s) => s.openDialog);

  if (variant === "icon-only") {
    return (
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => openDialog()}
        className={cn(
          "inline-flex rounded-full border border-border p-2.5 text-foreground transition-colors hover:border-orange-500",
          className
        )}
        aria-label="Add product"
      >
        <PlusCircle className="h-5 w-5" />
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => openDialog()}
      className={cn(
        "hidden items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-500/20 md:inline-flex dark:text-orange-400",
        className
      )}
      aria-label="Add product"
    >
      <PlusCircle className="size-4 shrink-0" />
      Add product
    </motion.button>
  );
}

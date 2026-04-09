"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { PlusCircle, UploadCloud, Loader2, Plus, Minus } from "lucide-react";
import imageCompression from "browser-image-compression";
import { getDb, getFirebaseStorage } from "@/app/firebase";
import { collection, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

/**
 * Controlled add-product dialog (sizes + stock per size). Open via store or AddProductOpenButton.
 */
export function AddItemDialog() {
  const open = useAdminAddProductStore((s) => s.open);
  const setOpen = useAdminAddProductStore((s) => s.setOpen);
  const openBarcodeSheet = useProductBarcodeStore((s) => s.openSheet);

  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>(
    {}
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTags = [
    "sport",
    "casual",
    "formal",
    "shirts",
    "pants",
    "shorts",
    "undergarments",
    "luxury",
  ];
  const availableColors = [
    "Onyx Black",
    "Silk White",
    "Stone Gray",
    "Ocean Blue",
    "Forest Green",
  ];
  const availableSizes = ["XS", "S", "M", "L", "XL", "XXL"];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setProductName("");
      setPrice("");
      setSelectedColor("");
      setSizeQuantities({});
      setSelectedTags([]);
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

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleQuantityChange = (size: string, newQuantity: number) => {
    const quantity = Math.max(0, newQuantity);
    setSizeQuantities((prev) => ({ ...prev, [size]: quantity }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    if (
      !productName ||
      !price ||
      Number.isNaN(finalPrice) ||
      !imageFile ||
      !selectedColor ||
      Object.keys(sizesToSubmit).length === 0 ||
      selectedTags.length === 0
    ) {
      setError(
        "Please fill all fields. Price must be a number and at least one size must have stock."
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const imageRef = ref(
        getFirebaseStorage(),
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

      const productData = {
        id: `${Date.now()}`,
        name: productName,
        price: finalPrice,
        image: imageUrl,
        tags: selectedTags,
        color: selectedColor,
        description: "This is a description",
        size: [sizesToSubmit],
      };

      const newDoc = await addDoc(collection(getDb(), "products"), productData);

      handleOpenChange(false);
      openBarcodeSheet({
        productId: newDoc.id,
        name: productName,
        price: finalPrice,
        imageUrl: imageUrl,
      });
    } catch (err) {
      console.error("Error adding product: ", err);
      setError(
        "Failed to add product. Check the console and verify your Firestore rules."
      );
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
            Upload an image, set price, color, categories, and stock per size.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="max-h-[65vh] space-y-6 overflow-y-auto py-2 pr-1"
        >
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
            <Label>Color</Label>
            <Select value={selectedColor} onValueChange={setSelectedColor}>
              <SelectTrigger className="w-full border-border bg-background">
                <SelectValue placeholder="Select a color" />
              </SelectTrigger>
              <SelectContent>
                {availableColors.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div className="space-y-2">
            <Label>Categories (select multiple)</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {availableTags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2",
                    selectedTags.includes(tag)
                      ? "bg-orange-600 text-white shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {tag.charAt(0).toUpperCase() + tag.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-orange-600 text-white hover:bg-orange-500"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Add product"
            )}
          </Button>
        </DialogFooter>
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

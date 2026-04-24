"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  CheckCircle2,
  ChevronLeft,
  ImagePlus,
  Loader2,
  Minus,
  Plus,
  PlusCircle,
  Printer,
  UploadCloud,
  X,
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

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL"];

export default function AddProductPage() {
  // Form state
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [pickerColor, setPickerColor] = useState("#000000");
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>(
    {}
  );
  const [selectedAudience, setSelectedAudience] = useState<AudienceId | "">("");
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Post-create state
  const [createdProduct, setCreatedProduct] = useState<CreatedProduct | null>(
    null
  );

  const openPicker = () => imageInputRef.current?.click();

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

  const resetForm = useCallback(() => {
    setProductName("");
    setPrice("");
    setSelectedColors([]);
    setPickerColor("#000000");
    setSizeQuantities({});
    setSelectedAudience("");
    setSelectedStyles([]);
    imagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setImageFiles([]);
    setImagePreviews([]);
    setError(null);
    setCreatedProduct(null);
  }, [imagePreviews]);

  const handleQuantityChange = (size: string, qty: number) => {
    setSizeQuantities((prev) => ({ ...prev, [size]: Math.max(0, qty) }));
  };

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

    if (
      !productName ||
      !price ||
      Number.isNaN(finalPrice) ||
      imageFiles.length === 0 ||
      !selectedColors.length ||
      !selectedAudience ||
      Object.keys(sizesToSubmit).length === 0 ||
      selectedStyles.length === 0
    ) {
      const msg =
        "Fill all fields: department, at least one style, color, image, price, name, and stock for at least one size.";
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

      const imageUrls: string[] = [];
      for (const file of imageFiles) {
        const imageRef = ref(
          fb.storage,
          `products/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`
        );
        const compressed = await imageCompression(file, options);
        await uploadBytes(imageRef, compressed);
        imageUrls.push(await getDownloadURL(imageRef));
      }

      const productData = {
        id: `${Date.now()}`,
        name: productName,
        price: finalPrice,
        images: imageUrls,
        image: imageUrls[0] ?? "",
        tags: [selectedAudience, ...selectedStyles],
        audience: selectedAudience,
        colors: selectedColors,
        description: "",
        size: [sizesToSubmit],
      };

      const newDoc = await addDoc(collection(fb.db, "products"), productData);

      toast.success("Product added!");
      setCreatedProduct({
        productId: newDoc.id,
        name: productName,
        price: finalPrice,
        imageUrl: imageUrls[0] ?? null,
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
        {/* ── Images ──────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>
              Product images
              {imagePreviews.length > 0 && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {imagePreviews.length} photo
                  {imagePreviews.length !== 1 ? "s" : ""}
                </span>
              )}
            </Label>
            {imagePreviews.length > 0 && (
              <button
                type="button"
                onClick={openPicker}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-orange-500/70 bg-orange-500/5 px-3 py-1.5 text-xs font-semibold text-orange-500 transition-colors hover:bg-orange-500/10"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Add more
              </button>
            )}
          </div>

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
              onClick={openPicker}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/20 py-12 transition-colors hover:border-orange-500/40 hover:bg-muted/40"
            >
              <div className="rounded-full bg-muted p-4">
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">
                  Tap to select product photos
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Select multiple at once — first image = card cover
                </p>
              </div>
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
                        sizes="100px"
                        unoptimized
                      />
                    </div>
                    {idx === 0 && (
                      <div className="absolute inset-x-0 bottom-0 bg-orange-500 py-0.5 text-center text-[8px] font-bold uppercase tracking-widest text-white">
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
                <button
                  type="button"
                  onClick={openPicker}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-muted/20 text-muted-foreground transition-colors hover:border-orange-500/50 hover:text-orange-500"
                  style={{ aspectRatio: "1 / 1" }}
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-[9px] font-semibold">Add</span>
                </button>
              </div>
            </div>
          )}
        </div>

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

        {/* ── Colors ────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <Label>Colors (pick one or more)</Label>
          <div className="flex items-center gap-3">
            <label className="relative flex h-10 w-10 cursor-pointer items-center justify-center">
              <input
                type="color"
                value={pickerColor}
                onChange={(e) => setPickerColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <span
                className="block h-9 w-9 rounded-full border-2 border-border shadow-sm transition-transform hover:scale-110"
                style={{ backgroundColor: pickerColor }}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const c = pickerColor.toLowerCase();
                if (!selectedColors.includes(c)) {
                  setSelectedColors((prev) => [...prev, c]);
                }
              }}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add color
            </Button>
          </div>
          {selectedColors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedColors.map((hex) => (
                <span
                  key={hex}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <span
                    className="inline-block h-4 w-4 rounded-full border border-border/50 shadow-inner"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="font-mono text-xs uppercase">{hex}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedColors((prev) =>
                        prev.filter((v) => v !== hex)
                      )
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Sizes & stock ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <Label>Available sizes & stock</Label>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {SIZES.map((size) => (
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
                    className="h-7 w-10 border-border bg-background text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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

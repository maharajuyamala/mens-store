"use client";

import Image from "next/image";
import { useRef } from "react";
import {
  ImagePlus,
  Minus,
  Palette,
  Plus,
  Ruler,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateImageFile } from "@/lib/uploads/validate-image";
import { formatSizeLabel } from "@/lib/products/size-options";
import { cn } from "@/lib/utils";

/**
 * One image inside a color draft. "existing" already lives in Firebase Storage
 * (e.g. a previously saved variant photo); "new" is a local File pending upload.
 */
export type DraftImage =
  | { kind: "existing"; id: string; url: string }
  | { kind: "new"; id: string; file: File; preview: string };

/**
 * One in-flight color variant being authored. `color` is the canonical lowercase
 * name stored on the cart / order line; `label` is the optional pretty label
 * shown on the storefront; `hex` is the swatch fill; `sizes` is the per-size
 * stock map for this color (e.g. `{ M: 2, L: 1 }`).
 */
export type VariantDraft = {
  id: string;
  color: string;
  label: string;
  hex: string;
  images: DraftImage[];
  sizes: Record<string, number>;
};

let _vdUid = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++_vdUid}`;

export function makeEmptyVariantDraft(): VariantDraft {
  return {
    id: nextId("vd"),
    color: "",
    label: "",
    hex: "#000000",
    images: [],
    sizes: {},
  };
}

export function makeVariantDraftFromExisting(input: {
  color: string;
  label?: string;
  hex?: string;
  images: string[];
  sizes?: Record<string, number>;
}): VariantDraft {
  return {
    id: nextId("vd"),
    color: input.color,
    label: input.label ?? "",
    hex: input.hex ?? "#000000",
    images: input.images.map((url) => ({
      kind: "existing",
      id: nextId("img"),
      url,
    })),
    sizes: { ...(input.sizes ?? {}) },
  };
}

/** Pick a canonical lowercase color name — falls back to hex when blank. */
export function canonicalVariantName(draft: VariantDraft): string {
  const name = draft.color.trim().toLowerCase();
  if (name) return name;
  return draft.hex.toLowerCase().replace(/^#/, "");
}

type EditorProps = {
  drafts: VariantDraft[];
  onChange: (next: VariantDraft[]) => void;
  /** Available size keys for this product (audience/category-dependent). */
  sizeOptions: readonly string[];
  /** Optional copy hint shown above the size grid (e.g. "Waist (inches)"). */
  sizeGroupLabel?: string;
  /** Disable interactions during submit so the form can't be mutated mid-upload. */
  disabled?: boolean;
};

export function ColorVariantsEditor({
  drafts,
  onChange,
  sizeOptions,
  sizeGroupLabel,
  disabled,
}: EditorProps) {
  const addDraft = () => onChange([...drafts, makeEmptyVariantDraft()]);

  const removeDraft = (id: string) => {
    const next: VariantDraft[] = [];
    for (const d of drafts) {
      if (d.id === id) {
        // Revoke any blob previews held by the removed draft so we don't leak.
        for (const img of d.images) {
          if (img.kind === "new") URL.revokeObjectURL(img.preview);
        }
        continue;
      }
      next.push(d);
    }
    onChange(next.length > 0 ? next : [makeEmptyVariantDraft()]);
  };

  const patchDraft = (
    id: string,
    patch: Partial<Pick<VariantDraft, "color" | "label" | "hex">>
  ) => {
    onChange(drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const appendImages = (id: string, files: File[]) => {
    if (files.length === 0) return;
    const accepted: File[] = [];
    for (const f of files) {
      const check = validateImageFile(f);
      if (!check.ok) {
        toast.error("Image rejected", { description: check.reason });
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length === 0) return;
    const newItems: DraftImage[] = accepted.map((file) => ({
      kind: "new",
      id: nextId("img"),
      file,
      preview: URL.createObjectURL(file),
    }));
    onChange(
      drafts.map((d) =>
        d.id === id ? { ...d, images: [...d.images, ...newItems] } : d
      )
    );
  };

  const removeImage = (draftId: string, imageId: string) => {
    onChange(
      drafts.map((d) => {
        if (d.id !== draftId) return d;
        const next: DraftImage[] = [];
        for (const img of d.images) {
          if (img.id === imageId) {
            if (img.kind === "new") URL.revokeObjectURL(img.preview);
            continue;
          }
          next.push(img);
        }
        return { ...d, images: next };
      })
    );
  };

  const setSizeQty = (draftId: string, size: string, qty: number) => {
    onChange(
      drafts.map((d) => {
        if (d.id !== draftId) return d;
        const next: Record<string, number> = { ...d.sizes };
        if (qty <= 0) delete next[size];
        else next[size] = Math.max(0, Math.floor(qty));
        return { ...d, sizes: next };
      })
    );
  };

  // Prune sizes that aren't in the current palette when audience/category
  // changes (e.g. admin flips Shirts → Pants and the palette becomes 26/28/…).
  // We don't mutate inside render; instead we surface the stale keys so the
  // parent can show a warning if needed. The submit-time validator will catch
  // sizes left in `draft.sizes` that aren't in `sizeOptions`.

  const usableCount = drafts.filter(
    (d) =>
      d.images.length > 0 &&
      Object.values(d.sizes).some((q) => Number(q) > 0)
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label className="inline-flex items-center gap-2">
          <Palette className="h-4 w-4 text-orange-500" />
          Colors & images
          <span className="text-xs font-normal text-muted-foreground">
            ({usableCount} with photos)
          </span>
        </Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addDraft}
          disabled={disabled}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add color
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Each color has its own photos <span className="font-medium">and its own per-size stock</span>.
        The storefront swaps the gallery and the size availability when a
        customer taps the matching swatch.
      </p>

      <div className="space-y-4">
        {drafts.map((draft, idx) => (
          <VariantDraftCard
            key={draft.id}
            index={idx + 1}
            draft={draft}
            canRemove={drafts.length > 1 && !disabled}
            disabled={disabled}
            sizeOptions={sizeOptions}
            sizeGroupLabel={sizeGroupLabel}
            onChange={(patch) => patchDraft(draft.id, patch)}
            onRemove={() => removeDraft(draft.id)}
            onAddImages={(files) => appendImages(draft.id, files)}
            onRemoveImage={(imageId) => removeImage(draft.id, imageId)}
            onSizeChange={(size, qty) => setSizeQty(draft.id, size, qty)}
          />
        ))}
      </div>
    </div>
  );
}

function VariantDraftCard({
  index,
  draft,
  canRemove,
  disabled,
  sizeOptions,
  sizeGroupLabel,
  onChange,
  onRemove,
  onAddImages,
  onRemoveImage,
  onSizeChange,
}: {
  index: number;
  draft: VariantDraft;
  canRemove: boolean;
  disabled?: boolean;
  sizeOptions: readonly string[];
  sizeGroupLabel?: string;
  onChange: (patch: Partial<Pick<VariantDraft, "color" | "label" | "hex">>) => void;
  onRemove: () => void;
  onAddImages: (files: File[]) => void;
  onRemoveImage: (imageId: string) => void;
  onSizeChange: (size: string, qty: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = () => inputRef.current?.click();

  const variantTotalStock = Object.values(draft.sizes).reduce(
    (acc, n) => acc + (Number(n) || 0),
    0
  );

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (list && list.length > 0) onAddImages(Array.from(list));
    e.target.value = "";
  };

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-7 w-7 rounded-full border-2 border-border shadow-inner"
            style={{ backgroundColor: draft.hex || "#000000" }}
          />
          <span className="text-sm font-semibold text-muted-foreground">
            Color {index}
          </span>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
            aria-label="Remove color"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr_1fr]">
        <div className="space-y-1">
          <Label className="text-xs">Swatch</Label>
          <label className="relative flex h-10 w-10 cursor-pointer items-center justify-center">
            <input
              type="color"
              value={draft.hex}
              onChange={(e) => onChange({ hex: e.target.value })}
              disabled={disabled}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              aria-label="Pick swatch color"
            />
            <span
              className="block h-9 w-9 rounded-full border-2 border-border shadow-sm transition-transform hover:scale-110"
              style={{ backgroundColor: draft.hex }}
            />
          </label>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`vd-name-${draft.id}`} className="text-xs">
            Name <span className="text-muted-foreground">(short, e.g. wine)</span>
          </Label>
          <Input
            id={`vd-name-${draft.id}`}
            placeholder="wine"
            value={draft.color}
            onChange={(e) => onChange({ color: e.target.value })}
            disabled={disabled}
            className="border-border bg-background"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`vd-label-${draft.id}`} className="text-xs">
            Display label{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id={`vd-label-${draft.id}`}
            placeholder="Wine red"
            value={draft.label}
            onChange={(e) => onChange({ label: e.target.value })}
            disabled={disabled}
            className="border-border bg-background"
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">
            Photos for this color
            {draft.images.length > 0 && (
              <span className="ml-1 text-muted-foreground">
                ({draft.images.length})
              </span>
            )}
          </Label>
          {draft.images.length > 0 && (
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-orange-500/70 bg-orange-500/5 px-2.5 py-1 text-xs font-semibold text-orange-500 transition-colors hover:bg-orange-500/10 disabled:opacity-40"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              Add more
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          onChange={onFiles}
          style={{ display: "none" }}
        />

        {draft.images.length === 0 ? (
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/40 py-8 transition-colors hover:border-orange-500/40 hover:bg-background/70 disabled:opacity-40"
          >
            <div className="rounded-full bg-muted p-3">
              <UploadCloud className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-xs font-semibold">
              Tap to add photos for this color
            </p>
            <p className="text-[10px] text-muted-foreground">
              First photo = cover for this color
            </p>
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {draft.images.map((img, i) => {
              const src = img.kind === "existing" ? img.url : img.preview;
              return (
                <div
                  key={img.id}
                  className={cn(
                    "relative overflow-hidden rounded-lg border-2 bg-muted",
                    i === 0 ? "border-orange-500" : "border-border"
                  )}
                >
                  <div className="relative aspect-square">
                    <Image
                      src={src}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                      unoptimized={img.kind === "new"}
                    />
                  </div>
                  {i === 0 && (
                    <div className="absolute inset-x-0 bottom-0 bg-orange-500 py-0.5 text-center text-[8px] font-bold uppercase tracking-widest text-white">
                      Cover
                    </div>
                  )}
                  {img.kind === "new" && (
                    <div className="absolute left-1 bottom-1 h-2 w-2 rounded-full bg-orange-400 ring-1 ring-white/50" />
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveImage(img.id)}
                    disabled={disabled}
                    aria-label="Remove image"
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white shadow hover:bg-red-600 disabled:opacity-40"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-background/40 text-muted-foreground transition-colors hover:border-orange-500/50 hover:text-orange-500 disabled:opacity-40"
              style={{ aspectRatio: "1 / 1" }}
            >
              <Plus className="h-5 w-5" />
              <span className="text-[9px] font-semibold">Add</span>
            </button>
          </div>
        )}
      </div>

      {/* Per-color sizes & stock */}
      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Label className="inline-flex items-center gap-1.5 text-xs">
            <Ruler className="h-3.5 w-3.5 text-orange-500" />
            Sizes & stock for this color
            <span className="text-muted-foreground">
              ({variantTotalStock} unit{variantTotalStock === 1 ? "" : "s"})
            </span>
          </Label>
          {sizeGroupLabel ? (
            <span className="text-[11px] text-muted-foreground">
              {sizeGroupLabel}
            </span>
          ) : null}
        </div>
        {sizeOptions.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-background/40 px-3 py-3 text-[11px] text-muted-foreground">
            Pick a department + style above to choose sizes.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {sizeOptions.map((size) => {
              const qty = draft.sizes[size] ?? 0;
              const inUse = qty > 0;
              return (
                <div
                  key={size}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border bg-background/40 p-1.5 transition-colors",
                    inUse ? "border-orange-500/60" : "border-border"
                  )}
                >
                  <span
                    className="text-xs font-semibold"
                    title={formatSizeLabel(size)}
                  >
                    {size}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={disabled}
                      onClick={() => onSizeChange(size, qty - 1)}
                      aria-label={`Decrease ${size}`}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) =>
                        onSizeChange(size, parseInt(e.target.value, 10) || 0)
                      }
                      disabled={disabled}
                      className="h-6 w-10 border-border bg-background px-1 text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={disabled}
                      onClick={() => onSizeChange(size, qty + 1)}
                      aria-label={`Increase ${size}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

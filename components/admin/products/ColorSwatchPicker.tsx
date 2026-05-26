"use client";

import { useEffect, useState } from "react";
import { Check, Pipette } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Family = { name: string; shades: string[] };

const PALETTE: Family[] = [
  {
    name: "Neutrals",
    shades: [
      "#ffffff",
      "#f5f5f5",
      "#e5e5e5",
      "#d4d4d4",
      "#a3a3a3",
      "#737373",
      "#525252",
      "#404040",
      "#262626",
      "#000000",
    ],
  },
  {
    name: "Beige & Cream",
    shades: ["#fff8e7", "#faf0e6", "#f5e6d3", "#e8d8b8", "#d9c5a0", "#c8a679"],
  },
  {
    name: "Brown & Tan",
    shades: ["#d2b48c", "#b8860b", "#a0522d", "#8b4513", "#654321", "#3e2723"],
  },
  {
    name: "Red",
    shades: ["#fee2e2", "#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c", "#7f1d1d"],
  },
  {
    name: "Wine & Maroon",
    shades: ["#ffe4e6", "#fda4af", "#e11d48", "#be123c", "#881337", "#4c0519"],
  },
  {
    name: "Pink",
    shades: ["#fce7f3", "#f9a8d4", "#ec4899", "#db2777", "#be185d", "#831843"],
  },
  {
    name: "Orange",
    shades: ["#ffedd5", "#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c", "#7c2d12"],
  },
  {
    name: "Mustard & Amber",
    shades: ["#fef3c7", "#fcd34d", "#f59e0b", "#d97706", "#b45309", "#78350f"],
  },
  {
    name: "Yellow",
    shades: ["#fef9c3", "#fde047", "#facc15", "#eab308", "#ca8a04"],
  },
  {
    name: "Olive & Lime",
    shades: ["#ecfccb", "#bef264", "#84cc16", "#65a30d", "#4d7c0f", "#3f6212"],
  },
  {
    name: "Green",
    shades: ["#dcfce7", "#86efac", "#22c55e", "#16a34a", "#15803d", "#14532d"],
  },
  {
    name: "Teal",
    shades: ["#ccfbf1", "#5eead4", "#14b8a6", "#0d9488", "#0f766e", "#115e59"],
  },
  {
    name: "Sky & Cyan",
    shades: ["#cffafe", "#7dd3fc", "#06b6d4", "#0ea5e9", "#0284c7", "#075985"],
  },
  {
    name: "Blue",
    shades: ["#dbeafe", "#93c5fd", "#3b82f6", "#2563eb", "#1d4ed8", "#1e3a8a"],
  },
  {
    name: "Navy",
    shades: ["#1e3a8a", "#172554", "#0b1a2e", "#0a2540", "#001f3f"],
  },
  {
    name: "Indigo",
    shades: ["#e0e7ff", "#a5b4fc", "#6366f1", "#4f46e5", "#3730a3", "#1e1b4b"],
  },
  {
    name: "Purple & Violet",
    shades: ["#ede9fe", "#c4b5fd", "#8b5cf6", "#7c3aed", "#6d28d9", "#4c1d95"],
  },
  {
    name: "Magenta",
    shades: ["#fae8ff", "#f0abfc", "#d946ef", "#c026d3", "#a21caf", "#86198f"],
  },
];

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

function normalize(hex: string): string {
  const m = HEX_RE.exec(hex.trim());
  return m ? `#${m[1].toLowerCase()}` : "";
}

export function ColorSwatchPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [customHex, setCustomHex] = useState(value);
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCustomHex(value);
      setCustomError(null);
    }
  }, [open, value]);

  const pick = (hex: string) => {
    onChange(hex);
    setOpen(false);
  };

  const applyCustom = () => {
    const norm = normalize(customHex);
    if (!norm) {
      setCustomError("Use a 6-digit hex like #b91c1c");
      return;
    }
    pick(norm);
  };

  const selected = value.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Pick swatch color"
          className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span
            className="block h-9 w-9 rounded-full border-2 border-border shadow-sm transition-transform hover:scale-110"
            style={{ backgroundColor: value }}
          />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border bg-muted/30 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pipette className="h-4 w-4 text-orange-500" />
            Pick a color
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tap any swatch, or enter a custom hex below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-4 py-4">
          {PALETTE.map((family) => (
            <div key={family.name} className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {family.name}
              </p>
              <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-12">
                {family.shades.map((hex) => {
                  const isSelected = hex.toLowerCase() === selected;
                  const isLight = isLightColor(hex);
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => pick(hex)}
                      aria-label={hex}
                      title={hex}
                      className={cn(
                        "relative aspect-square w-full rounded-md border transition-transform active:scale-95",
                        isSelected
                          ? "border-orange-500 ring-2 ring-orange-500 ring-offset-1"
                          : "border-border hover:scale-110"
                      )}
                      style={{ backgroundColor: hex }}
                    >
                      {isSelected && (
                        <Check
                          className={cn(
                            "absolute inset-0 m-auto h-4 w-4",
                            isLight ? "text-black" : "text-white"
                          )}
                          strokeWidth={3}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/20 p-3">
            <Label htmlFor="custom-hex" className="text-xs font-semibold">
              Custom hex
            </Label>
            <div className="flex items-center gap-2">
              <span
                className="h-9 w-9 shrink-0 rounded-md border border-border"
                style={{ backgroundColor: normalize(customHex) || "#ffffff" }}
              />
              <Input
                id="custom-hex"
                value={customHex}
                onChange={(e) => {
                  setCustomHex(e.target.value);
                  setCustomError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCustom();
                  }
                }}
                placeholder="#b91c1c"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                className="font-mono"
              />
              <button
                type="button"
                onClick={applyCustom}
                className="rounded-md bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
              >
                Apply
              </button>
            </div>
            {customError && (
              <p className="text-[11px] text-destructive">{customError}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function isLightColor(hex: string): boolean {
  const m = HEX_RE.exec(hex);
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 160;
}

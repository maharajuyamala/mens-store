"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  dataUrlToFile,
  generateModelImageClient,
  type ModelSubject,
} from "@/lib/products/generate-model-image-client";

const SUBJECTS: { id: ModelSubject; label: string; emoji: string }[] = [
  { id: "man", label: "Man", emoji: "👨🏽" },
  { id: "woman", label: "Woman", emoji: "👩🏽" },
  { id: "boy", label: "Boy", emoji: "👦🏽" },
  { id: "girl", label: "Girl", emoji: "👧🏽" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A freshly-picked local file to transform. */
  sourceFile?: File | null;
  /** URL of an already-uploaded photo to transform (server fetches it). */
  sourceUrl?: string | null;
  /** Best guess for the default subject based on the product's audience. */
  defaultSubject?: ModelSubject;
  /** Item selection (Top/Bottom/Set/…) so the AI frames the shot correctly. */
  itemSelection?: string;
  /** Called with the generated photo when the admin accepts it. */
  onApply: (file: File) => void;
};

export function AiModelPhotoDialog({
  open,
  onOpenChange,
  sourceFile,
  sourceUrl,
  defaultSubject = "man",
  itemSelection,
  onApply,
}: Props) {
  const [subject, setSubject] = useState<ModelSubject>(defaultSubject);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);

  // Reset transient state each time the dialog (re)opens with a new source.
  useEffect(() => {
    if (!open) return;
    setSubject(defaultSubject);
    setExtra("");
    setResult(null);
    setBusy(false);
  }, [open, defaultSubject]);

  // Build a preview for the source garment: blob URL for local files, or the
  // remote URL directly for already-uploaded photos.
  useEffect(() => {
    if (sourceFile) {
      const url = URL.createObjectURL(sourceFile);
      setSourcePreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setSourcePreview(sourceUrl ?? null);
  }, [sourceFile, sourceUrl]);

  const generate = async () => {
    if (!sourceFile && !sourceUrl) return;
    setBusy(true);
    setResult(null);
    const res = await generateModelImageClient({
      source: sourceFile ?? undefined,
      sourceUrl: sourceUrl ?? undefined,
      subject,
      extra,
      itemSelection,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error("Couldn't generate photo", { description: res.message });
      return;
    }
    setResult(res.image);
  };

  const apply = async () => {
    if (!result) return;
    try {
      const file = await dataUrlToFile(result, `ai-model-${subject}-${Date.now()}`);
      onApply(file);
      onOpenChange(false);
      toast.success("AI model photo added");
    } catch {
      toast.error("Couldn't use that image. Try again.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? null : onOpenChange(o))}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            Generate model photo
          </DialogTitle>
          <DialogDescription>
            Puts this outfit on a smiling Indian model. Pick who should wear it,
            then generate. Original colours &amp; design stay the same.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Subject picker */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Who wears it?</p>
            <div className="grid grid-cols-4 gap-2">
              {SUBJECTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setSubject(s.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border-2 py-2 text-xs font-semibold transition-colors disabled:opacity-50",
                    subject === s.id
                      ? "border-orange-500 bg-orange-500/10 text-orange-600"
                      : "border-border bg-background hover:border-orange-500/40"
                  )}
                >
                  <span className="text-xl">{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Before / after */}
          <div className="grid grid-cols-2 gap-3">
            <Frame label="Your photo">
              {sourcePreview ? (
                <Image
                  src={sourcePreview}
                  alt="Source garment"
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="240px"
                />
              ) : null}
            </Frame>
            <Frame label="AI model photo">
              {busy ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-[11px]">Generating…</span>
                </div>
              ) : result ? (
                <Image
                  src={result}
                  alt="Generated model"
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="240px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-3 text-center text-[11px] text-muted-foreground">
                  Tap generate to preview
                </div>
              )}
            </Frame>
          </div>

          {/* Optional tweak */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Extra instructions <span className="font-normal">(optional)</span>
            </p>
            <Textarea
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              disabled={busy}
              rows={2}
              placeholder="e.g. outdoor background, traditional jewellery, full-length shot…"
              className="resize-none text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={generate}
              disabled={busy || (!sourceFile && !sourceUrl)}
              className="gap-2"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {result ? "Regenerate" : "Generate"}
            </Button>
            <Button
              type="button"
              onClick={apply}
              disabled={busy || !result}
              className="gap-2 bg-orange-500 hover:bg-orange-600"
            >
              <Sparkles className="h-4 w-4" />
              Use this photo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Frame({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
        {children}
      </div>
    </div>
  );
}

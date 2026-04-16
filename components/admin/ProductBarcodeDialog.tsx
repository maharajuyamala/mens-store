"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { productScanStockUrl } from "@/lib/barcode/payload";
import type { BarcodeProductInfo } from "@/store/productBarcodeStore";
import { useProductBarcodeStore } from "@/store/productBarcodeStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function BarcodeSheetBody({ info }: { info: BarcodeProductInfo }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const deepLink = productScanStockUrl(info.productId);

  useEffect(() => {
    let cancelled = false;
    const payload = productScanStockUrl(info.productId);
    if (!payload.startsWith("http")) {
      console.error("[ProductBarcodeDialog] Expected https URL for QR, got:", payload);
    }
    QRCode.toDataURL(payload, {
      width: 220,
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
  }, [info.productId]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    try {
      while (el.firstChild) el.removeChild(el.firstChild);
      JsBarcode(el, info.productId, {
        format: "CODE128",
        displayValue: true,
        width: 1.15,
        height: 38,
        margin: 2,
        fontSize: 9,
      });
    } catch {
      /* invalid id for barcode */
    }
  }, [info.productId]);

  return (
    <>
      {/* Printed sheet: ~2&quot; tall — price + barcode only (no QR) */}
      <div
        id="barcode-print-root"
        className="label-print-area flex max-h-[220px] min-h-[180px] flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background px-3 py-3 text-center text-foreground print:max-h-[2in] print:min-h-[2in] print:max-w-none print:rounded-none print:border-0 print:px-2 print:py-1"
      >
        <p className="shrink-0 text-2xl font-bold tabular-nums leading-tight print:text-[14pt]">
          {inr.format(info.price)}
        </p>
        <div className="flex min-h-0 w-full max-w-md flex-1 items-center justify-center overflow-hidden print:max-w-full">
          <svg
            ref={svgRef}
            className="mx-auto block h-auto max-h-[120px] w-full max-w-full print:max-h-[1.35in]"
            preserveAspectRatio="xMidYMid meet"
          />
        </div>
      </div>

      <div className="mt-6 space-y-4 print:hidden">
        <p className="text-center text-lg font-semibold tracking-tight">
          {info.name}
        </p>
        <p className="text-center text-sm text-muted-foreground">
          ID {info.productId}
        </p>
        {info.imageUrl ? (
          <div className="relative mx-auto h-28 w-28 overflow-hidden rounded-lg border border-border">
            <Image
              src={info.imageUrl}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : null}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Scan QR to open <span className="font-medium">Scan &amp; stock</span> on your site with
            this product loaded (deep link).
          </p>
          {qrSrc ? (
            <img
              src={qrSrc}
              alt="Link to Scan and stock for this product"
              width={200}
              height={200}
            />
          ) : (
            <div className="flex h-[200px] w-[200px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Generating QR…
            </div>
          )}
          <p className="max-w-[280px] break-all text-center font-mono text-[10px] leading-snug text-muted-foreground">
            {deepLink}
          </p>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Print uses the label above — price and barcode only (~2″ high).
        </p>
      </div>
    </>
  );
}

export function ProductBarcodeDialog() {
  const product = useProductBarcodeStore((s) => s.product);
  const closeSheet = useProductBarcodeStore((s) => s.closeSheet);
  const open = product !== null;
  const printId = useId();

  return (
    <>
      <style>{`
        @page {
          margin: 0.12in;
          size: auto;
        }
        @media print {
          body * { visibility: hidden !important; }
          #barcode-print-root,
          #barcode-print-root * { visibility: visible !important; }
          #barcode-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-height: 2in !important;
            min-height: 2in !important;
            height: 2in !important;
            box-sizing: border-box !important;
            border: none !important;
            background: white !important;
            color: black !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
          }
        }
      `}</style>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeSheet();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card text-card-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Product barcode</DialogTitle>
           
          </DialogHeader>
          {product ? <BarcodeSheetBody info={product} /> : null}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => closeSheet()}
            >
              Close
            </Button>
            <Button
              type="button"
              className="bg-orange-600 text-white hover:bg-orange-500"
              onClick={() => {
                window.print();
              }}
              aria-describedby={printId}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print label
            </Button>
          </DialogFooter>
          <p id={printId} className="sr-only">
            Opens the browser print dialog for the barcode sheet.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useEffect, useId, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Loader2, Printer } from "lucide-react";
import { getDb } from "@/app/firebase";
import type { BarcodeProductInfo } from "@/store/productBarcodeStore";
import { useProductBarcodeStore } from "@/store/productBarcodeStore";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VariantQrSheet } from "@/components/admin/products/VariantQrSheet";

function BarcodeSheetBody({ info }: { info: BarcodeProductInfo }) {
  const [productData, setProductData] = useState<Record<string, unknown> | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setProductData(null);
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), "products", info.productId));
        if (cancelled) return;
        setProductData(snap.exists() ? (snap.data() as Record<string, unknown>) : null);
      } catch {
        if (!cancelled) setProductData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [info.productId]);

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Building label sheet…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <VariantQrSheet
        productId={info.productId}
        productName={info.name}
        price={info.price}
        productData={productData}
      />
      <p className="text-center text-xs text-muted-foreground print:hidden">
        Each QR opens Scan & stock with that exact color/size pre-selected.
      </p>
    </div>
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
        @page { margin: 0.25in; size: auto; }
        @media print {
          body * { visibility: hidden !important; }
          #variant-qr-print-root,
          #variant-qr-print-root * { visibility: visible !important; }
          #variant-qr-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
            background: white !important;
            color: black !important;
          }
          .variant-qr-label { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeSheet();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card text-card-foreground sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Variant QR labels</DialogTitle>
          </DialogHeader>
          {product ? <BarcodeSheetBody info={product} /> : null}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => closeSheet()}>
              Close
            </Button>
            <Button
              type="button"
              className="bg-orange-600 text-white hover:bg-orange-500"
              onClick={() => window.print()}
              aria-describedby={printId}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print sheet
            </Button>
          </DialogFooter>
          <p id={printId} className="sr-only">
            Opens the browser print dialog for the variant QR sheet.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

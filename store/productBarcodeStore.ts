import { create } from "zustand";

export type BarcodeProductInfo = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
};

type ProductBarcodeState = {
  product: BarcodeProductInfo | null;
  openSheet: (info: BarcodeProductInfo) => void;
  closeSheet: () => void;
};

export const useProductBarcodeStore = create<ProductBarcodeState>((set) => ({
  product: null,
  openSheet: (info) => set({ product: info }),
  closeSheet: () => set({ product: null }),
}));

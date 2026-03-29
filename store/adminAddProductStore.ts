import { create } from "zustand";

type AdminAddProductState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openDialog: () => void;
};

export const useAdminAddProductStore = create<AdminAddProductState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  openDialog: () => set({ open: true }),
}));

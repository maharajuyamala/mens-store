import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ssrSafeLocalStorage } from "@/store/ssrSafeStorage";

const MAX = 6;

type RecentlyViewedState = {
  ids: string[];
  recordView: (productId: string) => void;
  clear: () => void;
};

export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      ids: [],

      recordView: (productId) => {
        if (!productId.trim()) return;
        const { ids } = get();
        const next = [
          productId,
          ...ids.filter((id) => id !== productId),
        ].slice(0, MAX);
        set({ ids: next });
      },

      clear: () => set({ ids: [] }),
    }),
    {
      name: "mens-store-recently-viewed",
      storage: ssrSafeLocalStorage(),
      partialize: (state) => ({ ids: state.ids }),
    }
  )
);

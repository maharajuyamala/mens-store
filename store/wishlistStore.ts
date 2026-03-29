import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ssrSafeLocalStorage } from "@/store/ssrSafeStorage";

const LEGACY_WISHLIST_KEY = "mens-store-wishlist";

type WishlistState = {
  ids: string[];
  toggle: (productId: string) => void;
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
};

function readLegacyIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LEGACY_WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],

      toggle: (productId) => {
        const { ids } = get();
        if (ids.includes(productId)) {
          set({ ids: ids.filter((id) => id !== productId) });
        } else {
          set({ ids: [...ids, productId] });
        }
      },

      remove: (productId) =>
        set({ ids: get().ids.filter((id) => id !== productId) }),

      has: (productId) => get().ids.includes(productId),

      clear: () => set({ ids: [] }),
    }),
    {
      name: "mens-store-wishlist-zustand",
      storage: ssrSafeLocalStorage(),
      partialize: (state) => ({ ids: state.ids }),
      onRehydrateStorage: () => (state) => {
        if (!state || state.ids.length > 0) return;
        const legacy = readLegacyIds();
        if (legacy.length) {
          useWishlistStore.setState({ ids: legacy });
        }
      },
    }
  )
);

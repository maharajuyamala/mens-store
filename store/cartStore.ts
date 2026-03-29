import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

/** Inline fallback so a bad HMR state never leaves `createJSONStorage` undefined in this module. */
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

const cartPersistStorage = createJSONStorage(() =>
  typeof window !== "undefined" ? window.localStorage : noopStorage
);

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
};

export type CartAddInput = Omit<CartItem, "id" | "quantity"> & {
  quantity?: number;
};

type CartState = {
  items: CartItem[];
  addItem: (input: CartAddInput) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getCount: () => number;
};

const MAX_QTY = 999;

function lineKey(productId: string, size: string, color: string) {
  return `${productId}|${size}|${color}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (input) => {
        const quantity = Math.min(
          Math.max(1, input.quantity ?? 1),
          MAX_QTY
        );
        const { items } = get();
        const key = lineKey(input.productId, input.size, input.color);
        const idx = items.findIndex(
          (i) => lineKey(i.productId, i.size, i.color) === key
        );

        if (idx >= 0) {
          const next = [...items];
          const merged = Math.min(
            next[idx].quantity + quantity,
            MAX_QTY
          );
          next[idx] = { ...next[idx], quantity: merged };
          set({ items: next });
          return;
        }

        set({
          items: [
            ...items,
            {
              id:
                typeof crypto !== "undefined" && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `cart-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              productId: input.productId,
              name: input.name,
              image: input.image,
              price: input.price,
              size: input.size,
              color: input.color,
              quantity,
            },
          ],
        });
      },

      removeItem: (id) =>
        set({ items: get().items.filter((i) => i.id !== id) }),

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        const q = Math.min(quantity, MAX_QTY);
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, quantity: q } : i
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      getTotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      getCount: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "mens-store-cart-zustand",
      storage: cartPersistStorage,
      partialize: (state) => ({ items: state.items }),
    }
  )
);

import * as zustandMiddleware from "zustand/middleware";

/** Avoid `ReferenceError: localStorage is not defined` during Next.js SSR. */
const noopStorage: zustandMiddleware.StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

/** Use namespace import so bundlers never tree-shake `createJSONStorage` away from this module. */
export function ssrSafeLocalStorage() {
  return zustandMiddleware.createJSONStorage(() =>
    typeof window !== "undefined" ? window.localStorage : noopStorage
  );
}

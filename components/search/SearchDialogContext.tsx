"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SearchDialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openSearch: () => void;
};

const SearchDialogContext = createContext<SearchDialogContextValue | null>(
  null
);

export function SearchDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openSearch = useCallback(() => setOpen(true), []);

  const value = useMemo(
    () => ({ open, setOpen, openSearch }),
    [open, openSearch]
  );

  return (
    <SearchDialogContext.Provider value={value}>
      {children}
    </SearchDialogContext.Provider>
  );
}

export function useSearchDialog() {
  const ctx = useContext(SearchDialogContext);
  if (!ctx) {
    throw new Error("useSearchDialog must be used within SearchDialogProvider");
  }
  return ctx;
}

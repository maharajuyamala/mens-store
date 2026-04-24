"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchListedProducts } from "@/lib/client/search-listed-products";
import type { ExploreProduct } from "@/lib/explore/types";
import { inr } from "@/lib/utils";
import { useSearchDialog } from "./SearchDialogContext";

const DEBOUNCE_MS = 300;

export function GlobalSearchCommand() {
  const { open, setOpen } = useSearchDialog();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ExploreProduct[]>([]);
  const reqId = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const t = window.setTimeout(() => {
      const id = ++reqId.current;
      void (async () => {
        try {
          const list = await searchListedProducts(q);
          if (reqId.current === id) {
            setResults(list);
          }
        } catch {
          if (reqId.current === id) {
            setResults([]);
          }
        } finally {
          if (reqId.current === id) {
            setLoading(false);
          }
        }
      })();
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(t);
  }, [query]);

  const onSelect = useCallback(
    (id: string) => {
      setOpen(false);
      router.push(`/product-details?id=${encodeURIComponent(id)}`);
    },
    [router, setOpen]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search products… (min 2 characters)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Searching…
          </div>
        ) : null}
        {!loading && query.trim().length >= 2 && results.length === 0 ? (
          <CommandEmpty>No products found.</CommandEmpty>
        ) : null}
        {!loading && results.length > 0 ? (
          <CommandGroup heading="Products">
            {results.map((p) => (
              <CommandItem
                key={p.doc_id}
                value={`${p.name} ${p.doc_id} ${p.tags.join(" ")}`}
                onSelect={() => onSelect(p.doc_id)}
                className="cursor-pointer"
              >
                <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {inr.format(p.price)}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {query.trim().length > 0 && query.trim().length < 2 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search Firestore.
          </div>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

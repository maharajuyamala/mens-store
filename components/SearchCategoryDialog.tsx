"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getAllCategories } from "@/lib/add-product/category-options";

export function SearchCategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const categories = useMemo(() => getAllCategories(), []);

  // Lock body scroll + close on Escape while the overlay is open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const goToCategory = (cat: string) => {
    onOpenChange(false);
    router.push(`/explore?category=${encodeURIComponent(cat)}`);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex flex-col bg-background text-foreground"
          role="dialog"
          aria-modal="true"
          aria-label="Search categories"
        >
          <CommandPrimitive
            className="flex h-full w-full flex-col bg-background"
            shouldFilter
          >
            {/* Top bar: close (left) + full-width input */}
            <div className="flex items-center gap-2 border-b border-border bg-background px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:px-4">
              
              <CommandPrimitive.Input
                autoFocus
                placeholder="Search categories…"
                className="h-11 w-full min-w-0 flex-1 rounded-md bg-transparent px-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close search"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full  text-foreground transition-colors hover:border-orange-500"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {/* Suggestions fill the rest of the viewport */}
            <CommandList className="max-h-none flex-1 overflow-y-auto px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
              <CommandEmpty>No category matches.</CommandEmpty>
              <CommandGroup heading="Categories">
                {categories.map((cat) => (
                  <CommandItem
                    key={cat}
                    value={cat}
                    onSelect={() => goToCategory(cat)}
                    className="px-3 py-3 text-base"
                  >
                    {cat}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </CommandPrimitive>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { AlertTriangle, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { getClientFirebase, getDb } from "@/app/firebase";
import { ProductFormDialog } from "@/components/admin/products/ProductFormDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PRODUCT_CATEGORIES } from "@/lib/products/schema";
import {
  docToProductRow,
  type ProductTableRow,
} from "@/lib/products/firestore-map";
import { stockAndStatusPatch } from "@/lib/products/stock-update";
import { cn } from "@/lib/utils";

const CATEGORY_FILTER_OPTIONS = [
  "all",
  ...PRODUCT_CATEGORIES,
  "other",
] as const;

type CategoryFilter = (typeof CATEGORY_FILTER_OPTIONS)[number];

function statusLabel(s: ProductTableRow["status"]) {
  switch (s) {
    case "in_stock":
      return "In stock";
    case "low_stock":
      return "Low stock";
    case "out_of_stock":
      return "Out of stock";
    default:
      return s;
  }
}

function statusClass(s: ProductTableRow["status"]) {
  switch (s) {
    case "in_stock":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "low_stock":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "out_of_stock":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function AdminProductsPage() {
  const [rows, setRows] = useState<ProductTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Record<string, unknown> | null>(
    null
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDelta, setBulkDelta] = useState("");
  const [bulkActiveTarget, setBulkActiveTarget] = useState(true);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [stockDraft, setStockDraft] = useState("");
  const [savingStockId, setSavingStockId] = useState<string | null>(null);
  const stockInputRef = useRef<HTMLInputElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const fb = getClientFirebase();
    if (!fb) {
      setLoadError(
        "Firebase is not configured. Add NEXT_PUBLIC_FIREBASE_* variables to .env.local and restart the dev server."
      );
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      collection(fb.db, "products"),
      (snap) => {
        setLoadError(null);
        const next: ProductTableRow[] = [];
        for (const d of snap.docs) {
          try {
            next.push(
              docToProductRow(d.id, d.data() as Record<string, unknown>)
            );
          } catch (e) {
            console.error("[admin/products] skip bad doc", d.id, e);
          }
        }
        setRows(next);
        setLoading(false);
      },
      (err) => {
        console.error("[admin/products] products listener", err);
        setLoadError(
          err.message ||
            "Could not load products. Check Firestore rules and your network."
        );
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => rows.some((r) => r.id === id)));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const nameOk = !q || r.name.toLowerCase().includes(q);
      const catOk =
        categoryFilter === "all" || r.categoryFilter === categoryFilter;
      return nameOk && catOk;
    });
  }, [rows, search, categoryFilter]);

  const lowStockBannerRows = useMemo(() => {
    return [...rows]
      .filter((r) => r.stock < 5)
      .sort((a, b) => a.stock - b.stock);
  }, [rows]);

  const selectedCount = selectedIds.length;
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.includes(r.id));
  const someFilteredSelected =
    filtered.some((r) => selectedIds.includes(r.id)) && !allFilteredSelected;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = (checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => {
        const set = new Set(prev);
        filtered.forEach((r) => set.add(r.id));
        return [...set];
      });
    } else {
      const filteredIds = new Set(filtered.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    }
  };

  const clearSelection = () => setSelectedIds([]);

  const startStockEdit = (row: ProductTableRow) => {
    setEditingStockId(row.id);
    setStockDraft(String(row.stock));
    requestAnimationFrame(() => stockInputRef.current?.focus());
  };

  const cancelStockEdit = () => {
    setEditingStockId(null);
    setStockDraft("");
  };

  const saveStockInline = async () => {
    if (!editingStockId) return;
    const n = Number.parseInt(stockDraft, 10);
    if (Number.isNaN(n) || n < 0) {
      cancelStockEdit();
      return;
    }
    setSavingStockId(editingStockId);
    try {
      await updateDoc(
        doc(getDb(), "products", editingStockId),
        stockAndStatusPatch(n)
      );
      cancelStockEdit();
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : "Could not update stock."
      );
    } finally {
      setSavingStockId(null);
    }
  };

  const onStockKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void saveStockInline();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelStockEdit();
    }
  };

  const applyBulkDelta = async () => {
    const delta = Number.parseInt(bulkDelta.trim(), 10);
    if (Number.isNaN(delta) || selectedIds.length === 0) return;
    setBulkWorking(true);
    try {
      await Promise.all(
        selectedIds.map(async (id) => {
          const row = rows.find((r) => r.id === id);
          if (!row) return;
          const next = Math.max(0, row.stock + delta);
          await updateDoc(doc(getDb(), "products", id), stockAndStatusPatch(next));
        })
      );
      setBulkDelta("");
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : "Bulk stock update failed."
      );
    } finally {
      setBulkWorking(false);
    }
  };

  const applyBulkActive = useCallback(
    async (active: boolean) => {
      if (selectedIds.length === 0) return;
      setBulkWorking(true);
      try {
        await Promise.all(
          selectedIds.map((id) =>
            updateDoc(doc(getDb(), "products", id), {
              active,
              updatedAt: serverTimestamp(),
            })
          )
        );
      } catch (e) {
        window.alert(
          e instanceof Error ? e.message : "Could not update listing state."
        );
      } finally {
        setBulkWorking(false);
      }
    },
    [selectedIds]
  );

  const applyBulkListingFromSwitch = () => {
    void applyBulkActive(bulkActiveTarget);
  };

  const confirmBulkDelete = async () => {
    setBulkWorking(true);
    try {
      await Promise.all(
        selectedIds.map((id) => deleteDoc(doc(getDb(), "products", id)))
      );
      setBulkDeleteOpen(false);
      clearSelection();
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : "Could not delete products."
      );
    } finally {
      setBulkWorking(false);
    }
  };

  const openEdit = (row: ProductTableRow) => {
    setEditingId(row.id);
    setEditingData(row.data);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Delete “${name}”? This cannot be undone. Storage files are not removed automatically.`
      )
    ) {
      return;
    }
    try {
      await deleteDoc(doc(getDb(), "products", id));
    } catch (e) {
      window.alert(
        e instanceof Error ? e.message : "Failed to delete product."
      );
    }
  };

  const colCount = 9;

  return (
    <div
      className={cn(
        "space-y-6",
        selectedCount > 0 && "pb-28"
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Products
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage catalog, inventory, and media. Add new items from the header
            or mobile <span className="font-medium">Add</span> button (per-size
            stock). Edit rows here for the full{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">images[]</code>{" "}
            form.
          </p>
        </div>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p className="font-semibold">Could not load products</p>
          <p className="mt-1 opacity-90">{loadError}</p>
        </div>
      ) : null}

      {lowStockBannerRows.length > 0 ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Low stock alert</p>
              <p className="mt-1 text-sm opacity-90">
                These products have fewer than{" "}
                <span className="font-medium">5</span> units:
              </p>
              <ul className="mt-2 max-h-32 list-inside list-disc space-y-0.5 overflow-y-auto text-sm">
                {lowStockBannerRows.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium text-foreground dark:text-foreground">
                      {r.name}
                    </span>{" "}
                    —{" "}
                    <span className="tabular-nums">
                      {r.stock === 0 ? "out of stock" : `${r.stock} left`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-background pl-9"
            aria-label="Search products by name"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}
        >
          <SelectTrigger className="w-full border-border bg-background sm:w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {PRODUCT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </SelectItem>
            ))}
            <SelectItem value="other">Other / uncategorized</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    allFilteredSelected
                      ? true
                      : someFilteredSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(c) =>
                    toggleSelectAllFiltered(c === true || c === "indeterminate")
                  }
                  aria-label="Select all on page"
                />
              </TableHead>
              <TableHead className="w-14">Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Listing</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colCount} className="h-24 text-center">
                  <span className="text-muted-foreground">Loading…</span>
                </TableCell>
              </TableRow>
            ) : loadError ? (
              <TableRow>
                <TableCell colSpan={colCount} className="h-24 text-center">
                  <span className="text-muted-foreground">
                    Fix the error above to load the catalog.
                  </span>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="h-24 text-center">
                  <span className="text-muted-foreground">
                    No products match your filters.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(!row.active && "opacity-50")}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(row.id)}
                      onCheckedChange={() => toggleSelect(row.id)}
                      aria-label={`Select ${row.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="relative h-12 w-10 overflow-hidden rounded-md border border-border bg-muted">
                      {row.thumbnail ? (
                        <Image
                          src={row.thumbnail}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="40px"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                          —
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {row.name}
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {row.category}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {new Intl.NumberFormat(undefined, {
                      style: "currency",
                      currency: "USD",
                    }).format(row.price)}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingStockId === row.id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Input
                          ref={stockInputRef}
                          type="number"
                          min={0}
                          value={stockDraft}
                          onChange={(e) => setStockDraft(e.target.value)}
                          onKeyDown={onStockKeyDown}
                          className="h-8 w-20 border-border bg-background text-right tabular-nums"
                          disabled={savingStockId === row.id}
                          aria-label="Edit stock quantity"
                        />
                        {savingStockId === row.id ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-orange-500" />
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="cursor-pointer rounded-md px-2 py-1 tabular-nums hover:bg-muted"
                        onClick={() => startStockEdit(row)}
                        title="Click to edit stock (Enter to save)"
                      >
                        {row.stock}
                      </button>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        statusClass(row.status)
                      )}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        row.active
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {row.active ? "Active" : "Inactive"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-foreground"
                        onClick={() => openEdit(row)}
                        aria-label={`Edit ${row.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => void handleDelete(row.id, row.name)}
                        aria-label={`Delete ${row.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selectedCount > 0 ? (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-sm font-medium">
              {selectedCount} selected
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bulk-delta" className="text-xs">
                  Adjust stock (add / subtract)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="bulk-delta"
                    type="number"
                    placeholder="e.g. 10 or -3"
                    value={bulkDelta}
                    onChange={(e) => setBulkDelta(e.target.value)}
                    className="h-9 w-32 border-border bg-background"
                    disabled={bulkWorking}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={bulkWorking}
                    onClick={() => void applyBulkDelta()}
                  >
                    Apply
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Listing state</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    id="bulk-listing"
                    checked={bulkActiveTarget}
                    onCheckedChange={setBulkActiveTarget}
                    disabled={bulkWorking}
                  />
                  <span className="text-sm text-muted-foreground">
                    {bulkActiveTarget ? "Active" : "Inactive"}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={bulkWorking}
                    onClick={applyBulkListingFromSwitch}
                  >
                    Apply
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={bulkWorking}
                onClick={() => setBulkDeleteOpen(true)}
              >
                Delete selected
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                disabled={bulkWorking}
              >
                Clear
              </Button>
            </div>
          </div>
          {bulkWorking ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Working…
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="border-border bg-card text-card-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {selectedCount} products?</DialogTitle>
            <DialogDescription>
              This removes the Firestore documents. Images in Storage are not
              deleted automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              disabled={bulkWorking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={bulkWorking}
              onClick={() => void confirmBulkDelete()}
            >
              {bulkWorking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingId(null);
            setEditingData(null);
          }
        }}
        mode="edit"
        productId={editingId}
        initialData={editingData}
        onSaved={() => {
          /* onSnapshot keeps list fresh */
        }}
      />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { Download, Loader2, Package, PanelRight } from "lucide-react";
import { getDb } from "@/app/firebase";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminOrderDetailSheet } from "@/components/admin/AdminOrderDetailSheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import {
  allowedNextStatuses,
  docToAdminOrder,
  downloadCsv,
  ordersToCsv,
  type AdminOrder,
  type OrderStatus,
} from "@/lib/admin/orders-admin";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FILTERS: { key: "all" | OrderStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function statusBadgeClass(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "bg-amber-500/20 text-amber-200 border-amber-500/40";
    case "processing":
      return "bg-sky-500/20 text-sky-200 border-sky-500/40";
    case "shipped":
      return "bg-violet-500/20 text-violet-200 border-violet-500/40";
    case "delivered":
      return "bg-emerald-500/20 text-emerald-200 border-emerald-500/40";
    case "cancelled":
      return "bg-red-500/15 text-red-200 border-red-500/35";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function formatPayment(method: string) {
  const m = method.toLowerCase();
  if (m === "cod") return "COD";
  return method || "—";
}

async function updateOrderStatusTx(
  orderId: string,
  nextStatus: OrderStatus,
  updatedBy: string
) {
  const ref = doc(getDb(), "orders", orderId);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Order not found");
    const data = snap.data();
    const prev = Array.isArray(data.statusHistory) ? data.statusHistory : [];
    tx.update(ref, {
      status: nextStatus,
      statusHistory: [
        ...prev,
        {
          status: nextStatus,
          updatedAt: serverTimestamp(),
          updatedBy,
        },
      ],
    });
  });
}

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [listenError, setListenError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const updatedByLabel =
    user?.email ?? user?.uid ?? "admin";

  useEffect(() => {
    const q = query(collection(getDb(), "orders"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AdminOrder[] = [];
        snap.forEach((d) => {
          list.push(docToAdminOrder(d.id, d.data() as Record<string, unknown>));
        });
        setOrders(list);
        setListenError(null);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setListenError(err.message);
        setLoading(false);
        if (err instanceof FirebaseError && err.code === "failed-precondition") {
          toast.error("Firestore index required", {
            description: "Create the composite index suggested in the browser console.",
          });
        } else {
          toast.error("Could not load orders");
        }
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setSelected((prev) => {
      if (!prev) return prev;
      const next = orders.find((o) => o.id === prev.id);
      return next ?? prev;
    });
  }, [orders]);

  const filtered = useMemo(() => {
    if (filter === "all") return orders;
    return orders.filter((o) => o.status === filter);
  }, [orders, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const o of orders) {
      c[o.status] = (c[o.status] ?? 0) + 1;
    }
    return c;
  }, [orders]);

  const openDetail = useCallback((o: AdminOrder) => {
    setSelected(o);
    setSheetOpen(true);
  }, []);

  const onStatusChange = useCallback(
    async (order: AdminOrder, value: string) => {
      const next = value as OrderStatus;
      if (next === order.status) return;
      const allowed = allowedNextStatuses(order.status);
      if (!allowed.includes(next)) {
        toast.error("Invalid status change");
        return;
      }
      setUpdatingId(order.id);
      try {
        await updateOrderStatusTx(order.id, next, updatedByLabel);
        toast.success(`Order ${order.orderNumber} → ${next}`);
      } catch (e) {
        console.error(e);
        if (e instanceof FirebaseError && e.code === "permission-denied") {
          toast.error("Permission denied. Deploy Firestore rules for admin order updates.");
        } else {
          toast.error("Failed to update status");
        }
      } finally {
        setUpdatingId(null);
      }
    },
    [updatedByLabel]
  );

  const exportCsv = useCallback(() => {
    try {
      if (filtered.length === 0) {
        toast.message("Nothing to export for this filter.");
        return;
      }
      const csv = ordersToCsv(filtered);
      const name = `orders-${filter}-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsv(name, csv);
      toast.success(`Exported ${filtered.length} orders`);
    } catch {
      toast.error("Export failed");
    }
  }, [filter, filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Orders
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live feed from{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">orders</code>
            . {loading ? "Loading…" : `${orders.length} total`}
          </p>
          {listenError ? (
            <p className="mt-2 text-sm text-destructive">{listenError}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-border shrink-0"
          onClick={() => void exportCsv()}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === tab.key
                ? "border-orange-500 bg-orange-500/15 text-orange-100"
                : "border-border bg-card text-muted-foreground hover:bg-muted/60"
            )}
          >
            {tab.label}
            <span className="ml-1.5 tabular-nums opacity-70">
              ({tab.key === "all" ? counts.all ?? 0 : counts[tab.key] ?? 0})
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-muted" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Order #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Package className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    No orders in this view.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer border-border hover:bg-muted/40"
                    onClick={() => openDetail(o)}
                  >
                    <TableCell className="font-mono font-medium">
                      {o.orderNumber}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {o.createdAt
                        ? o.createdAt.toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate">
                      {o.shippingAddress.fullName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.items.length}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {o.pricing.total != null && !Number.isNaN(o.pricing.total)
                        ? inr.format(o.pricing.total)
                        : "—"}
                    </TableCell>
                    <TableCell>{formatPayment(o.paymentMethod)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={o.status}
                        disabled={updatingId === o.id}
                        onValueChange={(v) => void onStatusChange(o, v)}
                      >
                        <SelectTrigger
                          size="sm"
                          className={cn(
                            "h-8 w-[130px] border text-xs",
                            statusBadgeClass(o.status)
                          )}
                          onClick={(e) => e.stopPropagation()}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          className="border-border bg-popover"
                          position="popper"
                        >
                          {allowedNextStatuses(o.status).map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-muted-foreground"
                        onClick={() => openDetail(o)}
                      >
                        <PanelRight className="h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <AdminOrderDetailSheet
        order={selected}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelected(null);
        }}
        footer={
          selected ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {updatingId === selected.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              <span>Update status from the table row.</span>
            </div>
          ) : null
        }
      />
    </div>
  );
}

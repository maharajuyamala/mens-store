"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  collection,
  collectionGroup,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import {
  DollarSign,
  Package,
  PanelRight,
  ShoppingBag,
  TrendingDown,
} from "lucide-react";
import { getDb } from "@/app/firebase";
import { AdminOrderDetailSheet } from "@/components/admin/AdminOrderDetailSheet";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { countLowStockProducts } from "@/lib/admin/inventory";
import {
  docToAdminOrder,
  type AdminOrder,
} from "@/lib/admin/orders-admin";
import { revenueThisMonth } from "@/lib/admin/order-stats";
import { cn } from "@/lib/utils";

/** Max order docs to scan for revenue (add Cloud Function aggregation for scale). */
const ORDERS_SCAN_LIMIT = 2000;

const RECENT_ORDERS_LIMIT = 12;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatPayment(method: string) {
  const m = method.toLowerCase();
  if (m === "cod") return "COD";
  return method || "—";
}

function statusPillClass(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-500/20 text-amber-800 dark:text-amber-200";
    case "processing":
      return "bg-sky-500/20 text-sky-800 dark:text-sky-200";
    case "shipped":
      return "bg-violet-500/20 text-violet-800 dark:text-violet-200";
    case "delivered":
      return "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200";
    case "cancelled":
      return "bg-red-500/15 text-red-800 dark:text-red-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

type DashboardStats = {
  totalProducts: number;
  totalOrders: number;
  lowStockItems: number;
  revenueThisMonth: number;
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<AdminOrder[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const productsSnap = await getDocs(collection(getDb(), "products"));
        const ordersCountSnap = await getCountFromServer(
          collectionGroup(getDb(), "orders")
        );
        const ordersQ = query(
          collectionGroup(getDb(), "orders"),
          limit(ORDERS_SCAN_LIMIT)
        );
        const ordersSnap = await getDocs(ordersQ);

        if (cancelled) return;

        setStats({
          totalProducts: productsSnap.size,
          totalOrders: ordersCountSnap.data().count,
          lowStockItems: countLowStockProducts(productsSnap.docs),
          revenueThisMonth: revenueThisMonth(ordersSnap.docs),
        });
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load dashboard stats."
          );
          setStats(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const q = query(
          collection(getDb(), "orders"),
          orderBy("createdAt", "desc"),
          limit(RECENT_ORDERS_LIMIT)
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        const list: AdminOrder[] = [];
        snap.forEach((d) => {
          list.push(docToAdminOrder(d.id, d.data() as Record<string, unknown>));
        });
        setRecentOrders(list);
        setRecentError(null);
      } catch (e) {
        if (!cancelled) {
          setRecentError(
            e instanceof Error ? e.message : "Could not load recent orders."
          );
          setRecentOrders([]);
        }
      } finally {
        if (!cancelled) setRecentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards: Array<{
    title: string;
    description: string;
    value: number | null;
    icon: typeof Package;
    format?: "currency";
    href?: string;
  }> = [
    {
      title: "Total products",
      description: "Items in catalog — click to manage",
      value: stats?.totalProducts ?? null,
      icon: Package,
      href: "/admin/products",
    },
    {
      title: "Total orders",
      description: "All orders — click for full list",
      value: stats?.totalOrders ?? null,
      icon: ShoppingBag,
      href: "/admin/orders",
    },
    {
      title: "Low stock",
      description: "Products with under 5 units (all sizes)",
      value: stats?.lowStockItems ?? null,
      icon: TrendingDown,
    },
    {
      title: "Revenue (month)",
      description: "Sum of order totals this month",
      value: stats?.revenueThisMonth ?? null,
      icon: DollarSign,
      format: "currency",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your store. Monthly revenue scans up to{" "}
          {ORDERS_SCAN_LIMIT.toLocaleString()} orders and sums{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">total</code>{" "}
          or{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">amount</code>{" "}
          where{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            createdAt
          </code>{" "}
          falls in the current calendar month.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {cards.map((c) => {
          const Icon = c.icon;
          const card = (
            <Card
              className={cn(
                "border-border bg-card text-card-foreground shadow-md",
                c.href &&
                  "transition-colors hover:border-orange-500/40 hover:shadow-lg"
              )}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base font-semibold">
                    {c.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {c.description}
                  </CardDescription>
                </div>
                <div className="rounded-lg bg-muted p-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {c.value === null ? (
                  <Skeleton className="h-9 w-24 bg-muted" />
                ) : (
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
                    {c.format === "currency"
                      ? new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: "USD",
                        }).format(c.value)
                      : c.value.toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          );
          return (
            <motion.div key={c.title} variants={item}>
              {c.href ? (
                <Link
                  href={c.href}
                  className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {card}
                </Link>
              ) : (
                card
              )}
            </motion.div>
          );
        })}
      </motion.div>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Recent orders
            </h2>
            <p className="text-sm text-muted-foreground">
              Latest {RECENT_ORDERS_LIMIT} from{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">orders</code>
              . Open a row for full details.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-fit border-border shrink-0"
          >
            <Link href="/admin/orders">View all orders</Link>
          </Button>
        </div>

        {recentError ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {recentError}
            {recentError.includes("index") ? null : (
              <span className="block mt-1 text-xs opacity-90">
                If you see an index error, create the composite index from the
                browser console (same as the Orders page).
              </span>
            )}
          </p>
        ) : null}

        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
          {recentLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full bg-muted" />
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
              <ShoppingBag className="h-10 w-10 opacity-40" />
              <p>No orders yet.</p>
              <Button asChild variant="link" className="text-orange-600">
                <Link href="/admin/orders">Open orders</Link>
              </Button>
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
                  <TableHead className="w-[90px]"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentOrders.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer border-border hover:bg-muted/40"
                    onClick={() => {
                      setSelectedOrder(o);
                      setOrderSheetOpen(true);
                    }}
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
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
                          statusPillClass(o.status)
                        )}
                      >
                        {o.status}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => {
                          setSelectedOrder(o);
                          setOrderSheetOpen(true);
                        }}
                      >
                        <PanelRight className="h-4 w-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <AdminOrderDetailSheet
        order={selectedOrder}
        open={orderSheetOpen}
        onOpenChange={(open) => {
          setOrderSheetOpen(open);
          if (!open) setSelectedOrder(null);
        }}
        footer={
          <p className="text-sm text-muted-foreground">
            To update fulfillment status, go to{" "}
            <Link
              href="/admin/orders"
              className="font-medium text-orange-600 underline-offset-2 hover:underline"
            >
              Orders
            </Link>
            .
          </p>
        }
      />
    </div>
  );
}

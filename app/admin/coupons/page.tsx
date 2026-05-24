"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type UpdateData,
} from "firebase/firestore";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  Percent,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Ticket,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { getDb } from "@/app/firebase";
import { useAuth } from "@/hooks/useAuth";
import {
  discountFromCoupon,
  normalizeCouponCode,
  parseCouponDoc,
  type CouponDoc,
} from "@/lib/checkout/coupon";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const inrShort = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type FilterMode = "all" | "active" | "inactive" | "expired";

const FILTERS: Array<{ id: FilterMode; label: string }> = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Disabled" },
  { id: "expired", label: "Expired" },
];

type CouponFormState = {
  code: string;
  type: "percent" | "amount";
  value: string;
  expiresAt: string; // yyyy-mm-dd
  minSubtotal: string;
  maxDiscount: string;
  active: boolean;
  newCustomerOnly: boolean;
  oncePerCustomer: boolean;
};

const EMPTY_FORM: CouponFormState = {
  code: "",
  type: "percent",
  value: "",
  expiresAt: "",
  minSubtotal: "",
  maxDiscount: "",
  active: true,
  newCustomerOnly: false,
  oncePerCustomer: false,
};

function isExpired(c: CouponDoc): boolean {
  return c.expiresAt !== null && c.expiresAt.getTime() < Date.now();
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  try {
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function dateInputValue(d: Date | null): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminCouponsPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [coupons, setCoupons] = useState<CouponDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [searchQ, setSearchQ] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [busyCode, setBusyCode] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(getDb(), "coupons"), orderBy("createdAt", "desc"))
      );
      const out: CouponDoc[] = [];
      snap.forEach((d) => {
        const parsed = parseCouponDoc(d.data() as Record<string, unknown>, d.id);
        if (parsed) out.push(parsed);
      });
      setCoupons(out);
    } catch (e) {
      console.error(e);
      toast.error("Could not load coupons.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      void refresh();
    }
  }, [authLoading, isAdmin, refresh]);

  const filtered = useMemo(() => {
    const q = searchQ.trim().toUpperCase();
    return coupons.filter((c) => {
      if (q && !c.code.includes(q)) return false;
      const expired = isExpired(c);
      if (filter === "active") return c.active && !expired;
      if (filter === "inactive") return !c.active;
      if (filter === "expired") return expired;
      return true;
    });
  }, [coupons, filter, searchQ]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: coupons.length,
      active: coupons.filter(
        (c) => c.active && (!c.expiresAt || c.expiresAt.getTime() > now)
      ).length,
      expired: coupons.filter(
        (c) => c.expiresAt && c.expiresAt.getTime() < now
      ).length,
    };
  }, [coupons]);

  const openCreate = () => {
    setDialogMode("create");
    setEditingCode(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (c: CouponDoc) => {
    setDialogMode("edit");
    setEditingCode(c.code);
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      expiresAt: dateInputValue(c.expiresAt),
      minSubtotal: c.minSubtotal > 0 ? String(c.minSubtotal) : "",
      maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : "",
      active: c.active,
      newCustomerOnly: c.newCustomerOnly,
      oncePerCustomer: c.oncePerCustomer,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const submitForm = async () => {
    const code = normalizeCouponCode(form.code);
    if (!code || code.length < 3) {
      setFormError("Code must be at least 3 characters.");
      return;
    }
    const value = Number(form.value);
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("Discount value must be a positive number.");
      return;
    }
    if (form.type === "percent" && value > 100) {
      setFormError("Percent must be 100 or less.");
      return;
    }
    const minSubtotal = form.minSubtotal ? Number(form.minSubtotal) : 0;
    if (form.minSubtotal && (!Number.isFinite(minSubtotal) || minSubtotal < 0)) {
      setFormError("Minimum subtotal must be 0 or more.");
      return;
    }
    const maxDiscount = form.maxDiscount ? Number(form.maxDiscount) : null;
    if (
      form.maxDiscount &&
      (!Number.isFinite(maxDiscount as number) || (maxDiscount as number) <= 0)
    ) {
      setFormError("Max discount must be a positive number.");
      return;
    }
    let expiresAt: Date | null = null;
    if (form.expiresAt) {
      // Treat as end-of-day local so a date like "2026-06-30" stays valid
      // through the entirety of June 30th.
      const d = new Date(form.expiresAt + "T23:59:59");
      if (Number.isNaN(d.getTime())) {
        setFormError("Invalid expiry date.");
        return;
      }
      expiresAt = d;
    }

    if (dialogMode === "create") {
      const existing = coupons.find((c) => c.code === code);
      if (existing) {
        setFormError(`Code "${code}" already exists.`);
        return;
      }
    }

    setSaving(true);
    setFormError(null);
    try {
      const baseDoc: Record<string, unknown> = {
        code,
        active: form.active,
        type: form.type,
        value,
        expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
        minSubtotal,
        maxDiscount,
        newCustomerOnly: form.newCustomerOnly,
        oncePerCustomer: form.oncePerCustomer,
      };
      if (dialogMode === "create") {
        baseDoc.createdAt = serverTimestamp();
        baseDoc.usageCount = 0;
        if (user) {
          baseDoc.createdBy = { uid: user.uid, email: user.email ?? null };
        }
        await setDoc(doc(getDb(), "coupons", code), baseDoc);
        toast.success(`Created coupon ${code}`);
      } else if (editingCode) {
        await updateDoc(
          doc(getDb(), "coupons", editingCode),
          baseDoc as UpdateData<Record<string, unknown>>
        );
        toast.success(`Updated coupon ${editingCode}`);
      }
      setDialogOpen(false);
      await refresh();
    } catch (e) {
      console.error(e);
      setFormError(e instanceof Error ? e.message : "Could not save coupon.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: CouponDoc) => {
    setBusyCode(c.code);
    try {
      await updateDoc(doc(getDb(), "coupons", c.code), { active: !c.active });
      toast.success(`${c.code} ${c.active ? "disabled" : "enabled"}`);
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Could not update coupon.");
    } finally {
      setBusyCode(null);
    }
  };

  const remove = async (c: CouponDoc) => {
    if (!window.confirm(`Delete coupon ${c.code}? This can't be undone.`)) return;
    setBusyCode(c.code);
    try {
      await deleteDoc(doc(getDb(), "coupons", c.code));
      toast.success(`Deleted ${c.code}`);
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Could not delete coupon.");
    } finally {
      setBusyCode(null);
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <Ticket className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Coupons are admin-only</h1>
        <p className="text-sm text-muted-foreground">
          Ask a super admin to grant you the admin role to manage coupons.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <Ticket className="h-7 w-7 text-orange-500" />
            Coupons
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, edit, and manage discount codes for storefront checkout.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button
            type="button"
            className="bg-orange-600 text-white hover:bg-orange-500"
            onClick={openCreate}
          >
            <Plus className="mr-2 h-4 w-4" />
            New coupon
          </Button>
        </div>
      </header>

      {/* ── stats ─────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={stats.total} icon={Tag} />
        <StatCard label="Active" value={stats.active} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Expired" value={stats.expired} icon={XCircle} tone="muted" />
      </section>

      {/* ── filters + search ──────────────────────────────────────────── */}
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search code"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Button
              key={f.id}
              type="button"
              size="sm"
              variant={filter === f.id ? "default" : "outline"}
              className={cn(
                filter === f.id
                  ? "bg-orange-600 text-white hover:bg-orange-500"
                  : "border-border"
              )}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </section>

      {/* ── list ──────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-4 w-40 flex-1" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Tag className="h-9 w-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {coupons.length === 0
                ? "No coupons yet — create your first one."
                : "No coupons match those filters."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <CouponRow
                key={c.code}
                coupon={c}
                busy={busyCode === c.code}
                onEdit={() => openEdit(c)}
                onToggle={() => void toggleActive(c)}
                onDelete={() => void remove(c)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── form dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => !saving && setDialogOpen(o)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "New coupon" : `Edit ${editingCode}`}
            </DialogTitle>
            <DialogDescription>
              Discount codes apply at checkout. Eligibility (new customers,
              one-per-customer) is enforced server-side.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cp-code">Code</Label>
                <Input
                  id="cp-code"
                  placeholder="WELCOME10"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  disabled={dialogMode === "edit"}
                  className="font-mono uppercase tracking-wider"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, type: v as "percent" | "amount" }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                    <SelectItem value="amount">Fixed amount (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cp-value">
                  {form.type === "percent" ? "Percent off" : "Amount off (₹)"}
                </Label>
                <Input
                  id="cp-value"
                  type="number"
                  min={form.type === "percent" ? 1 : 1}
                  max={form.type === "percent" ? 100 : undefined}
                  step="0.01"
                  placeholder={form.type === "percent" ? "10" : "100"}
                  value={form.value}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, value: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cp-expiry">Expires on</Label>
                <Input
                  id="cp-expiry"
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expiresAt: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cp-min">Minimum subtotal (₹)</Label>
                <Input
                  id="cp-min"
                  type="number"
                  min={0}
                  placeholder="Optional"
                  value={form.minSubtotal}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minSubtotal: e.target.value }))
                  }
                />
              </div>
              {form.type === "percent" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="cp-max">Cap discount at (₹)</Label>
                  <Input
                    id="cp-max"
                    type="number"
                    min={0}
                    placeholder="Optional"
                    value={form.maxDiscount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, maxDiscount: e.target.value }))
                    }
                  />
                </div>
              ) : (
                <div /> // keep grid alignment
              )}
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={form.active}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, active: v === true }))
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Active</span>
                  <span className="block text-xs text-muted-foreground">
                    Turn off to keep the coupon on file without letting anyone
                    redeem it.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={form.newCustomerOnly}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, newCustomerOnly: v === true }))
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">First-order customers only</span>
                  <span className="block text-xs text-muted-foreground">
                    Valid only for signed-in customers placing their first
                    order.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={form.oncePerCustomer}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, oncePerCustomer: v === true }))
                  }
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">One redemption per customer</span>
                  <span className="block text-xs text-muted-foreground">
                    Each signed-in customer can use this code at most once.
                  </span>
                </span>
              </label>
            </div>

            {formError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="bg-orange-600 text-white hover:bg-orange-500"
              onClick={() => void submitForm()}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {dialogMode === "create" ? "Create coupon" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "emerald" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-3 shadow-sm",
        tone === "emerald" && "border-emerald-500/30",
        tone === "muted" && "border-border",
        tone === "default" && "border-border"
      )}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            tone === "emerald" && "text-emerald-500",
            tone === "muted" && "text-muted-foreground",
            tone === "default" && "text-orange-500"
          )}
        />
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function CouponRow({
  coupon,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  coupon: CouponDoc;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const expired = isExpired(coupon);
  const status = !coupon.active
    ? { label: "Disabled", className: "bg-muted text-muted-foreground" }
    : expired
      ? {
          label: "Expired",
          className: "bg-destructive/10 text-destructive",
        }
      : {
          label: "Active",
          className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        };

  const samplePreview = discountFromCoupon(coupon, 1000);

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-500">
          {coupon.type === "percent" ? (
            <Percent className="h-5 w-5" />
          ) : (
            <Tag className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-semibold uppercase tracking-wider">
              {coupon.code}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                status.className
              )}
            >
              {status.label}
            </span>
            {coupon.newCustomerOnly ? (
              <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-500">
                New customers
              </span>
            ) : null}
            {coupon.oncePerCustomer ? (
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-500">
                1 per user
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              {coupon.type === "percent"
                ? `${coupon.value}% off`
                : `${inrShort.format(coupon.value)} off`}
              {coupon.maxDiscount != null
                ? ` (cap ${inrShort.format(coupon.maxDiscount)})`
                : ""}
            </span>
            {coupon.minSubtotal > 0 ? (
              <span>min {inrShort.format(coupon.minSubtotal)}</span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {coupon.expiresAt ? fmtDate(coupon.expiresAt) : "no expiry"}
            </span>
            <span>· {coupon.usageCount} used</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            On ₹1,000 cart: customer saves{" "}
            <span className="font-semibold tabular-nums text-foreground">
              {inrShort.format(samplePreview)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onToggle}
          disabled={busy}
          className="border-border"
        >
          {coupon.active ? "Disable" : "Enable"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onEdit}
          disabled={busy}
          aria-label="Edit"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onDelete}
          disabled={busy}
          className="text-destructive hover:bg-destructive/10"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

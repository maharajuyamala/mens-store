import type { Metadata } from "next";
import {
  CheckCircle2,
  XCircle,
  Clock,
  PackageOpen,
  RefreshCw,
  Wallet,
  ShieldAlert,
  MessageCircle,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Refund, Returns & Cancellation Policy | Second Skin Mens World",
  description:
    "How cancellations, returns, exchanges, and refunds work at Second Skin Mens World.",
};

const SUPPORT_EMAIL = "support@secondskinmensworld.com";
const SUPPORT_WHATSAPP_URL = "https://wa.me/917036830536";

export default function RefundPolicyPage() {
  return (
    <>
      <h1>Refund, Returns &amp; Cancellation Policy</h1>
      <p className="text-muted-foreground text-sm">Last updated: 4 July 2026</p>

      <p>
        This policy applies to all purchases made on the Second Skin Mens World
        website. We want you to be completely happy with your order — if
        something isn&apos;t right, we&apos;ll do our best to make it right.
      </p>

      <div className="not-prose mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryStat
          icon={<Clock className="size-5" />}
          label="Return window"
          value="7 days from delivery"
        />
        <SummaryStat
          icon={<PackageOpen className="size-5" />}
          label="Reverse pickup"
          value="Free for eligible returns"
        />
        <SummaryStat
          icon={<Wallet className="size-5" />}
          label="Refund time"
          value="5–7 business days"
        />
      </div>

      <h2 className="flex items-center gap-2">
        <RefreshCw className="size-5" /> Order cancellation
      </h2>
      <p>
        You can cancel an order while it is still in <em>Pending</em> or{" "}
        <em>Processing</em> status. To cancel, visit your order confirmation
        page or <a href="/contact">contact us</a> immediately. Once a shipment
        has been handed to the courier partner, cancellation may no longer be
        possible and the item will need to go through the return process
        instead.
      </p>
      <div className="not-prose mt-3 grid gap-3 sm:grid-cols-3">
        <StatusStep
          label="Pending"
          detail="Cancel anytime — full refund."
          tone="good"
        />
        <StatusStep
          label="Processing"
          detail="Cancel by contacting us fast."
          tone="warn"
        />
        <StatusStep
          label="Shipped"
          detail="Can't cancel — raise a return after delivery."
          tone="bad"
        />
      </div>

      <h2 className="flex items-center gap-2">
        <ShieldAlert className="size-5" /> Return eligibility
      </h2>
      <p>
        We accept returns within <strong>7 days of delivery</strong>. Please
        check both lists before raising a request:
      </p>

      <div className="not-prose mt-4 grid gap-4 sm:grid-cols-2">
        <EligibilityList
          tone="good"
          title="Eligible"
          items={[
            "Manufacturing defect (stitching, fabric, print)",
            "Wrong item or size delivered",
            "Item significantly different from the description",
            "Item damaged in transit (reported within 48 hours)",
          ]}
        />
        <EligibilityList
          tone="bad"
          title="Not eligible"
          items={[
            "Item has been worn, washed, or altered",
            "Tags, labels, or original packaging removed",
            "Return raised after 7 days of delivery",
            "Innerwear or products marked non-returnable",
          ]}
        />
      </div>

      <h2>How to start a return</h2>
      <ol className="not-prose mt-4 space-y-3">
        <ReturnStep
          n={1}
          title="Contact us within 7 days"
          body={
            <>
              Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or{" "}
              <a href={SUPPORT_WHATSAPP_URL}>WhatsApp us</a> with your order
              number and the reason for return.
            </>
          }
        />
        <ReturnStep
          n={2}
          title="Share clear photos"
          body="Attach photographs of the item showing the defect, wrong item, or damage — with tags and packaging visible."
        />
        <ReturnStep
          n={3}
          title="Free reverse pickup"
          body="Once approved, we arrange a Shiprocket reverse pickup at no cost to you (for eligible defect / wrong-item cases)."
        />
        <ReturnStep
          n={4}
          title="Inspection & refund"
          body={
            <>
              After we receive and inspect the item, we initiate the refund
              within <strong>5–7 business days</strong>.
            </>
          }
        />
      </ol>

      <h2 className="flex items-center gap-2">
        <Wallet className="size-5" /> Refund method
      </h2>
      <ul>
        <li>
          <strong>Online payments (Cashfree)</strong> — refunded to the original
          payment method (UPI, card, net banking). Bank processing may take an
          additional 3–5 business days.
        </li>
        <li>
          <strong>Cash on delivery (COD)</strong> — refunded via NEFT bank
          transfer to an account you provide. Please share your bank details
          when you raise the return request.
        </li>
      </ul>

      <h2>Exchanges</h2>
      <p>
        We currently do not offer direct size exchanges. If you need a
        different size, please initiate a return for the original item and
        place a fresh order for the correct size.
      </p>

      <h2>Damaged in transit</h2>
      <p>
        If your order arrives damaged, please photograph the outer packaging
        and the item before opening fully, and contact us within{" "}
        <strong>48 hours of delivery</strong>. We will arrange a replacement or
        full refund at no cost to you.
      </p>

      <div className="not-prose bg-muted/40 mt-10 rounded-xl border p-6">
        <div className="text-base font-semibold">
          Still have a question about a return?
        </div>
        <div className="text-muted-foreground mt-1 text-sm">
          Reach out and we&apos;ll usually reply within one business day.
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="size-4" />
              WhatsApp support
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Mail className="size-4" />
              Email us
            </a>
          </Button>
        </div>
      </div>
    </>
  );
}

function SummaryStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="text-primary flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wide">
            {label}
          </span>
        </div>
        <div className="text-sm font-medium">{value}</div>
      </CardContent>
    </Card>
  );
}

function StatusStep({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "warn"
      ? "border-amber-500/30 bg-amber-500/5"
      : "border-rose-500/30 bg-rose-500/5";
  const dot =
    tone === "good"
      ? "bg-emerald-500"
      : tone === "warn"
      ? "bg-amber-500"
      : "bg-rose-500";
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${dot}`} />
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="text-muted-foreground mt-1 text-xs leading-relaxed">
        {detail}
      </div>
    </div>
  );
}

function EligibilityList({
  tone,
  title,
  items,
}: {
  tone: "good" | "bad";
  title: string;
  items: string[];
}) {
  const Icon = tone === "good" ? CheckCircle2 : XCircle;
  const color = tone === "good" ? "text-emerald-600" : "text-rose-600";
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className={`flex items-center gap-2 ${color}`}>
          <Icon className="size-5" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it} className="flex gap-2 text-sm leading-relaxed">
              <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} />
              <span className="text-muted-foreground">{it}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ReturnStep({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-lg border p-4">
      <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
        {n}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {body}
        </div>
      </div>
    </li>
  );
}

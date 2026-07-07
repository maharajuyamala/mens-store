import type { Metadata } from "next";
import {
  Mail,
  MessageCircle,
  Phone,
  Clock,
  MapPin,
  Package,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Contact Us | Second Skin Mens Ware",
  description:
    "Get in touch with Second Skin Mens Ware for order help, returns, or any other queries.",
};

const SUPPORT_EMAIL = "support@secondskinmensworld.com";
const SUPPORT_PHONE_DISPLAY = "+91 70368 30536";
const SUPPORT_PHONE_TEL = "+917036830536";
const SUPPORT_WHATSAPP_URL = "https://wa.me/917036830536";

export default function ContactPage() {
  return (
    <>
      <h1>Contact Us</h1>
      <p>
        We&apos;re here to help. Whether you have a question about an order,
        need sizing advice, or want to discuss a return — reach out and
        we&apos;ll get back to you as soon as possible.
      </p>

      <div className="not-prose mt-8 grid gap-4 sm:grid-cols-3">
        <ContactMethod
          icon={<Mail className="size-5" />}
          label="Email"
          value={SUPPORT_EMAIL}
          href={`mailto:${SUPPORT_EMAIL}`}
          cta="Send email"
        />
        <ContactMethod
          icon={<MessageCircle className="size-5" />}
          label="WhatsApp"
          value={SUPPORT_PHONE_DISPLAY}
          href={SUPPORT_WHATSAPP_URL}
          cta="Chat on WhatsApp"
          highlight
        />
        <ContactMethod
          icon={<Phone className="size-5" />}
          label="Call"
          value={SUPPORT_PHONE_DISPLAY}
          href={`tel:${SUPPORT_PHONE_TEL}`}
          cta="Call now"
        />
      </div>

      <div className="not-prose mt-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex gap-4">
            <div className="text-primary mt-0.5">
              <Clock className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Support hours</div>
              <div className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Monday – Saturday
                <br />
                10:00 AM – 6:00 PM IST
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex gap-4">
            <div className="text-primary mt-0.5">
              <MapPin className="size-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Store &amp; office</div>
              <address className="text-muted-foreground mt-1 text-sm leading-relaxed not-italic">
                Second Skin Mens Ware
                <br />
                6-631/1, Ground Floor, Vimanapuri Colony
                <br />
                Quthbullapur, Hyderabad – 500055
                <br />
                Telangana, India
              </address>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="mt-8">
        For the fastest response, WhatsApp us directly or email with your order
        number in the subject line.
      </p>

      <h2 className="flex items-center gap-2">
        <Package className="size-5" /> Order issues
      </h2>
      <p>
        For order-related queries (tracking, cancellation, exchanges, or
        missing items), please include:
      </p>
      <ul>
        <li>Your order number (found in your confirmation email)</li>
        <li>A brief description of the issue</li>
        <li>Photos if the item is damaged or incorrect</li>
      </ul>
      <p>
        We aim to resolve all order issues within{" "}
        <strong>1–2 business days</strong>.
      </p>

      <h2 className="flex items-center gap-2">
        <RotateCcw className="size-5" /> Returns &amp; refunds
      </h2>
      <p>
        See our <a href="/refund-policy">Refund &amp; Returns Policy</a> for
        full details on eligibility and timelines.
      </p>
    </>
  );
}

function ContactMethod({
  icon,
  label,
  value,
  href,
  cta,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  cta: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-3">
        <div className="text-primary flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wide">
            {label}
          </span>
        </div>
        <div className="text-sm font-medium break-all">{value}</div>
        <Button
          asChild
          variant={highlight ? "default" : "outline"}
          size="sm"
          className="mt-auto w-full"
        >
          <a
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            {cta}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

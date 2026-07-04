import type { Metadata } from "next";
import { Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Terms & Conditions | Second Skin Mens World",
  description:
    "Terms and conditions governing use of the Second Skin Mens World website and purchases.",
};

const SUPPORT_EMAIL = "support@secondskinmensworld.com";
const SUPPORT_WHATSAPP_URL = "https://wa.me/917036830536";

const SECTIONS = [
  { id: "acceptance", title: "Acceptance of terms" },
  { id: "eligibility", title: "Eligibility" },
  { id: "account-security", title: "Account & security" },
  { id: "product-info", title: "Product information" },
  { id: "orders-pricing", title: "Orders & pricing" },
  { id: "payment", title: "Payment" },
  { id: "shipping", title: "Shipping" },
  { id: "returns", title: "Returns & refunds" },
  { id: "ip", title: "Intellectual property" },
  { id: "liability", title: "Limitation of liability" },
  { id: "privacy", title: "Privacy" },
  { id: "governing-law", title: "Governing law & jurisdiction" },
  { id: "changes", title: "Changes to these terms" },
  { id: "contact", title: "Contact" },
];

export default function TermsPage() {
  return (
    <>
      <h1>Terms &amp; Conditions</h1>
      <p className="text-muted-foreground text-sm">Last updated: 4 July 2026</p>

      <p>
        This website is owned and operated by{" "}
        <strong>Second Skin Mens World</strong>, 6-631/1, Ground Floor,
        Vimanapuri Colony, Quthbullapur, Hyderabad – 500055, Telangana, India.
        By accessing or placing an order on this Site you agree to be bound by
        the following Terms &amp; Conditions.
      </p>

      <div className="not-prose bg-muted/40 mt-6 rounded-xl border p-5">
        <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Contents
        </div>
        <ol className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {SECTIONS.map((s, i) => (
            <li key={s.id} className="flex gap-2">
              <span className="text-muted-foreground w-5 text-right tabular-nums">
                {i + 1}.
              </span>
              <a
                href={`#${s.id}`}
                className="hover:text-primary underline-offset-4 hover:underline"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </div>

      <TermsSection n={1} id="acceptance" title="Acceptance of terms">
        By browsing, registering, or purchasing on this Site you confirm that
        you have read, understood, and accepted these Terms. If you do not
        agree, please do not use the Site.
      </TermsSection>

      <TermsSection n={2} id="eligibility" title="Eligibility">
        You must be at least 18 years of age, or placing an order with the
        consent of a parent or legal guardian, to transact on this Site. By
        completing a purchase you represent that you meet this requirement.
      </TermsSection>

      <TermsSection n={3} id="account-security" title="Account & security">
        You are responsible for maintaining the confidentiality of your login
        credentials and for all activity that occurs under your account.
        Notify us immediately at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> if you suspect
        any unauthorised use.
      </TermsSection>

      <TermsSection n={4} id="product-info" title="Product information">
        We take care to display product colours, sizes, and descriptions
        accurately, but slight variations may occur due to screen settings or
        photography. Measurements are provided as a guide; please refer to the
        size chart before ordering.
      </TermsSection>

      <TermsSection n={5} id="orders-pricing" title="Orders & pricing">
        All orders are subject to acceptance and stock availability. Prices are
        displayed in Indian Rupees (INR) and include applicable taxes unless
        stated otherwise. We reserve the right to correct pricing errors after
        an order is placed; in such cases we will contact you before processing
        and offer a full cancellation and refund if you prefer.
      </TermsSection>

      <TermsSection n={6} id="payment" title="Payment">
        Payments are processed securely via Cashfree. We accept UPI, net
        banking, credit / debit cards, and cash on delivery (COD) where
        available. We do not store any payment card details on our servers.
      </TermsSection>

      <TermsSection n={7} id="shipping" title="Shipping">
        Orders are dispatched via Shiprocket-managed courier partners.
        Estimated delivery timelines and shipping charges are described in our{" "}
        <a href="/shipping">Shipping Policy</a>. Delivery estimates begin from
        the date of dispatch, not the date of order.
      </TermsSection>

      <TermsSection n={8} id="returns" title="Returns & refunds">
        Our full cancellation, returns, and refund process is detailed in the{" "}
        <a href="/refund-policy">Refund &amp; Returns Policy</a>. By placing an
        order you agree to the terms set out in that policy.
      </TermsSection>

      <TermsSection n={9} id="ip" title="Intellectual property">
        All content on this Site — including text, images, graphics, logos,
        and product photographs — is owned by or licensed to Second Skin Mens
        World. You may not copy, reproduce, distribute, or create derivative
        works without our prior written permission.
      </TermsSection>

      <TermsSection n={10} id="liability" title="Limitation of liability">
        To the maximum extent permitted by applicable law, Second Skin Mens
        World shall not be liable for any indirect, incidental, or
        consequential damages arising from use of this Site or its products.
        Our total liability in respect of any order shall not exceed the amount
        paid for that order.
      </TermsSection>

      <TermsSection n={11} id="privacy" title="Privacy">
        Your personal data is handled in accordance with our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </TermsSection>

      <TermsSection
        n={12}
        id="governing-law"
        title="Governing law & jurisdiction"
      >
        These Terms are governed by and construed in accordance with the laws
        of India. Any disputes arising out of or in connection with these Terms
        shall be subject to the exclusive jurisdiction of the courts at{" "}
        <strong>Hyderabad, Telangana</strong>.
      </TermsSection>

      <TermsSection n={13} id="changes" title="Changes to these terms">
        We may update these Terms from time to time. The &ldquo;Last
        updated&rdquo; date at the top of this page will reflect any changes.
        Continued use of the Site after changes are published constitutes
        acceptance of the revised Terms.
      </TermsSection>

      <TermsSection n={14} id="contact" title="Contact">
        For any questions about these Terms, please{" "}
        <a href="/contact">contact us</a> or write to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </TermsSection>

      <div className="not-prose bg-muted/40 mt-10 rounded-xl border p-6">
        <div className="text-base font-semibold">
          Questions about these terms?
        </div>
        <div className="text-muted-foreground mt-1 text-sm">
          Our team is happy to clarify anything on this page.
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

function TermsSection({
  n,
  id,
  title,
  children,
}: {
  n: number;
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="flex items-baseline gap-3">
        <span className="text-muted-foreground text-sm tabular-nums">
          {n.toString().padStart(2, "0")}
        </span>
        <span>{title}</span>
      </h2>
      <p>{children}</p>
    </section>
  );
}

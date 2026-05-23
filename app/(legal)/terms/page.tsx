import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | SecondSkin",
  description: "Terms and conditions for SecondSkin.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms & Conditions</h1>
      <p className="text-sm text-muted-foreground">Last updated: TODO</p>

      <p>
        <strong>TODO — Replace this scaffold with reviewed legal copy.</strong>{" "}
        The text below is a starting point and is <em>not</em> a substitute for
        legal advice. Have it reviewed before publishing.
      </p>

      <h2>1. Acceptance</h2>
      <p>
        By accessing or using SecondSkin (the &quot;Site&quot;) you agree to be
        bound by these Terms & Conditions. If you do not agree, do not use the
        Site.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old or have a parent / guardian&apos;s
        consent to place orders.
      </p>

      <h2>3. Account</h2>
      <p>
        You are responsible for keeping your account credentials confidential
        and for activity under your account.
      </p>

      <h2>4. Orders & pricing</h2>
      <p>
        All orders are subject to acceptance and availability. Prices shown
        include applicable taxes unless stated otherwise. We may correct pricing
        errors after order placement and cancel affected orders with a full
        refund.
      </p>

      <h2>5. Shipping</h2>
      <p>
        Shipping terms are described in our{" "}
        <a href="/shipping">Shipping policy</a>.
      </p>

      <h2>6. Returns & refunds</h2>
      <p>
        See our <a href="/refund-policy">Refund & Returns policy</a> for
        timelines and eligibility.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        All site content, designs, and marks are owned by SecondSkin or its
        licensors and may not be reproduced without permission.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, SecondSkin&apos;s liability is
        limited to the amount paid for the order in question.
      </p>

      <h2>9. Governing law & jurisdiction</h2>
      <p>
        These Terms are governed by the laws of India. Disputes are subject to
        the exclusive jurisdiction of the courts at <strong>TODO city</strong>.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions? <a href="/contact">Contact us</a>.
      </p>
    </>
  );
}

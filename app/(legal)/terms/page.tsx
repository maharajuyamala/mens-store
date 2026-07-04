import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | Second Skin Mens World",
  description: "Terms and conditions governing use of the Second Skin Mens World website and purchases.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms & Conditions</h1>
      <p className="text-sm text-muted-foreground">Last updated: 4 July 2026</p>

      <p>
        This website is owned and operated by{" "}
        <strong>Second Skin Mens World</strong>, 6-631/1, Ground Floor,
        Vimanapuri Colony, Quthbullapur, Hyderabad – 500055, Telangana, India.
        By accessing or placing an order on this Site you agree to be bound by
        the following Terms & Conditions.
      </p>

      <h2>1. Acceptance of terms</h2>
      <p>
        By browsing, registering, or purchasing on this Site you confirm that
        you have read, understood, and accepted these Terms. If you do not
        agree, please do not use the Site.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years of age, or placing an order with the
        consent of a parent or legal guardian, to transact on this Site. By
        completing a purchase you represent that you meet this requirement.
      </p>

      <h2>3. Account & security</h2>
      <p>
        You are responsible for maintaining the confidentiality of your login
        credentials and for all activity that occurs under your account. Notify
        us immediately at{" "}
        <a href="mailto:support@secondskinmensworld.com">
          support@secondskinmensworld.com
        </a>{" "}
        if you suspect any unauthorised use.
      </p>

      <h2>4. Product information</h2>
      <p>
        We take care to display product colours, sizes, and descriptions
        accurately, but slight variations may occur due to screen settings or
        photography. Measurements are provided as a guide; please refer to the
        size chart before ordering.
      </p>

      <h2>5. Orders & pricing</h2>
      <p>
        All orders are subject to acceptance and stock availability. Prices are
        displayed in Indian Rupees (INR) and include applicable taxes unless
        stated otherwise. We reserve the right to correct pricing errors after
        an order is placed; in such cases we will contact you before processing
        and offer a full cancellation and refund if you prefer.
      </p>

      <h2>6. Payment</h2>
      <p>
        Payments are processed securely via Razorpay. We accept UPI, net
        banking, credit / debit cards, and cash on delivery (COD) where
        available. We do not store any payment card details on our servers.
      </p>

      <h2>7. Shipping</h2>
      <p>
        Orders are dispatched via Shiprocket-managed courier partners. Estimated
        delivery timelines and shipping charges are described in our{" "}
        <a href="/shipping">Shipping Policy</a>. Delivery estimates begin from
        the date of dispatch, not the date of order.
      </p>

      <h2>8. Returns & refunds</h2>
      <p>
        Our full returns and refund process is detailed in the{" "}
        <a href="/refund-policy">Refund & Returns Policy</a>. By placing an
        order you agree to the terms set out in that policy.
      </p>

      <h2>9. Intellectual property</h2>
      <p>
        All content on this Site — including text, images, graphics, logos, and
        product photographs — is owned by or licensed to Second Skin Mens World.
        You may not copy, reproduce, distribute, or create derivative works
        without our prior written permission.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by applicable law, Second Skin Mens
        World shall not be liable for any indirect, incidental, or consequential
        damages arising from use of this Site or its products. Our total
        liability in respect of any order shall not exceed the amount paid for
        that order.
      </p>

      <h2>11. Privacy</h2>
      <p>
        Your personal data is handled in accordance with our{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>12. Governing law & jurisdiction</h2>
      <p>
        These Terms are governed by and construed in accordance with the laws of
        India. Any disputes arising out of or in connection with these Terms
        shall be subject to the exclusive jurisdiction of the courts at{" "}
        <strong>Hyderabad, Telangana</strong>.
      </p>

      <h2>13. Changes to these terms</h2>
      <p>
        We may update these Terms from time to time. The &ldquo;Last
        updated&rdquo; date at the top of this page will reflect any changes.
        Continued use of the Site after changes are published constitutes
        acceptance of the revised Terms.
      </p>

      <h2>14. Contact</h2>
      <p>
        For any questions about these Terms, please{" "}
        <a href="/contact">contact us</a> or write to{" "}
        <a href="mailto:support@secondskinmensworld.com">
          support@secondskinmensworld.com
        </a>
        .
      </p>
    </>
  );
}

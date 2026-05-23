import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund & Returns Policy | SecondSkin",
  description: "How returns and refunds work at SecondSkin.",
};

export default function RefundPolicyPage() {
  return (
    <>
      <h1>Refund & Returns Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: TODO</p>

      <p>
        <strong>TODO — Replace this scaffold with the policy you actually
        operate.</strong> Razorpay and Shiprocket KYC reviews check for this
        page, so keep it accurate.
      </p>

      <h2>Cancellations</h2>
      <p>
        You can request cancellation of an order while it is still in{" "}
        <em>Pending</em> or <em>Processing</em> status from the order
        confirmation page or by{" "}
        <a href="/contact">contacting us</a>. We approve cancellations as
        quickly as possible; once a shipment is handed to the courier we may
        not be able to cancel.
      </p>

      <h2>Returns</h2>
      <p>
        <strong>TODO:</strong> describe the return window (e.g. 7 days from
        delivery), eligible reasons (size, defect), and items not eligible
        (innerwear, customised goods).
      </p>

      <h2>How to start a return</h2>
      <ol>
        <li>Contact us within the return window with your order number.</li>
        <li>We&apos;ll arrange a reverse pickup via Shiprocket if eligible.</li>
        <li>
          Once we receive and inspect the item, we initiate the refund within{" "}
          <strong>TODO X</strong> business days.
        </li>
      </ol>

      <h2>Refund method</h2>
      <ul>
        <li>
          <strong>Online (Razorpay)</strong> orders are refunded to the
          original payment method.
        </li>
        <li>
          <strong>Cash on delivery</strong> orders are refunded via bank
          transfer to an account you provide.
        </li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions? <a href="/contact">Contact us</a>.
      </p>
    </>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund & Returns Policy | Second Skin Mens World",
  description: "How returns, exchanges, and refunds work at Second Skin Mens World.",
};

export default function RefundPolicyPage() {
  return (
    <>
      <h1>Refund & Returns Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: 4 July 2026</p>

      <p>
        This policy applies to all purchases made on the Second Skin Mens World
        website. We want you to be completely happy with your order — if
        something isn&apos;t right, we&apos;ll do our best to make it right.
      </p>

      <h2>Cancellations</h2>
      <p>
        You can cancel an order while it is still in <em>Pending</em> or{" "}
        <em>Processing</em> status. To cancel, visit your order confirmation
        page or <a href="/contact">contact us</a> immediately. Once a shipment
        has been handed to the courier partner, cancellation may no longer be
        possible and the item will need to go through the return process instead.
      </p>

      <h2>Return eligibility</h2>
      <p>
        We accept returns within <strong>7 days of delivery</strong> for the
        following reasons:
      </p>
      <ul>
        <li>Manufacturing defect (stitching, fabric, print)</li>
        <li>Wrong item or size delivered</li>
        <li>Item significantly different from the product description</li>
      </ul>
      <p>
        Items are <strong>not eligible</strong> for return if:
      </p>
      <ul>
        <li>They have been worn, washed, or altered</li>
        <li>Tags, labels, or packaging have been removed</li>
        <li>The return request is raised after 7 days of delivery</li>
        <li>The item is innerwear or any product marked as non-returnable</li>
      </ul>

      <h2>How to start a return</h2>
      <ol>
        <li>
          Contact us within 7 days of delivery at{" "}
          <a href="mailto:support@secondskinmensworld.com">
            support@secondskinmensworld.com
          </a>{" "}
          or via{" "}
          <a href="https://wa.me/917036830536">WhatsApp (+91 70368 30536)</a>{" "}
          with your order number and reason for return.
        </li>
        <li>
          Attach clear photographs of the item showing the defect or issue.
        </li>
        <li>
          Once we approve the return, we will arrange a reverse pickup via
          Shiprocket at no additional cost to you (for eligible defect /
          wrong-item cases).
        </li>
        <li>
          After we receive and inspect the returned item, we will initiate the
          refund within <strong>5–7 business days</strong>.
        </li>
      </ol>

      <h2>Refund method</h2>
      <ul>
        <li>
          <strong>Online payments (Razorpay)</strong> — refunded to the original
          payment method (UPI, card, net banking). Bank processing may take an
          additional 3–5 business days.
        </li>
        <li>
          <strong>Cash on delivery (COD)</strong> — refunded via NEFT bank
          transfer to an account number you provide. Please share your bank
          details when you raise the return request.
        </li>
      </ul>

      <h2>Exchanges</h2>
      <p>
        We currently do not offer direct size exchanges. If you need a different
        size, please initiate a return for the original item and place a fresh
        order for the correct size.
      </p>

      <h2>Damaged in transit</h2>
      <p>
        If your order arrives damaged, please photograph the outer packaging and
        the item before opening fully, and contact us within{" "}
        <strong>48 hours of delivery</strong>. We will arrange a replacement or
        full refund at no cost to you.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about a return or refund? <a href="/contact">Contact us</a> —
        we typically respond within one business day.
      </p>
    </>
  );
}

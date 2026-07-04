import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | Second Skin Mens World",
  description: "Get in touch with Second Skin Mens World for order help, returns, or any other queries.",
};

export default function ContactPage() {
  return (
    <>
      <h1>Contact Us</h1>
      <p>
        We&apos;re here to help. Whether you have a question about an order,
        need sizing advice, or want to discuss a return — reach out and we&apos;ll
        get back to you as soon as possible.
      </p>

      <h2>Customer support</h2>
      <ul>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:support@secondskinmensworld.com">
            support@secondskinmensworld.com
          </a>
        </li>
        <li>
          <strong>WhatsApp / Phone:</strong>{" "}
          <a href="https://wa.me/917036830536">+91 70368 30536</a>
        </li>
        <li>
          <strong>Support hours:</strong> Monday – Saturday, 10:00 AM – 6:00 PM IST
        </li>
      </ul>
      <p>
        For the fastest response, WhatsApp us directly or email with your order
        number in the subject line.
      </p>

      <h2>Business details</h2>
      <address className="not-italic">
        <strong>Second Skin Mens World</strong>
        <br />
        6-631/1, Ground Floor, Vimanapuri Colony
        <br />
        Quthbullapur, Hyderabad – 500055
        <br />
        Telangana, India
      </address>

      <h2>Order issues</h2>
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
        We aim to resolve all order issues within <strong>1–2 business days</strong>.
      </p>

      <h2>Returns & refunds</h2>
      <p>
        See our <a href="/refund-policy">Refund & Returns Policy</a> for full
        details on eligibility and timelines.
      </p>
    </>
  );
}

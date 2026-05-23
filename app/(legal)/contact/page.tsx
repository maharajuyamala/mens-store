import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | SecondSkin",
  description: "Get in touch with the SecondSkin team.",
};

export default function ContactPage() {
  return (
    <>
      <h1>Contact Us</h1>
      <p className="text-sm text-muted-foreground">
        Replace these placeholders with your real contact details — Razorpay
        and Shiprocket KYC checks both require a working contact channel.
      </p>

      <h2>Customer support</h2>
      <ul>
        <li>
          <strong>Email:</strong>{" "}
          <a href="mailto:support@secondskinmensworld.com">
            support@secondskinmensworld.com
          </a>{" "}
          <em>(TODO — replace)</em>
        </li>
        <li>
          <strong>Phone / WhatsApp:</strong> +91 TODO XXXXXXXXXX
        </li>
        <li>
          <strong>Hours:</strong> Mon–Sat, 10:00 to 18:00 IST
        </li>
      </ul>

      <h2>Business address</h2>
      <address className="not-italic">
        SecondSkin
        <br />
        TODO street
        <br />
        TODO city, TODO state, TODO PIN
        <br />
        India
      </address>

      <h2>Order issues</h2>
      <p>
        Quickest way to get help with a specific order is to include the order
        number from your confirmation email.
      </p>
    </>
  );
}

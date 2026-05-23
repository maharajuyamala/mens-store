import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | SecondSkin",
  description: "How SecondSkin collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: TODO</p>

      <p>
        <strong>TODO — Replace this scaffold with reviewed legal copy.</strong>{" "}
        The text below describes the data practices implemented in the current
        codebase. Have it reviewed before publishing.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>
          <strong>Account info:</strong> name, email, password hash (via
          Firebase Authentication).
        </li>
        <li>
          <strong>Order info:</strong> shipping address, phone, items, payment
          method, payment reference (Razorpay), shipment tracking (Shiprocket).
        </li>
        <li>
          <strong>Browsing data:</strong> wishlist, recently viewed, cart
          contents.
        </li>
        <li>
          <strong>Communications:</strong> emails you send us and order-related
          emails we send you.
        </li>
      </ul>

      <h2>2. How we use it</h2>
      <p>
        To process orders, deliver them via Shiprocket, communicate about
        orders, prevent fraud, and improve the store. We do not sell your data.
      </p>

      <h2>3. Sharing</h2>
      <p>We share the minimum necessary data with the following processors:</p>
      <ul>
        <li>Firebase (Google) — authentication, database, file storage.</li>
        <li>Razorpay — online payment processing.</li>
        <li>Shiprocket — shipping label generation and tracking.</li>
        <li>Resend — transactional email delivery.</li>
      </ul>

      <h2>4. Retention</h2>
      <p>
        We retain order records as long as required for accounting and tax
        compliance. You can request deletion of marketing data; order history
        cannot be deleted while statutory retention applies.
      </p>

      <h2>5. Your rights</h2>
      <p>
        You can access, update, or request deletion of your data by emailing{" "}
        <a href="/contact">our support</a>.
      </p>

      <h2>6. Security</h2>
      <p>
        We use TLS in transit, Firebase security rules, and signed payment
        verification. No system is perfectly secure — please use a strong,
        unique password.
      </p>

      <h2>7. Children</h2>
      <p>
        The Site is not directed at children under 13. We do not knowingly
        collect data from children.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions about this policy? <a href="/contact">Contact us</a>.
      </p>
    </>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping Policy | SecondSkin",
  description: "Shipping timelines and serviceability for SecondSkin orders.",
};

export default function ShippingPolicyPage() {
  return (
    <>
      <h1>Shipping Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: TODO</p>

      <p>
        <strong>TODO — Replace this scaffold with timelines you can
        consistently meet.</strong>
      </p>

      <h2>Serviceability</h2>
      <p>
        We ship across India via Shiprocket. At checkout we automatically
        check if your PIN code is serviceable.
      </p>

      <h2>Shipping cost</h2>
      <p>
        <strong>Shipping is free on all orders.</strong>
      </p>

      <h2>Dispatch & delivery</h2>
      <ul>
        <li>
          <strong>Dispatch:</strong> within <strong>TODO 1–2 business days</strong> of
          order confirmation.
        </li>
        <li>
          <strong>Delivery:</strong> typically{" "}
          <strong>TODO 3–7 business days</strong> after dispatch, depending on
          location.
        </li>
      </ul>

      <h2>Tracking</h2>
      <p>
        Once dispatched, you&apos;ll receive a tracking link by email. You can
        also view it on your order confirmation page.
      </p>

      <h2>Delays</h2>
      <p>
        Festivals, weather, and remote PIN codes may add transit time. If your
        order is late, <a href="/contact">contact us</a> and we&apos;ll chase
        the courier.
      </p>
    </>
  );
}

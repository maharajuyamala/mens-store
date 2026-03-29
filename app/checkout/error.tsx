"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-28 text-center">
      <h1 className="text-xl font-semibold">Checkout error</h1>
      <p className="mt-2 text-muted-foreground">
        We couldn&apos;t load checkout. Your cart is still saved in this browser.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/explore">Shop</Link>
        </Button>
      </div>
    </div>
  );
}

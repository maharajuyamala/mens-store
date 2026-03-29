"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OrderConfirmationError({
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
      <h1 className="text-xl font-semibold">Couldn&apos;t load confirmation</h1>
      <p className="mt-2 text-muted-foreground">
        Your order may still have gone through. Check your email or contact support.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/explore">Continue shopping</Link>
        </Button>
      </div>
    </div>
  );
}

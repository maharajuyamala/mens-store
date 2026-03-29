"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ProductDetailsError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 pt-28 pb-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        We couldn&apos;t load this product. Try again or return to the shop.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          onClick={() => reset()}
          className="bg-orange-600 hover:bg-orange-500"
        >
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/explore">Browse shop</Link>
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ExploreError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-black px-4 pt-28 pb-16 text-center text-white">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-gray-400">
        We couldn&apos;t load the shop. Check your connection and try again.
      </p>
      {process.env.NODE_ENV === "development" ? (
        <p className="max-w-lg break-all rounded-md border border-red-500/40 bg-red-950/40 px-3 py-2 text-left text-xs text-red-200">
          {error.message}
          {error.digest ? ` (digest: ${error.digest})` : ""}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        <Button
          type="button"
          onClick={() => reset()}
          className="bg-orange-600 hover:bg-orange-500"
        >
          Try again
        </Button>
        <Button asChild variant="outline" className="border-gray-600">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}

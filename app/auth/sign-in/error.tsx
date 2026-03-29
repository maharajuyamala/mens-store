"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SignInError({
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
    <div className="mx-auto max-w-sm px-4 py-28 text-center">
      <h1 className="text-lg font-semibold">Sign-in error</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Something went wrong loading this page.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button type="button" size="sm" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}

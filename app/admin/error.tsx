"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminError({
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
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <h1 className="text-lg font-semibold text-foreground">Admin error</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This section failed to load. Try again or return to the dashboard.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" size="sm" onClick={() => reset()}>
          Retry
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/admin">Overview</Link>
        </Button>
      </div>
    </div>
  );
}

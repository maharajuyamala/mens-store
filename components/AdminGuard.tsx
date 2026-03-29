"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function AdminGuardSkeleton() {
  return (
    <div className="mx-auto min-h-[60vh] max-w-4xl space-y-4 px-4 pt-28 sm:px-8">
      <Skeleton className="h-10 w-48 bg-muted" />
      <Skeleton className="h-64 w-full rounded-xl bg-muted" />
      <Skeleton className="h-4 w-full max-w-md bg-muted" />
      <Skeleton className="h-4 w-full max-w-sm bg-muted" />
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Admin access required
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        You&apos;re signed in, but this account doesn&apos;t have the admin
        role. In Firebase Console → Firestore →{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">users</code> →
        your user document, set{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">role</code> to{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">admin</code>,
        then refresh this page.
      </p>
      <Button asChild className="mt-8 bg-orange-600 text-white hover:bg-orange-500">
        <Link href="/">Back to store</Link>
      </Button>
    </div>
  );
}

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = encodeURIComponent(pathname || "/admin");
      router.replace(`/auth/sign-in?next=${next}`);
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return <AdminGuardSkeleton />;
  }

  if (!user) {
    return <AdminGuardSkeleton />;
  }

  if (!isAdmin) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Package } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountPage() {
  const { user, profile, loading, isAdmin, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(
        `/auth/sign-in?next=${encodeURIComponent("/account")}`
      );
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 pb-28 pt-28 md:pb-16">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const displayName =
    profile?.displayName?.trim() ||
    user.displayName?.trim() ||
    user.email?.split("@")[0] ||
    "Member";
  const avatarSrc = user.photoURL || profile?.photoURL || null;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 pb-28 pt-28 md:pb-16">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Your account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Profile and shortcuts for your SecondSkin experience.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
          {avatarSrc ? (
            <Image
              src={avatarSrc}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
              unoptimized={avatarSrc.startsWith("data:")}
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground ring-2 ring-border"
              aria-hidden
            >
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-xl">{displayName}</CardTitle>
            <CardDescription className="truncate">
              {user.email ?? "No email on file"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {isAdmin ? (
            <Button
              asChild
              className="w-full bg-orange-600 text-white hover:bg-orange-500"
            >
              <Link href="/admin">
                <LayoutDashboard className="mr-2 size-4" />
                Admin dashboard
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="w-full border-border">
            <Link href="/explore">
              <Package className="mr-2 size-4" />
              Continue shopping
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full border-border"
            onClick={() => void signOut()}
          >
            <LogOut className="mr-2 size-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

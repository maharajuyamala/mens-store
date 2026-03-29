import { Skeleton } from "@/components/ui/skeleton";

export default function CheckoutLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-28 space-y-6">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-10 w-40" />
    </div>
  );
}

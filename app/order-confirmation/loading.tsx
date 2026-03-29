import { Skeleton } from "@/components/ui/skeleton";

export default function OrderConfirmationLoading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-28 space-y-4">
      <Skeleton className="mx-auto h-12 w-12 rounded-full" />
      <Skeleton className="mx-auto h-8 w-64" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}

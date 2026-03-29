import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-6 px-4 py-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

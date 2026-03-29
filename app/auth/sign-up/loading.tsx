import { Skeleton } from "@/components/ui/skeleton";

export default function SignUpLoading() {
  return (
    <div className="mx-auto max-w-sm px-4 py-28 space-y-4">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

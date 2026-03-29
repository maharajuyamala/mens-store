import { Skeleton } from "@/components/ui/skeleton";

export default function SignInLoading() {
  return (
    <div className="mx-auto max-w-sm px-4 py-28 space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function ExploreLoading() {
  return (
    <div className="min-h-screen bg-black pb-16 pt-28 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Skeleton className="mx-auto mb-4 h-10 w-72 rounded-lg bg-gray-800" />
        <Skeleton className="mx-auto mb-10 h-6 w-96 max-w-full rounded-md bg-gray-800" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton
              key={i}
              className="aspect-[3/4] rounded-xl bg-gray-800"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

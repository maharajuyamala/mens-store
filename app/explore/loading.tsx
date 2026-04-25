import { Skeleton } from "@/components/ui/skeleton";

export default function ExploreLoading() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 pb-24 pt-28 text-white">
      <div
        className="pointer-events-none absolute left-1/4 top-20 h-64 w-64 -translate-x-1/2 rounded-full bg-orange-500/10 blur-[90px]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto mb-10 max-w-xl space-y-3 text-center">
          <Skeleton className="mx-auto h-3 w-24 rounded-full bg-zinc-800" />
          <Skeleton className="mx-auto h-12 w-full max-w-md rounded-xl bg-zinc-800/90" />
          <Skeleton className="mx-auto h-4 w-2/3 max-w-sm rounded-md bg-zinc-800/70" />
        </div>
        <Skeleton className="mx-auto mb-10 h-14 max-w-3xl rounded-2xl bg-zinc-800/60" />
        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton
              key={i}
              className="aspect-[3/4] rounded-2xl bg-zinc-800/80 ring-1 ring-white/5"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function RootLoading() {
  return (
    <div className="min-h-[50vh] bg-black px-4 py-28">
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="mx-auto h-12 w-2/3 max-w-md rounded-lg bg-gray-800" />
        <Skeleton className="mx-auto h-6 w-full max-w-lg rounded-md bg-gray-800" />
        <Skeleton className="mx-auto mt-8 aspect-video w-full max-w-3xl rounded-xl bg-gray-800" />
      </div>
    </div>
  );
}

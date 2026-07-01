import { Skeleton } from "@/components/ui/skeleton";

// Matches the dashboard's container so the swap to real content doesn't shift layout.
export default function DashboardLoading() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-6">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
            <Skeleton className="h-6 w-40" />
            <div className="space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

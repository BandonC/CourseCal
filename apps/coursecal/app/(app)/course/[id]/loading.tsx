import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the course detail container — back link, header, and deliverable rows.
export default function CourseLoading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-9 w-64" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}

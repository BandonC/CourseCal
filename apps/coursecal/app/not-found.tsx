import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

// App-wide 404, also rendered when a server component calls notFound() (e.g. a
// semester/course that's missing or owned by another user — the query scopes by
// userId, so the two are indistinguishable).
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <SearchXIcon className="size-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Not found</h1>
        <p className="text-muted-foreground text-sm">
          That page doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
      </div>
      <Link href="/dashboard" className={buttonVariants()}>
        Back to dashboard
      </Link>
    </main>
  );
}

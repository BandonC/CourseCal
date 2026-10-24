import { CalendarCheckIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleIcon } from "@/components/icons/google";
import { MonthPreview } from "@/components/landing/month-preview";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth";
import { getOptionalUser } from "@/lib/auth/session";

// Public sign-in landing — the entry point to the (app) gate. signIn() runs as a
// server action (the v5 pattern); already-authed visitors skip straight in.
// ?deleted=1 is the post-account-deletion return (with an optional orphaned count
// when Calendar events couldn't be removed — proceed-and-warn, §14).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; orphaned?: string }>;
}) {
  if (await getOptionalUser()) {
    redirect("/dashboard");
  }

  const { deleted, orphaned } = await searchParams;
  const justDeleted = deleted === "1";
  const orphanedCount = Number(orphaned);
  const showOrphanWarning = justDeleted && Number.isFinite(orphanedCount) && orphanedCount > 0;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-4 sm:p-6">
      {justDeleted ? (
        <div className="w-full max-w-sm space-y-1 rounded-lg border border-border bg-muted/40 p-4 text-center text-sm">
          <p className="font-medium">Your account and all its data have been deleted.</p>
          {showOrphanWarning ? (
            <p className="text-muted-foreground">
              {`${orphanedCount} calendar ${orphanedCount === 1 ? "event" : "events"} couldn't be removed automatically — you can delete ${orphanedCount === 1 ? "it" : "them"} in Google Calendar.`}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Bento: the month calendar fills the left two columns on desktop; the
          sign-in block and solid color blocks stack beside it. On a phone the
          calendar drops out and the blocks stack, sign-in first. */}
      <div className="grid w-full max-w-sm gap-4 lg:max-w-6xl lg:grid-cols-3 lg:grid-rows-[auto_1fr_auto]">
        <div className="hidden lg:col-span-2 lg:row-span-3 lg:block">
          <MonthPreview />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-md">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarCheckIcon className="size-5" />
            </span>
            <span className="font-heading text-xl font-semibold tracking-tight">Coursecal</span>
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            No password required. First time? Your account is created automatically.
          </p>
          <form
            className="mt-5"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <Button type="submit" size="lg" className="h-11 w-full gap-2">
              <GoogleIcon className="size-4" />
              Continue with Google
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy
            </Link>
            {" · "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms
            </Link>
          </p>
        </div>

        <div className="flex flex-col justify-end rounded-2xl bg-primary p-6 text-primary-foreground shadow-md">
          <p className="font-heading text-3xl font-semibold leading-tight tracking-tight">
            Every deadline, one calendar.
          </p>
          <p className="mt-2 text-sm text-primary-foreground/80">
            Your syllabi, turned into Google Calendar events and a semester timeline.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-chart-5 p-4 text-primary-foreground shadow-md">
            <p className="font-heading text-lg font-semibold leading-snug">Hell weeks flagged early</p>
          </div>
          <div className="rounded-2xl bg-chart-2 p-4 text-primary-foreground shadow-md">
            <p className="font-heading text-lg font-semibold leading-snug">Files stay in your browser</p>
          </div>
        </div>
      </div>
    </main>
  );
}

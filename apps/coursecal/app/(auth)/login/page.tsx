import { CalendarCheckIcon, InfoIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleIcon } from "@/components/icons/google";
import { TimelinePreview } from "@/components/landing/timeline-preview";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
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
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-6">
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
      <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2">
        {/* Desktop-only pitch: fills the empty half with what the app does. On a
            phone the sign-in card stands alone. */}
        <div className="hidden space-y-6 lg:block">
          <Wordmark />
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Your whole semester, at a glance.
            </h1>
            <p className="text-muted-foreground">
              Every graded deadline from your syllabi, in Google Calendar, with your
              hell weeks flagged before they hit.
            </p>
          </div>
          <TimelinePreview />
        </div>

        <div className="mx-auto w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3 text-center lg:hidden">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <CalendarCheckIcon className="size-6" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">Coursecal</h1>
              <p className="text-sm text-muted-foreground">
                Turn your syllabi into a calendar.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-md">
            <h2 className="mb-4 text-center text-lg font-semibold tracking-tight">
              Sign in
            </h2>
            <form
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
            <p className="mt-4 text-center text-sm text-muted-foreground">
              No password required. First time? Your account is created automatically.
            </p>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <p className="flex gap-2">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                Coursecal is invite-only for now, and Google will say it hasn&apos;t
                verified the app. Choose <span className="font-medium">Advanced</span>,
                then continue to Coursecal.
              </span>
            </p>
            <p className="flex gap-2">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                Calendar access is used to add your deadlines. Coursecal only changes
                events it created, and your syllabus files never leave your browser.
              </span>
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy
            </Link>
            {" · "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

import { CalendarCheckIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GoogleIcon } from "@/components/icons/google";
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
    <main className="grid min-h-svh lg:grid-cols-2">
      {/* Brand panel (desktop only): solid primary with a faint calendar grid that
          fades out toward the bottom. currentColor keeps the grid on-token. */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div className="relative flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground text-primary">
            <CalendarCheckIcon className="size-5" />
          </span>
          <span className="font-heading text-xl font-semibold tracking-tight">Coursecal</span>
        </div>
        <div className="relative space-y-3">
          <p className="font-heading text-5xl font-semibold leading-tight tracking-tight">
            Every deadline,
            <br />
            one calendar.
          </p>
          <p className="max-w-sm text-primary-foreground/80">
            Your syllabi, turned into Google Calendar events and a semester timeline.
          </p>
        </div>
      </section>

      <section className="flex flex-col items-center justify-center gap-8 p-6">
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

        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3 text-center lg:hidden">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <CalendarCheckIcon className="size-6" />
            </div>
            <p className="font-heading text-2xl font-semibold tracking-tight">Coursecal</p>
          </div>

          <div className="space-y-1 text-center lg:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">
              No password required. First time? Your account is created automatically.
            </p>
          </div>

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

          <p className="text-center text-xs text-muted-foreground lg:text-left">
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy
            </Link>
            {" · "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              Terms
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

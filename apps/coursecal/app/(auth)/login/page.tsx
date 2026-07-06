import { CalendarCheckIcon } from "lucide-react";
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
      <div className="flex flex-col items-center gap-3 text-center">
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

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-md">
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
    </main>
  );
}

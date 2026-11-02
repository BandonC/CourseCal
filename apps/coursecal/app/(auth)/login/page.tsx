import { redirect } from "next/navigation";
import { SignInBento } from "@/components/landing/sign-in-bento";
import { getOptionalUser } from "@/lib/auth/session";

// Public sign-in route — where the (app) gate sends signed-out visitors. Same
// screen as "/"; already-authed visitors skip straight in.
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
    <SignInBento
      notice={
        justDeleted ? (
          <div className="w-full max-w-sm space-y-1 rounded-lg border border-border bg-muted/40 p-4 text-center text-sm">
            <p className="font-medium">Your account and all its data have been deleted.</p>
            {showOrphanWarning ? (
              <p className="text-muted-foreground">
                {`${orphanedCount} calendar ${orphanedCount === 1 ? "event" : "events"} couldn't be removed automatically — you can delete ${orphanedCount === 1 ? "it" : "them"} in Google Calendar.`}
              </p>
            ) : null}
          </div>
        ) : null
      }
    />
  );
}

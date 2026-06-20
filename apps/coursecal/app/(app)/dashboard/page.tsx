import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { requireUser } from "@/lib/auth/session";

// TEMPORARY placeholder (Phase 3 / chunk 2b) — proves the sign-in loop and the
// (app) gate end to end. The real dashboard (semester list, timeline) is built
// in Phase 5 and replaces this page.
export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm">
        Signed in as <span className="font-medium">{user.email}</span>
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}

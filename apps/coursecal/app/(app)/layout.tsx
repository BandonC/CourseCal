import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { AnalyticsIdentify } from "@/lib/analytics/identify";
import { signOut } from "@/lib/auth";
import { requireUser } from "@/lib/auth/session";

// Gate for every authed route under (app). requireUser() redirects to /login
// when there is no session — this is the enforcement boundary for the whole
// group (middleware is not relied on as the sole guarantee; CLAUDE.md). The
// persistent top nav (wordmark, new-semester, theme toggle, sign out) is the
// app chrome shared by every authed screen.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <>
      <AnalyticsIdentify userId={user.userId} />
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard" aria-label="Coursecal dashboard">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-1.5">
            <Link
              href="/upload"
              aria-label="New semester"
              className={buttonVariants({ size: "sm" })}
            >
              <PlusIcon className="size-4 sm:hidden" />
              <span className="hidden sm:inline">New semester</span>
            </Link>
            <ThemeToggle />
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}

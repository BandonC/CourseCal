import { ArrowRightIcon, CalendarCheckIcon } from "lucide-react";
import Link from "next/link";
import { GetStartedButton } from "@/components/landing/get-started-button";
import { MonthPreview } from "@/components/landing/month-preview";
import { ThemeToggle } from "@/components/theme-toggle";
import { signIn } from "@/lib/auth";

const STEPS = ["Upload your syllabi", "Review what we found", "Export to Google Calendar"];

// The one signed-out screen, shared by "/" and "/login": sign-in up front, with
// enough around it to explain the product to visitors who can't sign in (the app
// is invite-only). signIn() runs as a server action (the v5 pattern). `notice`
// renders above the grid, for the post-account-deletion message on /login.
export function SignInBento({ notice }: { notice?: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-4 sm:p-6">
      {notice}

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
          <h2 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h2>
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
            <GetStartedButton />
          </form>
        </div>

        <div className="flex flex-col justify-end rounded-2xl bg-primary p-6 text-primary-foreground shadow-md">
          <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight">
            Every deadline, one calendar.
          </h1>
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

      <footer className="flex w-full max-w-sm flex-col gap-3 text-sm text-muted-foreground lg:max-w-6xl lg:flex-row lg:items-center lg:justify-between">
        <ol className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-2">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                {i + 1}
              </span>
              {step}
              {i < STEPS.length - 1 ? (
                <ArrowRightIcon className="hidden size-3.5 lg:block" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>
        <div className="flex items-center gap-3">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms
          </Link>
          <ThemeToggle />
        </div>
      </footer>
    </main>
  );
}

import { CalendarCheckIcon, FileUpIcon, ListChecksIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GetStartedButton } from "@/components/landing/get-started-button";
import { TimelinePreview } from "@/components/landing/timeline-preview";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { signIn } from "@/lib/auth";
import { getOptionalUser } from "@/lib/auth/session";

// Public marketing landing (COURSECAL.md §3.1 step 1). Authed visitors skip straight
// to their dashboard; everyone else sees what Coursecal does and a single Google
// sign-in CTA. One static screen — no client state beyond the CTA's analytics capture.
const STEPS = [
  {
    n: "1",
    Icon: FileUpIcon,
    title: "Upload your syllabi",
    body: "Drop in PDFs or paste the text — one per course. Files are read in your browser and never uploaded.",
  },
  {
    n: "2",
    Icon: ListChecksIcon,
    title: "Review what we found",
    body: "Every assignment, quiz, and exam, with anything ambiguous flagged for a quick check and edit.",
  },
  {
    n: "3",
    Icon: CalendarCheckIcon,
    title: "Export and plan",
    body: "Send it to Google Calendar and see your term on a timeline with hell weeks and deadline clusters flagged.",
  },
];

export default async function RootPage() {
  if (await getOptionalUser()) redirect("/dashboard");

  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <Wordmark />
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/dashboard" });
              }}
            >
              <Button type="submit" variant="ghost" size="sm">
                Sign in
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-4 pb-20 pt-12 lg:pt-20">
        <section className="grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-6 text-center lg:text-left">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Your whole semester, planned in minutes.
            </h1>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground lg:mx-0">
              Coursecal reads your course syllabi and turns every assignment, quiz, and
              exam into a Google Calendar you can trust — plus a timeline that flags your
              hell weeks before they hit.
            </p>
            <div className="flex justify-center lg:justify-start">
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: "/dashboard" });
                }}
              >
                <GetStartedButton />
              </form>
            </div>
          </div>

          <TimelinePreview />
        </section>

      <section className="grid gap-5 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-xs transition-shadow hover:shadow-sm"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
              <s.Icon className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Step {s.n}
              </p>
              <h2 className="font-medium">{s.title}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Coursecal</span>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </div>
      </footer>
    </>
  );
}

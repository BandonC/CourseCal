import { redirect } from "next/navigation";
import { GetStartedButton } from "@/components/landing/get-started-button";
import { signIn } from "@/lib/auth";
import { getOptionalUser } from "@/lib/auth/session";

// Public marketing landing (COURSECAL.md §3.1 step 1). Authed visitors skip straight
// to their dashboard; everyone else sees what Coursecal does and a single Google
// sign-in CTA. One static screen — no client state beyond the CTA's analytics capture.
const STEPS = [
  {
    n: "1",
    title: "Upload your syllabi",
    body: "Drop in PDFs or paste the text — one per course. Files are read in your browser and never uploaded.",
  },
  {
    n: "2",
    title: "Review what we found",
    body: "Every assignment, quiz, and exam, with anything ambiguous flagged for a quick check and edit.",
  },
  {
    n: "3",
    title: "Export and plan",
    body: "Send it to Google Calendar and see your term on a timeline with hell weeks and deadline clusters flagged.",
  },
];

export default async function RootPage() {
  if (await getOptionalUser()) redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-16 px-4 py-16">
      <section className="space-y-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Your whole semester, planned in minutes.
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          Coursecal reads your course syllabi and turns every assignment, quiz, and exam
          into a Google Calendar you can trust — plus a timeline that flags your hell weeks
          before they hit.
        </p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <GetStartedButton />
        </form>
      </section>

      <section className="grid gap-6 sm:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="space-y-2 rounded-lg border border-border p-5">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {s.n}
            </span>
            <h2 className="font-medium">{s.title}</h2>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

import { BackLink } from "@/components/back-link";
import { SyllabusFlow } from "@/components/parsing/syllabus-flow";

// LLM parses take 10–60s; the parse action runs under this route segment, so the
// segment must lift the timeout (apps/coursecal/CLAUDE.md performance). Verified
// 2026-06-14: with Fluid compute (default-on) Hobby now allows up to 300s, so 60
// is a deliberate conservative cap — a single parse exceeding 60s is treated as a
// failure rather than left to run. Gated by the (app) layout.
export const maxDuration = 60;

export default function UploadPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
      <BackLink href="/dashboard">Back to dashboard</BackLink>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">New semester</h1>
        <p className="text-muted-foreground">
          Name your semester, add a syllabus for each course (upload PDFs or paste text),
          review what we found, then export it all to your calendar.
        </p>
      </header>
      <SyllabusFlow />
    </main>
  );
}

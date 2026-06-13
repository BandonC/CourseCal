export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Coursecal
      </h1>
      <p className="max-w-prose text-lg text-foreground/70">
        Turn course syllabi into calendar events and a navigable semester plan.
      </p>
      <p className="text-sm text-foreground/50">Phase 0 scaffold — nothing wired up yet.</p>
    </main>
  );
}

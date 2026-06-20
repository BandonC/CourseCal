// Timeline course colors (§7.1 — courses.color "for timeline"). These reuse the
// sanctioned shadcn chart tokens from globals.css rather than introducing new
// color values (apps/coursecal/CLAUDE.md styling rule). Stored as CSS var refs so
// the Phase-4 timeline can apply them directly. Phase 3 has one course per
// semester → index 0; Phase 4 distributes distinct colors across courses.
export const COURSE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function courseColorForIndex(index: number): string {
  return COURSE_COLORS[index % COURSE_COLORS.length]!;
}

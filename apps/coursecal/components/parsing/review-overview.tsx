"use client";

import { useEffect, useState } from "react";
import type { ParseResult } from "@coursecal/syllabus-parser";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/lib/analytics/use-analytics";
import { ReviewStep } from "./review-step";
import type { ParsedCourse } from "./types";

// Whole-semester review (Option B): a course list with per-course "to check" counts
// (low/medium-confidence items, §8.3), editable in any order. Clicking Edit opens
// that one course in the existing ReviewStep — each course is still its own
// isolated form, so ReviewStep/DeliverableRow are reused unchanged. When nothing is
// flagged the user can skip straight to export.
function toCheckCount(result: ParseResult): number {
  return result.deliverables.filter((d) => d.confidence !== "high").length;
}

export function ReviewOverview({
  courses,
  onConfirm,
  onRestart,
}: {
  courses: ParsedCourse[];
  onConfirm: (courses: ParsedCourse[]) => void;
  onRestart: () => void;
}) {
  const { capture } = useAnalytics();
  const [working, setWorking] = useState(courses);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fired once when the review step is first shown (not on each edit open/close).
  useEffect(() => {
    capture({
      name: "review_reached",
      properties: {
        course_count: courses.length,
        to_check_count: courses.reduce((sum, c) => sum + toCheckCount(c.result), 0),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editing = working.find((c) => c.sourceId === editingId) ?? null;

  if (editing) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Editing {editing.label}</p>
        <ReviewStep
          key={editing.sourceId}
          result={editing.result}
          confirmLabel="Save course"
          cancelLabel="Cancel"
          onConfirm={(edited) => {
            setWorking((prev) =>
              prev.map((c) =>
                c.sourceId === editing.sourceId ? { ...c, result: edited } : c,
              ),
            );
            setEditingId(null);
          }}
          onRestart={() => setEditingId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">
        Review your semester{" "}
        <span className="text-muted-foreground">
          ({working.length} {working.length === 1 ? "course" : "courses"})
        </span>
      </h2>

      <ul className="space-y-2">
        {working.map((c) => {
          const toCheck = toCheckCount(c.result);
          return (
            <li
              key={c.sourceId}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{c.result.course.name}</p>
                <p className="text-sm text-muted-foreground">
                  {c.result.deliverables.length} deliverable
                  {c.result.deliverables.length === 1 ? "" : "s"}
                  {toCheck > 0 ? (
                    <span className="text-destructive"> · {toCheck} to check</span>
                  ) : null}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditingId(c.sourceId)}>
                Edit
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => onConfirm(working)}>Looks good → export</Button>
        <Button variant="outline" onClick={onRestart}>
          Start over
        </Button>
      </div>
    </div>
  );
}

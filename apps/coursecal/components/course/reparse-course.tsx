"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ParseResult } from "@coursecal/syllabus-parser";
import { replaceCourseDeliverablesAction } from "@/app/(app)/course/[id]/actions";
import { reparseCourseAction } from "@/app/(app)/upload/actions";
import { ReviewStep } from "@/components/parsing/review-step";
import { Button } from "@/components/ui/button";

// Re-parse replacement flow (§7.1): re-parse the course's stored syllabus, review
// the fresh result in the shared ReviewStep, then replace all of the course's
// deliverables on confirm. On success router.refresh() reloads the page (the page
// keys the list on its ids, so it remounts with the new rows; the new rows are
// unsynced, so "Sync to Calendar" reappears).
type Phase =
  | { name: "idle" }
  | { name: "parsing" }
  | { name: "review"; result: ParseResult }
  | { name: "replacing"; result: ParseResult };

export function ReparseCourse({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  async function start() {
    setPhase({ name: "parsing" });
    const res = await reparseCourseAction(courseId);
    if (!res.ok) {
      toast.error(res.error);
      setPhase({ name: "idle" });
      return;
    }
    setPhase({ name: "review", result: res.data });
  }

  async function confirm(result: ParseResult) {
    setPhase({ name: "replacing", result });
    const res = await replaceCourseDeliverablesAction(courseId, result);
    if (!res.ok) {
      toast.error(res.error);
      setPhase({ name: "review", result });
      return;
    }
    if (res.data.reconnectNeeded) {
      toast.warning("Reconnect Google Calendar to re-parse — its events couldn't be updated.", {
        action: { label: "Reconnect", onClick: () => router.push("/reconnect") },
      });
      setPhase({ name: "review", result });
      return;
    }
    setPhase({ name: "idle" });
    router.refresh();
  }

  if (phase.name === "review" || phase.name === "replacing") {
    return (
      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">
          Re-parsed from the saved syllabus. Review and confirm — this replaces every
          current deliverable for this course.
        </p>
        <ReviewStep
          result={phase.result}
          onConfirm={confirm}
          onRestart={() => setPhase({ name: "idle" })}
          confirmLabel="Replace deliverables"
          cancelLabel="Cancel"
          showCourse={false}
        />
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={start}
      loading={phase.name === "parsing"}
    >
      {phase.name === "parsing" ? "Re-parsing…" : "Re-parse syllabus"}
    </Button>
  );
}

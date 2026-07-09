"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { exportCourseToCalendarAction } from "@/app/(app)/course/[id]/actions";
import { Button } from "@/components/ui/button";

// Resume the Calendar export for a course that has dated, not-yet-synced
// deliverables (saved-but-unsynced path). On success router.refresh() re-reads the
// page so the count disappears once everything is synced.
export function SyncCourseButton({
  courseId,
  count,
}: {
  courseId: string;
  count: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const onClick = async () => {
    setPending(true);
    try {
      const res = await exportCourseToCalendarAction(courseId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const { created, failed, reconnectNeeded } = res.data;
      if (reconnectNeeded) {
        toast.warning("Reconnect Google Calendar to sync.", {
          action: { label: "Reconnect", onClick: () => router.push("/reconnect") },
        });
      } else if (failed > 0) {
        toast.warning(`Synced ${created}; ${failed} couldn't be added.`);
      } else {
        toast.success(`Synced ${created} to Calendar`);
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <Button size="sm" onClick={onClick} loading={pending}>
      Sync {count} to Calendar
    </Button>
  );
}

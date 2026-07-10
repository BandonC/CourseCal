"use client";

import { useRouter } from "next/navigation";
import { TypeToConfirmDialog } from "@/components/delete/type-to-confirm-dialog";
import { notifyDelete } from "@/components/delete/notify-delete";
import { Button } from "@/components/ui/button";
import { deleteCourseAction } from "@/lib/actions/deletes";

export function DeleteCourseButton({
  courseId,
  courseLabel,
  semesterId,
}: {
  courseId: string;
  courseLabel: string;
  semesterId: string;
}) {
  const router = useRouter();

  const onConfirm = async () => {
    const res = await deleteCourseAction(courseId);
    if (notifyDelete(res, () => router.push("/reconnect"))) {
      router.push(`/semester/${semesterId}`);
    }
  };

  return (
    <TypeToConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          Delete course
        </Button>
      }
      title="Delete course"
      description={`This permanently deletes "${courseLabel}", all its deliverables, and their Google Calendar events. This can't be undone.`}
      confirmPhrase={courseLabel}
      onConfirm={onConfirm}
    />
  );
}

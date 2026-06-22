"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyDelete } from "@/components/delete/notify-delete";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import { deleteDeliverableAction, deleteSeriesAction, type DeleteResult } from "@/lib/actions/deletes";

// Delete guard for a single deliverable (simple confirm) or, when the row belongs
// to a recurring series, a count-confirm that also offers deleting the whole
// series (§7.3). Calls onRemove with the ids that left the DB so the list updates
// without a full refetch.
export function DeleteDeliverableDialog({
  deliverableId,
  title,
  courseId,
  seriesId,
  seriesCount,
  siblingIds,
  onRemove,
}: {
  deliverableId: string;
  title: string;
  courseId: string;
  seriesId: string | null;
  seriesCount: number;
  siblingIds: string[];
  onRemove: (ids: string[]) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const run = async (
    fn: () => Promise<ActionResult<DeleteResult>>,
    ids: string[],
    message: string,
  ) => {
    setPending(true);
    try {
      const res = await fn();
      if (notifyDelete(res, message, () => router.push("/reconnect"))) {
        onRemove(ids);
      }
    } finally {
      setPending(false);
      setOpen(false);
    }
  };

  const deleteOne = () =>
    run(() => deleteDeliverableAction(deliverableId), [deliverableId], "Deliverable deleted");

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="sm">
            Delete
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete deliverable</AlertDialogTitle>
          <AlertDialogDescription>
            {seriesId
              ? `"${title}" is one of ${seriesCount} in a recurring series.`
              : `This permanently deletes "${title}" and its calendar event. This can't be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {seriesId ? (
            <>
              <Button variant="outline" disabled={pending} onClick={deleteOne}>
                Delete this one
              </Button>
              <AlertDialogAction
                variant="destructive"
                disabled={pending}
                onClick={() =>
                  run(
                    () => deleteSeriesAction(courseId, seriesId),
                    siblingIds,
                    `Deleted ${seriesCount} deliverables`,
                  )
                }
              >
                Delete all {seriesCount}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction variant="destructive" disabled={pending} onClick={deleteOne}>
              Delete
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

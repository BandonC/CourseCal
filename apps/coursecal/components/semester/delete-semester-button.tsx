"use client";

import { useRouter } from "next/navigation";
import { TypeToConfirmDialog } from "@/components/delete/type-to-confirm-dialog";
import { notifyDelete } from "@/components/delete/notify-delete";
import { Button } from "@/components/ui/button";
import { deleteSemesterAction } from "@/lib/actions/deletes";

export function DeleteSemesterButton({
  semesterId,
  semesterName,
}: {
  semesterId: string;
  semesterName: string;
}) {
  const router = useRouter();

  const onConfirm = async () => {
    const res = await deleteSemesterAction(semesterId);
    if (notifyDelete(res, "Semester deleted", () => router.push("/reconnect"))) {
      router.refresh();
    }
  };

  return (
    <TypeToConfirmDialog
      trigger={
        <Button variant="ghost" size="sm">
          Delete
        </Button>
      }
      title="Delete semester"
      description={`This permanently deletes "${semesterName}", every course and deliverable in it, and their Google Calendar events. This can't be undone.`}
      confirmPhrase={semesterName}
      onConfirm={onConfirm}
    />
  );
}

"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Type-to-confirm guard for the high blast-radius deletes — semesters and courses
// (§7.3). The confirm button stays disabled until the user types the exact phrase
// (the semester/course name). The dialog owns open + pending state because Base
// UI's AlertDialogAction doesn't auto-close; onConfirm runs the action and the
// dialog closes when it resolves.
export function TypeToConfirmDialog({
  trigger,
  title,
  description,
  confirmPhrase,
  confirmLabel = "Delete",
  onConfirm,
}: {
  trigger: React.ReactElement;
  title: string;
  description: React.ReactNode;
  confirmPhrase: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const matches = typed.trim() === confirmPhrase;

  const handleConfirm = async () => {
    if (!matches || pending) return;
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
      setTyped("");
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTyped("");
      }}
    >
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-phrase">
            Type <span className="font-medium text-foreground">{confirmPhrase}</span> to confirm
          </Label>
          <Input
            id="confirm-phrase"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!matches || pending}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

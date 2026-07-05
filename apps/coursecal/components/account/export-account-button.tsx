"use client";

import { useState } from "react";
import { toast } from "sonner";
import { exportAccountAction } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";

// Downloads the user's data as a JSON file. The server action returns the JSON
// string; the browser turns it into a Blob download (no GET route handler needed).
export function ExportAccountButton() {
  const [pending, setPending] = useState(false);

  const onExport = async () => {
    if (pending) return;
    setPending(true);
    try {
      const res = await exportAccountAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const blob = new Blob([res.data.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = res.data.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Your data has been downloaded.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant="outline" onClick={onExport} disabled={pending}>
      {pending ? "Preparing…" : "Download my data"}
    </Button>
  );
}

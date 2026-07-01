import { CalendarCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// The Coursecal brand mark — icon tile + wordmark. Shared by the public header,
// the login screen, and the authed app nav so identity is consistent everywhere.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <CalendarCheckIcon className="size-4" />
      </span>
      <span className="font-heading text-lg font-semibold tracking-tight">
        Coursecal
      </span>
    </span>
  );
}

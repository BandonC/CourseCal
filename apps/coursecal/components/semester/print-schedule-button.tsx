"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/lib/analytics/use-analytics";

// Triggers the browser's print dialog, which renders the print-only
// SemesterSchedule (everything else is print:hidden) and lets the user Save as PDF.
export function PrintScheduleButton({ courseCount }: { courseCount: number }) {
  const { capture } = useAnalytics();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        capture({ name: "schedule_printed", properties: { course_count: courseCount } });
        window.print();
      }}
    >
      <PrinterIcon className="size-4" />
      Print schedule
    </Button>
  );
}

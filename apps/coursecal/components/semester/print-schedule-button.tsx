"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalytics } from "@/lib/analytics/use-analytics";

// Triggers the browser's print dialog, which renders the print-only
// SemesterSchedule (everything else is print:hidden) and lets the user Save as PDF.
export function PrintScheduleButton({
  semesterName,
  courseCount,
}: {
  semesterName: string;
  courseCount: number;
}) {
  const { capture } = useAnalytics();

  function print() {
    capture({ name: "schedule_printed", properties: { course_count: courseCount } });
    // Save-as-PDF names the file after document.title — set it to the semester so
    // downloads are distinguishable ("Coursecal Fall 2025.pdf"), then restore it.
    const previous = document.title;
    document.title = `Coursecal ${semesterName}`;
    const restore = () => {
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }

  return (
    <Button variant="outline" size="sm" onClick={print}>
      <PrinterIcon className="size-4" />
      Print schedule
    </Button>
  );
}

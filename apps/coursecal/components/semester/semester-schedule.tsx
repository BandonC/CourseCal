import type { SemesterTimelineData } from "@/lib/db/queries/semesters";

// Print-only per-semester schedule (§3b — human-readable "doc" export). Renders
// nothing on screen (`hidden`), appearing only in the browser's print / Save-as-PDF
// output, which produces the PDF — no generation dependency. Explicit black/gray
// colors so it reads on white regardless of the app theme (browsers drop
// backgrounds when printing). The JSON account export stays the portability format;
// this is the readable one.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ISO YYYY-MM-DD → "Sep 15, 2026", parsed from the parts so it never shifts by a
// timezone (a due date is a calendar day, not an instant).
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type Course = SemesterTimelineData["courses"][number];
type Deliverable = Course["deliverables"][number];

// Dated items first, chronological (then by time); dateless items last.
function sortDeliverables(ds: Deliverable[]): Deliverable[] {
  return [...ds].sort((a, b) => {
    if (a.dueDate === null && b.dueDate === null) return a.title.localeCompare(b.title);
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? "").localeCompare(b.dueTime ?? "");
  });
}

export function SemesterSchedule({ data }: { data: SemesterTimelineData }) {
  return (
    <div className="hidden text-black print:block">
      <h1 className="text-2xl font-semibold">{data.name}</h1>
      <p className="mb-6 text-sm text-gray-600">
        {formatDate(data.startDate)} – {formatDate(data.endDate)}
      </p>

      {data.courses.map((course) => (
        <section key={course.id} className="mb-6 break-inside-avoid">
          <h2 className="mb-1 text-lg font-medium">
            {course.code ? `${course.code} · ` : ""}
            {course.name}
          </h2>
          {course.deliverables.length === 0 ? (
            <p className="text-sm text-gray-600">No deliverables.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-400 text-left">
                  <th className="py-1 pr-3 font-medium">Due</th>
                  <th className="py-1 pr-3 font-medium">Deliverable</th>
                  <th className="py-1 pr-3 font-medium">Type</th>
                  <th className="py-1 font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                {sortDeliverables(course.deliverables).map((d) => (
                  <tr key={d.id} className="border-b border-gray-200">
                    <td className="py-1 pr-3 whitespace-nowrap">
                      {d.dueDate ? formatDate(d.dueDate) : "—"}
                      {d.dueTime ? ` ${d.dueTime.slice(0, 5)}` : ""}
                    </td>
                    <td className="py-1 pr-3">{d.title}</td>
                    <td className="py-1 pr-3">{capitalize(d.type)}</td>
                    <td className="py-1">
                      {d.weightPercent !== null ? `${Number(d.weightPercent)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}

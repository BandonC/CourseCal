import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { resolveRelativeDate } from "../src/dates";

const MS_PER_DAY = 86_400_000;
const EPOCH = Date.UTC(2026, 0, 1);
const isoAt = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

describe("resolveRelativeDate — properties (§12.3)", () => {
  it("'Week N' is exactly N-1 weeks after start and within bounds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300 }), // start offset from EPOCH, in days
        fc.integer({ min: 8, max: 16 }), // semester length in weeks
        (startOffset, weeks) => {
          const startMs = EPOCH + startOffset * MS_PER_DAY;
          const semesterStart = isoAt(startMs);
          const semesterEnd = isoAt(startMs + weeks * 7 * MS_PER_DAY);
          for (let n = 1; n <= weeks; n++) {
            const r = resolveRelativeDate(`Week ${n}`, {
              semesterStart,
              semesterEnd,
            });
            expect(r.ok).toBe(true);
            if (r.ok) {
              expect(r.data).toBe(isoAt(startMs + (n - 1) * 7 * MS_PER_DAY));
              expect(r.data >= semesterStart && r.data <= semesterEnd).toBe(
                true,
              );
            }
          }
        },
      ),
    );
  });

  it("is idempotent on an in-bounds absolute date", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120 }),
        fc.integer({ min: 0, max: 200 }),
        (startOffset, dayInto) => {
          const startMs = EPOCH + startOffset * MS_PER_DAY;
          const semesterStart = isoAt(startMs);
          const semesterEnd = isoAt(startMs + 200 * MS_PER_DAY);
          const target = isoAt(startMs + dayInto * MS_PER_DAY);
          const r = resolveRelativeDate(target, { semesterStart, semesterEnd });
          expect(r.ok).toBe(true);
          if (r.ok) expect(r.data).toBe(target);
        },
      ),
    );
  });

  it("'Monday of Week N' always lands on a Monday within bounds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 8, max: 16 }),
        (startOffset, weeks) => {
          const startMs = EPOCH + startOffset * MS_PER_DAY;
          const semesterStart = isoAt(startMs);
          const semesterEnd = isoAt(startMs + (weeks + 1) * 7 * MS_PER_DAY);
          // Week 2..weeks: the Monday grid is always on/after start for these.
          for (let n = 2; n <= weeks; n++) {
            const r = resolveRelativeDate(`Monday of Week ${n}`, {
              semesterStart,
              semesterEnd,
            });
            expect(r.ok).toBe(true);
            if (r.ok) {
              expect(new Date(`${r.data}T00:00:00.000Z`).getUTCDay()).toBe(1);
              expect(r.data >= semesterStart && r.data <= semesterEnd).toBe(
                true,
              );
            }
          }
        },
      ),
    );
  });
});

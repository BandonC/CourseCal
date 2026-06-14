import { describe, it, expect } from "vitest";
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  renderUserContent,
  buildPrompt,
} from "../src/prompts";

const ctx = {
  semesterStart: "2026-09-07",
  semesterEnd: "2026-12-07",
  today: "2026-09-01",
  timezone: "America/Toronto",
};

describe("SYSTEM_PROMPT — injection posture and contract", () => {
  it("declares the syllabus untrusted data inside a fence", () => {
    expect(SYSTEM_PROMPT).toContain("<syllabus>");
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("untrusted");
    expect(SYSTEM_PROMPT.toLowerCase()).toContain("never follow");
  });

  it("targets the extract_syllabus tool and names the date fields", () => {
    expect(SYSTEM_PROMPT).toContain("extract_syllabus");
    expect(SYSTEM_PROMPT).toContain("due_date_expression");
  });
});

describe("renderUserContent", () => {
  it("fences the syllabus text and includes the semester context", () => {
    const user = renderUserContent(ctx, "CS 348 — Databases\nMidterm: Oct 20");
    expect(user).toContain(
      "<syllabus>\nCS 348 — Databases\nMidterm: Oct 20\n</syllabus>",
    );
    expect(user).toContain("semester_start: 2026-09-07");
    expect(user).toContain("semester_end: 2026-12-07");
    expect(user).toContain("today: 2026-09-01");
  });

  it("includes reading weeks and holidays when supplied", () => {
    const user = renderUserContent(
      {
        ...ctx,
        readingWeeks: [{ start: "2026-10-12", end: "2026-10-16" }],
        holidays: ["2026-10-12"],
      },
      "syllabus",
    );
    expect(user).toContain("reading_weeks: 2026-10-12..2026-10-16");
    expect(user).toContain("holidays: 2026-10-12");
  });

  it("omits optional context lines when absent", () => {
    const user = renderUserContent(
      {
        semesterStart: "2026-09-07",
        semesterEnd: "2026-12-07",
        today: "2026-09-01",
      },
      "syllabus",
    );
    expect(user).not.toContain("timezone:");
    expect(user).not.toContain("reading_weeks:");
    expect(user).not.toContain("holidays:");
  });
});

describe("buildPrompt", () => {
  it("assembles version, system, and user", () => {
    const p = buildPrompt(ctx, "syllabus body");
    expect(p.version).toBe(PROMPT_VERSION);
    expect(p.version).toBe("v1");
    expect(p.system).toBe(SYSTEM_PROMPT);
    expect(p.user).toContain("<syllabus>\nsyllabus body\n</syllabus>");
  });
});

import type { ParseResult } from "@coursecal/syllabus-parser";

// Shared shapes for the multi-syllabus upload flow (setup → parse queue → review →
// export). A Source is something the user added before parsing; a ParsedCourse is
// the library output for one source, carried through review into the save.

export type Source =
  | { id: string; kind: "pdf"; label: string; file: File }
  | { id: string; kind: "docx"; label: string; file: File }
  | { id: string; kind: "paste"; label: string; text: string };

export type ParsedCourse = {
  sourceId: string;
  label: string; // file name or paste label, for display
  result: ParseResult;
  syllabusText: string; // courses.original_syllabus_text is NOT NULL (§7.1)
};

export type Semester = { name: string; start: string; end: string };

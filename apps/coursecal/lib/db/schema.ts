// Drizzle schema — the canonical DB shape (COURSECAL.md §7). The two pg enums
// are sourced from the syllabus-parser library's Zod enums so the DB can't drift
// from the parser contract. UUID ids are branded (see ids.ts) so they aren't
// interchangeable. Indexes per §7.2. FKs cascade per §7.3 (deleting a semester
// removes its courses + deliverables).
//
// Schema changes need explicit approval + a generated migration (CLAUDE.md).

import {
  type Confidence,
  ConfidenceSchema,
  type DeliverableType,
  DeliverableTypeSchema,
} from "@coursecal/syllabus-parser";
import { relations } from "drizzle-orm";
import {
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  CourseId,
  DeliverableId,
  SemesterId,
  SeriesId,
  UserId,
} from "./ids";

// Single source of truth: the parser's Zod enums supply the DB enum values.
// `.options` is typed as a plain array; narrow to the non-empty tuple pgEnum
// wants while preserving the literal union (a Zod enum always has ≥1 option).
export const deliverableType = pgEnum(
  "deliverable_type",
  DeliverableTypeSchema.options as [DeliverableType, ...DeliverableType[]],
);
export const confidence = pgEnum(
  "confidence",
  ConfidenceSchema.options as [Confidence, ...Confidence[]],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").$type<UserId>().primaryKey().defaultRandom(),
    googleId: text("google_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    imageUrl: text("image_url"),
    timezone: text("timezone").notNull().default("America/Toronto"),
    // Encrypted at rest (AES-256-GCM, ADR-008). Null until first consent
    // persists it; never logged, never returned to the client.
    encryptedRefreshToken: text("encrypted_refresh_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_google_id_idx").on(t.googleId)],
);

export const semesters = pgTable(
  "semesters",
  {
    id: uuid("id").$type<SemesterId>().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .$type<UserId>()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("semesters_user_id_idx").on(t.userId)],
);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").$type<CourseId>().primaryKey().defaultRandom(),
    semesterId: uuid("semester_id")
      .$type<SemesterId>()
      .notNull()
      .references(() => semesters.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code"),
    instructor: text("instructor"),
    color: text("color").notNull(),
    originalSyllabusText: text("original_syllabus_text").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("courses_semester_id_idx").on(t.semesterId)],
);

export const deliverables = pgTable(
  "deliverables",
  {
    id: uuid("id").$type<DeliverableId>().primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .$type<CourseId>()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: deliverableType("type").notNull(),
    // Null for dateless items (e.g. participation) — they count toward weight
    // totals but skip calendar export and weekly workload sums (§7.1).
    dueDate: date("due_date"),
    dueTime: time("due_time"),
    weightPercent: numeric("weight_percent", { precision: 5, scale: 2 }),
    notes: text("notes"),
    confidence: confidence("confidence").notNull(),
    ambiguityReason: text("ambiguity_reason"),
    googleEventId: text("google_event_id"),
    // Shared by all rows expanded from one recurring descriptor; null for
    // one-offs (§7.1). Not an FK — it's a grouping key, not a row reference.
    seriesId: uuid("series_id").$type<SeriesId>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deliverables_course_id_idx").on(t.courseId),
    index("deliverables_due_date_idx").on(t.dueDate),
  ],
);

// Relations for the Drizzle relational query API (db.query.*).
export const usersRelations = relations(users, ({ many }) => ({
  semesters: many(semesters),
}));

export const semestersRelations = relations(semesters, ({ one, many }) => ({
  user: one(users, { fields: [semesters.userId], references: [users.id] }),
  courses: many(courses),
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  semester: one(semesters, {
    fields: [courses.semesterId],
    references: [semesters.id],
  }),
  deliverables: many(deliverables),
}));

export const deliverablesRelations = relations(deliverables, ({ one }) => ({
  course: one(courses, {
    fields: [deliverables.courseId],
    references: [courses.id],
  }),
}));

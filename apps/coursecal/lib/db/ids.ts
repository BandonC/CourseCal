// Branded UUID identifiers (root CLAUDE.md). All four are `string` at runtime,
// but the brand makes them non-interchangeable at the type level — passing a
// CourseId where a UserId is expected is a compile error. The brands are applied
// to the Drizzle columns via `.$type<…>()` in schema.ts, so query results and
// inserts carry them automatically.

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, "UserId">;
export type SemesterId = Brand<string, "SemesterId">;
export type CourseId = Brand<string, "CourseId">;
export type DeliverableId = Brand<string, "DeliverableId">;

/** A recurring series share a freshly generated id (§7.1); null for one-offs. */
export type SeriesId = Brand<string, "SeriesId">;

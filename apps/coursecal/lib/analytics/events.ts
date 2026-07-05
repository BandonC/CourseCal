// The PostHog event taxonomy as a typed contract (Phase 7). Names are snake_case
// verbs. No event carries PII — never an email, name, syllabus/course/deliverable
// title, date value, weight, or token. Counts and bucketed sizes only. The
// distinct_id is always the user's UUID (set via identify on the client; passed
// explicitly to captureServer on the server). Client-intent events fire from the
// browser (posthog-js); server-authoritative outcomes fire via posthog-node so the
// client can't forge them. See COURSECAL.md §3 for the flows these map to.
//
// This module is the single source of truth for the taxonomy. It is environment-
// agnostic (no server-only / client-only imports) so both sides share these types.

export type CharCountBucket = "<5k" | "5-20k" | "20-50k" | "50k+";

export type ParseTrigger = "upload" | "reparse";

export type DeliverableField =
  | "title"
  | "type"
  | "due_date"
  | "due_time"
  | "weight"
  | "notes";

export type AnalyticsEvent =
  // Parse flow
  | {
      name: "syllabus_uploaded";
      properties: {
        input_method: "pdf" | "docx" | "paste";
        char_count_bucket: CharCountBucket;
        is_add_to_existing: boolean;
      };
    }
  | {
      name: "syllabus_parse_succeeded";
      properties: {
        deliverable_count: number;
        low_confidence_count: number;
        medium_confidence_count: number;
        has_recurrence: boolean;
        trigger: ParseTrigger;
      };
    }
  | {
      name: "syllabus_parse_failed";
      properties: { error_kind: string; trigger: ParseTrigger };
    }
  // Review flow
  | {
      name: "review_reached";
      properties: { course_count: number; to_check_count: number };
    }
  | {
      name: "deliverable_edited";
      properties: { field: DeliverableField; context: "review" | "course_detail" };
    }
  // Save + export flow
  | {
      name: "export_to_calendar_clicked";
      properties: {
        course_count: number;
        dated_deliverable_count: number;
        is_add_to_existing: boolean;
      };
    }
  | {
      name: "semester_saved";
      properties: {
        course_count: number;
        deliverable_count: number;
        is_add_to_existing: boolean;
      };
    }
  | {
      name: "calendar_export_completed";
      properties: { created: number; failed: number; reconnect_needed: boolean };
    }
  | { name: "ics_downloaded"; properties: { course_count: number } }
  | { name: "schedule_printed"; properties: { course_count: number } }
  // Edit + sync flow (course detail) — outcome is the server's own EditCalendarOutcome
  | {
      name: "deliverable_calendar_synced";
      properties: {
        outcome:
          | "patched"
          | "created"
          | "recreated"
          | "deleted"
          | "none"
          | "failed"
          | "skipped";
      };
    }
  // Delete flow (tiered, §7.3) — distinct events for funnel clarity. Fired server-side
  // only on a successful delete; event_count is the number of Calendar events the
  // cascade removed (cheap, authoritative, non-PII). A blocked delete fires nothing
  // here — that path is visible through reconnect_initiated instead.
  | { name: "semester_deleted"; properties: { event_count: number } }
  | { name: "course_deleted"; properties: { event_count: number } }
  | {
      name: "deliverable_deleted";
      properties: { is_series: boolean; event_count: number };
    }
  // Reconnect flow
  | { name: "reconnect_initiated"; properties?: Record<string, never> }
  // Conflict-view (timeline)
  | {
      name: "timeline_viewed";
      properties: {
        course_count: number;
        deliverable_count: number;
        heavy_week_count: number;
        cluster_count: number;
      };
    }
  // Onboarding (marketing landing — one CTA, no checklist)
  | { name: "get_started_clicked"; properties?: Record<string, never> };

export type AnalyticsEventName = AnalyticsEvent["name"];

// Bucket a character count into a non-PII size band (never log the raw length of
// syllabus text). Used at the upload seam.
export function bucketCharCount(length: number): CharCountBucket {
  if (length < 5_000) return "<5k";
  if (length < 20_000) return "5-20k";
  if (length < 50_000) return "20-50k";
  return "50k+";
}

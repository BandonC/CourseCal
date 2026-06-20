CREATE TYPE "public"."confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."deliverable_type" AS ENUM('assignment', 'exam', 'quiz', 'project', 'reading', 'presentation', 'participation', 'other');--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"semester_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"instructor" text,
	"color" text NOT NULL,
	"original_syllabus_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "deliverable_type" NOT NULL,
	"due_date" date,
	"due_time" time,
	"weight_percent" numeric(5, 2),
	"notes" text,
	"confidence" "confidence" NOT NULL,
	"ambiguity_reason" text,
	"google_event_id" text,
	"series_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semesters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image_url" text,
	"timezone" text DEFAULT 'America/Toronto' NOT NULL,
	"encrypted_refresh_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_semester_id_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courses_semester_id_idx" ON "courses" USING btree ("semester_id");--> statement-breakpoint
CREATE INDEX "deliverables_course_id_idx" ON "deliverables" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "deliverables_due_date_idx" ON "deliverables" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "semesters_user_id_idx" ON "semesters" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_google_id_idx" ON "users" USING btree ("google_id");
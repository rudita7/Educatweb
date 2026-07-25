CREATE TABLE "submission_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"submission_id" integer NOT NULL,
	"avg_words_per_slide" double precision,
	"avg_bullets_per_slide" double precision,
	"image_to_text_ratio" double precision,
	"distinct_font_count" integer,
	"slide_count" integer,
	"parse_status" text NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "submission_metrics_submission_id_unique" UNIQUE("submission_id")
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "tracked_metrics" jsonb;--> statement-breakpoint
ALTER TABLE "submission_metrics" ADD CONSTRAINT "submission_metrics_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;
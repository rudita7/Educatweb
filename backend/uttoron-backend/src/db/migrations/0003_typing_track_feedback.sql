CREATE TABLE "typing_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"result_id" integer NOT NULL,
	"reviewer_id" integer NOT NULL,
	"tag_ids" jsonb NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "typing_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"checkpoint_id" text NOT NULL,
	"wpm" double precision NOT NULL,
	"accuracy" double precision NOT NULL,
	"error_count" integer NOT NULL,
	"duration_seconds" double precision NOT NULL,
	"text_length" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "typing_feedback" ADD CONSTRAINT "typing_feedback_result_id_typing_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."typing_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "typing_feedback" ADD CONSTRAINT "typing_feedback_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "typing_results" ADD CONSTRAINT "typing_results_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
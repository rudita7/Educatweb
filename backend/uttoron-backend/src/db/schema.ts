import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex, doublePrecision, type AnyPgColumn } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  pin: text('pin').notNull(), // Hashed PIN
  role: text('role').notNull().default('student'), // 'student' | 'reviewer' — spec explicitly descopes multiple reviewer tiers, so this is a flat flag, not a permissions table
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const progress = pgTable('progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  trackId: text('track_id').notNull(), // e.g., 'data-entry'
  lessonId: text('lesson_id').notNull(), // e.g., 'typing-1'
  status: text('status').notNull(), // 'started', 'completed'
  score: integer('score'), // e.g., WPM or accuracy
  metadata: jsonb('metadata'), // Extra lesson-specific data
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    userTrackLessonIdx: uniqueIndex('user_track_lesson_idx').on(table.userId, table.trackId, table.lessonId),
  };
});

export const analyticsEvents = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  eventType: text('event_type').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: jsonb('metadata').notNull(),
});

// ============================================================
// Presentation Skills track — feedback checkpoints (build spec §6)
// ============================================================

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(), // stable id used by the frontend, e.g. 'structure-clear'
  label: text('label').notNull(),
  rubricCategory: text('rubric_category').notNull(), // structure | visual_design | restraint | pacing | vocal_delivery | time_management
  sentiment: text('sentiment').notNull(), // positive | constructive
});

export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').references(() => users.id).notNull(),
  lessonId: text('lesson_id').notNull(), // 'lesson_9_checkpoint' | 'lesson_12_delivery' | 'lesson_13_capstone'
  submissionType: text('submission_type').notNull(), // file | recording | both
  fileUrl: text('file_url'), // relative path under the uploads dir; nullable — not required for the delivery checkpoint
  fileName: text('file_name'),
  recordingUrl: text('recording_url'), // nullable — not required for the structural checkpoint
  recordingName: text('recording_name'),
  resubmissionOf: integer('resubmission_of').references((): AnyPgColumn => submissions.id), // self-referencing FK — a resubmission points back at the original
  status: text('status').notNull().default('pending'), // pending | reviewed
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id').references(() => submissions.id).notNull(),
  reviewerId: integer('reviewer_id').references(() => users.id).notNull(),
  tagIds: jsonb('tag_ids').notNull(), // array of tags.id
  comment: text('comment'), // capped to ~200 chars at the application layer
  // Snapshot of the metrics tracked at the moment a structure/visual_design
  // tag was applied — { "structure": { avg_words_per_slide: 47.2, ... }, ... }.
  // Only populated for tags in this review that map to metrics (feedback-
  // stuck tracking brief §5.2, §8). Null for reviews with no such tags.
  trackedMetrics: jsonb('tracked_metrics'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================
// Feedback-stuck tracking — objective, deterministic .pptx metrics per
// deck-containing submission (implementation brief, all sections).
// Never a score/grade — raw counts a teacher can compare before/after.
// ============================================================
export const submissionMetrics = pgTable('submission_metrics', {
  id: serial('id').primaryKey(),
  submissionId: integer('submission_id').references(() => submissions.id).notNull().unique(),
  avgWordsPerSlide: doublePrecision('avg_words_per_slide'),
  avgBulletsPerSlide: doublePrecision('avg_bullets_per_slide'),
  imageToTextRatio: doublePrecision('image_to_text_ratio'),
  distinctFontCount: integer('distinct_font_count'),
  slideCount: integer('slide_count'),
  parseStatus: text('parse_status').notNull(), // 'success' | 'failed'
  computedAt: timestamp('computed_at').defaultNow().notNull(),
});

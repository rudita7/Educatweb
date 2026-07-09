import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  pin: text('pin').notNull(), // Hashed PIN
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

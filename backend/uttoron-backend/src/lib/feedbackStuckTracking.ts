import { db } from '@/db';
import { submissions, feedback, tags, submissionMetrics } from '@/db/schema';
import { eq, and, isNotNull, asc, inArray } from 'drizzle-orm';

type Submission = typeof submissions.$inferSelect;
type Feedback = typeof feedback.$inferSelect;

// Which rubric categories this feature covers, and which SubmissionMetrics
// fields each one tracks (implementation brief §7). vocal_delivery, pacing,
// restraint, time_management intentionally have no entry — tags in those
// categories are skipped, not an error (brief §9).
export const METRIC_FIELDS_BY_CATEGORY: Record<string, (keyof typeof submissionMetrics.$inferSelect)[]> = {
  structure: ['avgWordsPerSlide', 'avgBulletsPerSlide'],
  visual_design: ['imageToTextRatio', 'distinctFontCount'],
};

type MetricsRow = typeof submissionMetrics.$inferSelect;

// Builds the `tracked_metrics` snapshot to store on a Review the moment it's
// submitted (brief §5.2). Only includes categories that (a) are present
// among this review's tags and (b) map to metrics and (c) have a
// successfully-parsed SubmissionMetrics row for this submission. Returns
// null if nothing qualifies — most reviews (vocal_delivery/pacing-only,
// or recording-only checkpoints) will have no tracked metrics at all.
export async function buildTrackedMetricsSnapshot(tagIds: string[], metricsRow: MetricsRow | null): Promise<Record<string, Record<string, number>> | null> {
  if (!metricsRow || metricsRow.parseStatus !== 'success' || !tagIds.length) return null;

  const tagRows = await db.query.tags.findMany({ where: inArray(tags.slug, tagIds) });
  const categoriesTagged = new Set(tagRows.map((t) => t.rubricCategory));

  const snapshot: Record<string, Record<string, number>> = {};
  for (const category of categoriesTagged) {
    const fields = METRIC_FIELDS_BY_CATEGORY[category];
    if (!fields) continue; // e.g. vocal_delivery, pacing — not tracked, expected
    const values: Record<string, number> = {};
    for (const field of fields) {
      const v = metricsRow[field];
      if (typeof v === 'number') values[field] = v;
    }
    if (Object.keys(values).length) snapshot[category] = values;
  }
  return Object.keys(snapshot).length ? snapshot : null;
}

export interface MetricComparison {
  metric: string;
  before: number;
  after: number;
  delta: number;
  percentChange: number | null; // null when before is 0 — percent change is undefined
}
export interface CategoryComparison {
  category: string;
  taggedAt: string;
  baselineSubmissionId: number;
  baselineLessonId: string;
  resolved: boolean;
  metrics: MetricComparison[];
  comparisonSubmissionId?: number;
  comparisonLessonId?: string;
}

// Implements the get_comparison algorithm from the brief (§8) for every
// category this student has ever been tagged on, computed on read (cheap
// at this scale, no cache-invalidation to manage).
export async function getComparisonsForStudent(studentId: number): Promise<CategoryComparison[]> {
  // All of this student's submissions, oldest-first — used both to resolve
  // which submission each review belongs to and to find "the next deck".
  const studentSubmissions = await db.query.submissions.findMany({
    where: eq(submissions.studentId, studentId),
    orderBy: asc(submissions.createdAt),
  });
  const submissionsById = new Map<number, Submission>(studentSubmissions.map((s) => [s.id, s]));

  const submissionIds = studentSubmissions.map((s) => s.id);
  const myReviews: Feedback[] = submissionIds.length
    ? await db.query.feedback.findMany({ where: and(inArray(feedback.submissionId, submissionIds), isNotNull(feedback.trackedMetrics)) })
    : [];
  myReviews.sort((a, b) => (submissionsById.get(b.submissionId)!.createdAt as unknown as number) > (submissionsById.get(a.submissionId)!.createdAt as unknown as number) ? 1 : -1);

  // Most recent tag of each category wins (brief §5.4 — don't chain further back).
  const latestByCategory = new Map<string, { submission: Submission; taggedAt: Feedback['createdAt']; category: string; values: Record<string, number> }>();
  for (const review of myReviews) {
    const submission = submissionsById.get(review.submissionId)!;
    const snapshot = review.trackedMetrics as Record<string, Record<string, number>>;
    for (const category of Object.keys(snapshot)) {
      if (!latestByCategory.has(category)) {
        latestByCategory.set(category, { submission, taggedAt: review.createdAt, category, values: snapshot[category] });
      }
    }
  }

  const results: CategoryComparison[] = [];
  for (const { submission: baselineSubmission, taggedAt, category, values } of latestByCategory.values()) {
    const baseline: CategoryComparison = {
      category,
      taggedAt: taggedAt as unknown as string,
      baselineSubmissionId: baselineSubmission.id,
      baselineLessonId: baselineSubmission.lessonId,
      resolved: false,
      metrics: [],
    };

    // "earliest submission with a deck file AND successful metrics" is one
    // combined condition (brief §8) — a failed parse on the first candidate
    // deck must not stop the search; keep looking for a later one that parsed.
    const deckCandidates = studentSubmissions.filter(
      (s) => new Date(s.createdAt).getTime() > new Date(baselineSubmission.createdAt).getTime() && s.fileUrl
    );
    let nextDeck: Submission | null = null;
    let nextMetrics: MetricsRow | null = null;
    for (const candidate of deckCandidates) {
      const row = await db.query.submissionMetrics.findFirst({ where: eq(submissionMetrics.submissionId, candidate.id) });
      if (row && row.parseStatus === 'success') { nextDeck = candidate; nextMetrics = row; break; }
    }
    if (!nextDeck || !nextMetrics) { results.push(baseline); continue; }

    const fields = METRIC_FIELDS_BY_CATEGORY[category] || [];
    const metricComparisons: MetricComparison[] = [];
    for (const field of fields) {
      const before = values[field as string];
      const after = nextMetrics[field] as number | null;
      if (typeof before !== 'number' || typeof after !== 'number') continue;
      const delta = after - before;
      metricComparisons.push({
        metric: field as string,
        before,
        after,
        delta,
        percentChange: before !== 0 ? (delta / before) * 100 : null,
      });
    }

    results.push({
      ...baseline,
      resolved: metricComparisons.length > 0,
      metrics: metricComparisons,
      comparisonSubmissionId: nextDeck.id,
      comparisonLessonId: nextDeck.lessonId,
    });
  }

  return results;
}

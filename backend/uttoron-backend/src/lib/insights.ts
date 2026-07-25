import { db } from '@/db';
import { submissions, feedback, tags, submissionMetrics } from '@/db/schema';
import { eq, and, gte, inArray } from 'drizzle-orm';
import { signedUrlFor } from '@/lib/storage';

// ============================================================
// PRD "Should have" items: capstone growth portfolio + weakness-pattern
// aggregation. Both are purely descriptive counting/comparison over data
// already collected — no scoring, no prediction, no model (PRD §10).
// ============================================================

const TOUCHPOINT_1 = 'lesson_9_checkpoint';
const CAPSTONE = 'lesson_13_capstone';

type MetricsRow = typeof submissionMetrics.$inferSelect;
const METRIC_FIELDS: (keyof MetricsRow)[] = ['avgWordsPerSlide', 'avgBulletsPerSlide', 'imageToTextRatio', 'distinctFontCount'];

// ---------------- Growth portfolio: touchpoint 1 vs capstone, side by side ----------------
// Independent of tagging — uses every deck-containing submission's metrics,
// not just the ones a reviewer happened to tag. If a student resubmitted a
// touchpoint, the latest one is used.
export async function getGrowthPortfolio(studentId: number) {
  const subs = await db.query.submissions.findMany({
    where: and(eq(submissions.studentId, studentId), inArray(submissions.lessonId, [TOUCHPOINT_1, CAPSTONE])),
  });

  async function latestWithMetrics(lessonId: string) {
    const candidates = subs.filter((s) => s.lessonId === lessonId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    for (const c of candidates) {
      const m = await db.query.submissionMetrics.findFirst({ where: eq(submissionMetrics.submissionId, c.id) });
      if (m && m.parseStatus === 'success') return { submission: c, metrics: m };
      if (m) return { submission: c, metrics: null }; // most recent has a metrics row but it failed — don't silently fall back to an older one and misattribute
    }
    return null;
  }

  const touchpoint1 = await latestWithMetrics(TOUCHPOINT_1);
  const capstone = await latestWithMetrics(CAPSTONE);

  let diff: { metric: string; before: number; after: number; delta: number; percentChange: number | null }[] | null = null;
  if (touchpoint1?.metrics && capstone?.metrics) {
    diff = METRIC_FIELDS.map((field) => {
      const before = touchpoint1.metrics![field] as number;
      const after = capstone.metrics![field] as number;
      const delta = after - before;
      return { metric: field, before, after, delta, percentChange: before !== 0 ? (delta / before) * 100 : null };
    });
  }

  const [touchpoint1Url, capstoneUrl] = await Promise.all([
    touchpoint1?.submission.fileUrl ? signedUrlFor(touchpoint1.submission.fileUrl) : Promise.resolve(null),
    capstone?.submission.fileUrl ? signedUrlFor(capstone.submission.fileUrl) : Promise.resolve(null),
  ]);

  return {
    touchpoint1: touchpoint1 ? { submissionId: touchpoint1.submission.id, submittedAt: touchpoint1.submission.createdAt, fileName: touchpoint1.submission.fileName, fileUrl: touchpoint1Url, metrics: touchpoint1.metrics } : null,
    capstone: capstone ? { submissionId: capstone.submission.id, submittedAt: capstone.submission.createdAt, fileName: capstone.submission.fileName, fileUrl: capstoneUrl, metrics: capstone.metrics } : null,
    diff,
  };
}

// ---------------- Weakness-pattern aggregation ----------------
// "pacing flagged in 2 of last 3 reviews" — per-student, category-level
// counts over that student's own review history.
export async function getWeaknessPatternsForStudent(studentId: number) {
  const studentSubmissions = await db.query.submissions.findMany({ where: eq(submissions.studentId, studentId) });
  const submissionIds = studentSubmissions.map((s) => s.id);
  if (!submissionIds.length) return { totalReviews: 0, patterns: [] };

  const reviews = await db.query.feedback.findMany({ where: inArray(feedback.submissionId, submissionIds) });
  if (!reviews.length) return { totalReviews: 0, patterns: [] };

  const allTagIds = Array.from(new Set(reviews.flatMap((r) => (r.tagIds as string[]) || [])));
  const tagRows = allTagIds.length ? await db.query.tags.findMany({ where: inArray(tags.slug, allTagIds) }) : [];
  const categoryBySlug = new Map(tagRows.map((t) => [t.slug, t.rubricCategory]));

  const counts: Record<string, number> = {};
  for (const review of reviews) {
    const categoriesInThisReview = new Set(((review.tagIds as string[]) || []).map((slug) => categoryBySlug.get(slug)).filter(Boolean) as string[]);
    for (const category of categoriesInThisReview) counts[category] = (counts[category] || 0) + 1;
  }

  const patterns = Object.entries(counts)
    .map(([category, count]) => ({ category, count, totalReviews: reviews.length }))
    .sort((a, b) => b.count - a.count);

  return { totalReviews: reviews.length, patterns };
}

// "visual_design is the most-tagged issue this month" — cohort-wide,
// across all students. Reviewer-only (enforced by the route, not here).
export async function getCohortWeaknessPatterns(sinceDays?: number) {
  const cutoff = sinceDays ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000) : null;
  const reviews = cutoff
    ? await db.query.feedback.findMany({ where: gte(feedback.createdAt, cutoff) })
    : await db.query.feedback.findMany();
  if (!reviews.length) return { totalReviews: 0, patterns: [] };

  const allTagIds = Array.from(new Set(reviews.flatMap((r) => (r.tagIds as string[]) || [])));
  const tagRows = allTagIds.length ? await db.query.tags.findMany({ where: inArray(tags.slug, allTagIds) }) : [];
  const categoryBySlug = new Map(tagRows.map((t) => [t.slug, t.rubricCategory]));

  const counts: Record<string, number> = {};
  for (const review of reviews) {
    const categoriesInThisReview = new Set(((review.tagIds as string[]) || []).map((slug) => categoryBySlug.get(slug)).filter(Boolean) as string[]);
    for (const category of categoriesInThisReview) counts[category] = (counts[category] || 0) + 1;
  }

  const patterns = Object.entries(counts)
    .map(([category, count]) => ({ category, count, totalReviews: reviews.length, percentage: Math.round((count / reviews.length) * 100) }))
    .sort((a, b) => b.count - a.count);

  return { totalReviews: reviews.length, patterns };
}

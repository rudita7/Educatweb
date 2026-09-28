import { db } from '@/db';
import { typingResults, typingFeedback } from '@/db/schema';
import { eq, asc, inArray } from 'drizzle-orm';

// ============================================================
// Typing track — before/after tracking (typing feedback spec §9).
//
// Much smaller than the presentation track's feedbackStuckTracking.ts:
// there's no per-category metric mapping and no parse-failure case (a
// WPM/accuracy pair is always a number, never a failed .pptx parse), so
// this is just "for every reviewed attempt, what did the student's next
// attempt look like."
// ============================================================

export interface TypingComparison {
  baselineResultId: number;
  baselineCheckpointId: string;
  taggedAt: string;
  wpmBefore: number;
  accuracyBefore: number;
  resolved: boolean;
  comparisonResultId?: number;
  comparisonCheckpointId?: string;
  wpmAfter?: number;
  accuracyAfter?: number;
  wpmDelta?: number;
  accuracyDelta?: number;
}

// One comparison per reviewed (tagged) attempt, matched against that
// student's next chronological attempt (reviewed or not — the point is
// "did the next attempt improve", not "did the next *reviewed* attempt
// improve"). Most recent reviewed attempt with no later attempt yet comes
// back with resolved:false, same convention as the presentation track.
export async function getTypingComparisonsForStudent(studentId: number): Promise<TypingComparison[]> {
  const results = await db.query.typingResults.findMany({
    where: eq(typingResults.studentId, studentId),
    orderBy: asc(typingResults.createdAt),
  });
  if (results.length < 2) return [];

  const resultIds = results.map((r) => r.id);
  const feedbackRows = await db.query.typingFeedback.findMany({ where: inArray(typingFeedback.resultId, resultIds) });
  const taggedResultIds = new Set(feedbackRows.map((f) => f.resultId));

  const comparisons: TypingComparison[] = [];
  for (let i = 0; i < results.length; i++) {
    const baseline = results[i];
    if (!taggedResultIds.has(baseline.id)) continue; // only a reviewed attempt is a meaningful "before"

    const next = results[i + 1] ?? null;
    const comparison: TypingComparison = {
      baselineResultId: baseline.id,
      baselineCheckpointId: baseline.checkpointId,
      taggedAt: baseline.createdAt as unknown as string,
      wpmBefore: baseline.wpm,
      accuracyBefore: baseline.accuracy,
      resolved: !!next,
    };
    if (next) {
      comparison.comparisonResultId = next.id;
      comparison.comparisonCheckpointId = next.checkpointId;
      comparison.wpmAfter = next.wpm;
      comparison.accuracyAfter = next.accuracy;
      comparison.wpmDelta = Math.round((next.wpm - baseline.wpm) * 10) / 10;
      comparison.accuracyDelta = Math.round((next.accuracy - baseline.accuracy) * 10) / 10;
    }
    comparisons.push(comparison);
  }
  return comparisons;
}

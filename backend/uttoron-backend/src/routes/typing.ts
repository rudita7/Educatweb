import { Router, Response } from 'express';
import { db } from '@/db';
import { typingResults, typingFeedback, tags, users } from '@/db/schema';
import { eq, and, asc, desc, SQL } from 'drizzle-orm';
import { authenticate, requireReviewer, AuthRequest } from '@/middleware/auth';
import { getTypingComparisonsForStudent } from '@/lib/typingProgressTracking';

const router = Router();

// ============================================================
// Typing track — feedback checkpoints (typing feedback spec §4).
//
// Modeled directly on routes/submissions.ts, minus anything file-related:
// a typing attempt is a plain numeric result computed client-side (see
// webapp/typing-lesson.html + shared/backendBridge.js), so there's no
// upload, no storage, and no background metric extraction to wait on —
// wpm/accuracy/errorCount are already final the moment POST /results lands.
// ============================================================

// Spec §6, option (b): the current typing track is a single lesson, so
// there's only one checkpointId. Redoing the lesson later produces a new
// dated row rather than a new checkpoint name — see typingProgressTracking.ts.
const VALID_CHECKPOINT_IDS = ['typing_checkpoint'] as const;

// Spec §8 tag taxonomy, namespaced to avoid colliding with the
// presentation track's 'pacing' category (see seed.ts for why).
const TYPING_TAG_CATEGORIES = ['accuracy', 'typing_pacing', 'progress'];

const MAX_WPM = 300; // generous ceiling — catches a client-side timing bug, not a real typist
const MAX_COMMENT_LENGTH = 200;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

// ---------------- Submit a result (spec §4, POST /results) ----------------
router.post('/results', authenticate, async (req: AuthRequest, res: Response) => {
  const { checkpointId, wpm, accuracy, errorCount, durationSeconds, textLength } = req.body;

  if (!checkpointId || !VALID_CHECKPOINT_IDS.includes(checkpointId)) {
    return res.status(400).json({ error: 'checkpointId must be one of ' + VALID_CHECKPOINT_IDS.join(', ') });
  }
  if (!isFiniteNumber(wpm) || wpm <= 0 || wpm > MAX_WPM) {
    return res.status(400).json({ error: `wpm must be a number greater than 0 and no more than ${MAX_WPM}` });
  }
  if (!isFiniteNumber(accuracy) || accuracy < 0 || accuracy > 100) {
    return res.status(400).json({ error: 'accuracy must be a number between 0 and 100' });
  }
  if (!isFiniteNumber(errorCount) || errorCount < 0) {
    return res.status(400).json({ error: 'errorCount must be a non-negative number' });
  }
  if (!isFiniteNumber(durationSeconds) || durationSeconds <= 0) {
    return res.status(400).json({ error: 'durationSeconds must be a positive number' });
  }
  if (!isFiniteNumber(textLength) || textLength <= 0) {
    return res.status(400).json({ error: 'textLength must be a positive number' });
  }

  try {
    const [inserted] = await db
      .insert(typingResults)
      .values({
        studentId: req.user!.id,
        checkpointId,
        wpm,
        accuracy,
        errorCount,
        durationSeconds,
        textLength,
        status: 'pending',
      })
      .returning();
    res.status(201).json(inserted);
  } catch (error) {
    console.error('Create typing result error:', error);
    res.status(500).json({ error: 'Failed to save typing result' });
  }
});

// ---------------- Reviewer queue (spec §4, GET /queue) ----------------
router.get('/queue', authenticate, requireReviewer, async (req: AuthRequest, res: Response) => {
  const status = (req.query.status as string) || 'pending';
  const checkpointId = req.query.checkpointId as string | undefined;
  const studentId = req.query.studentId ? Number(req.query.studentId) : undefined;

  const conditions: SQL[] = [];
  if (status !== 'all') conditions.push(eq(typingResults.status, status));
  if (checkpointId) conditions.push(eq(typingResults.checkpointId, checkpointId));
  if (studentId) conditions.push(eq(typingResults.studentId, studentId));

  try {
    const rows = await db.query.typingResults.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      // pending queue triages oldest-first; a reviewed/all history reads newest-first — same reasoning as the presentation queue.
      orderBy: status === 'pending' ? asc(typingResults.createdAt) : desc(typingResults.createdAt),
    });
    const withStudent = await Promise.all(
      rows.map(async (r) => {
        const [student, fb] = await Promise.all([
          db.query.users.findFirst({ where: eq(users.id, r.studentId), columns: { username: true } }),
          r.status === 'reviewed' ? db.query.typingFeedback.findFirst({ where: eq(typingFeedback.resultId, r.id) }) : Promise.resolve(null),
        ]);
        return { ...r, studentName: student?.username || 'Unknown', feedback: fb || null };
      })
    );
    res.json(withStudent);
  } catch (error) {
    console.error('Fetch typing queue error:', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// ---------------- Student's own results + feedback (spec §4, GET /mine) ----------------
router.get('/mine', authenticate, async (req: AuthRequest, res: Response) => {
  const checkpointId = req.query.checkpointId as string | undefined;
  try {
    const mine = await db.query.typingResults.findMany({
      where: checkpointId ? and(eq(typingResults.studentId, req.user!.id), eq(typingResults.checkpointId, checkpointId)) : eq(typingResults.studentId, req.user!.id),
      orderBy: desc(typingResults.createdAt),
    });
    const withFeedback = await Promise.all(
      mine.map(async (r) => {
        const fb = await db.query.typingFeedback.findFirst({ where: eq(typingFeedback.resultId, r.id) });
        return { result: r, feedback: fb || null };
      })
    );
    res.json(withFeedback);
  } catch (error) {
    console.error('Fetch typing mine error:', error);
    res.status(500).json({ error: 'Failed to fetch your results' });
  }
});

// ---------------- Reviewer submits feedback (spec §4, POST /:id/feedback) ----------------
router.post('/:id/feedback', authenticate, requireReviewer, async (req: AuthRequest, res: Response) => {
  const resultId = Number(req.params.id);
  const { tagIds, comment } = req.body;

  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    return res.status(400).json({ error: 'Pick at least one tag.' });
  }

  try {
    const result = await db.query.typingResults.findFirst({ where: eq(typingResults.id, resultId) });
    if (!result) return res.status(404).json({ error: 'Typing result not found' });

    // No waitForMetrics-style polling needed — wpm/accuracy/errorCount are
    // already computed client-side and stored synchronously at POST /results.
    const [inserted] = await db
      .insert(typingFeedback)
      .values({
        resultId,
        reviewerId: req.user!.id,
        tagIds,
        comment: comment ? String(comment).slice(0, MAX_COMMENT_LENGTH) : null,
      })
      .returning();

    await db.update(typingResults).set({ status: 'reviewed' }).where(eq(typingResults.id, resultId));
    res.status(201).json(inserted);
  } catch (error) {
    console.error('Submit typing feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// ---------------- Before/after tracking (spec §9, optional Phase 4) ----------------
// A student sees only their own; a reviewer can look up any studentId —
// same access rule as submissions.ts's /comparisons.
router.get('/comparisons', authenticate, async (req: AuthRequest, res: Response) => {
  const requestedId = req.query.studentId ? Number(req.query.studentId) : req.user!.id;
  if (requestedId !== req.user!.id && req.user!.role !== 'reviewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    res.json(await getTypingComparisonsForStudent(requestedId));
  } catch (error) {
    console.error('Fetch typing comparisons error:', error);
    res.status(500).json({ error: 'Failed to fetch comparisons' });
  }
});

// ---------------- Tags (spec §4, GET /tags/list) ----------------
router.get('/tags/list', async (_req: AuthRequest, res: Response) => {
  try {
    const all = await db.query.tags.findMany();
    res.json(all.filter((t) => TYPING_TAG_CATEGORIES.includes(t.rubricCategory)));
  } catch (error) {
    console.error('Fetch typing tags error:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

export default router;

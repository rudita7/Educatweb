import { Router, Response } from 'express';
import multer from 'multer';
import { db } from '@/db';
import { submissions, feedback, tags, users, submissionMetrics } from '@/db/schema';
import { eq, and, asc, desc, SQL } from 'drizzle-orm';
import { authenticate, requireReviewer, AuthRequest } from '@/middleware/auth';
import { buildStoragePath, uploadToStorage, signedUrlFor } from '@/lib/storage';
import { extractPptxMetrics } from '@/lib/pptxMetrics';
import { buildTrackedMetricsSnapshot, getComparisonsForStudent } from '@/lib/feedbackStuckTracking';
import { getGrowthPortfolio, getWeaknessPatternsForStudent, getCohortWeaknessPatterns } from '@/lib/insights';

const router = Router();

// ============================================================
// Feedback checkpoint submissions (build spec §6-9).
//
// Files live in Supabase Storage (private bucket "submissions"), not local
// disk — local disk doesn't survive redeploys/restarts on most hosts. Every
// read gets a short-lived signed URL generated on demand; nothing is ever
// public.
//
// This mirrors the frontend's engines/submissionStore.js interface
// (createSubmission / listQueue / listMine / submitFeedback) 1:1.
// ============================================================

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB — matches submissionStore.js MAX_FILE_MB
const MAX_RECORDING_BYTES = 40 * 1024 * 1024; // 40MB — matches submissionStore.js MAX_RECORDING_MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECORDING_BYTES }, // per-file cap; the larger of the two, checked precisely per-field below
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'deckFile') {
      const ok = /\.pptx$/i.test(file.originalname);
      if (!ok) return cb(new Error('Deck file must be a .pptx file.'));
    }
    if (file.fieldname === 'recording') {
      const ok = file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/');
      if (!ok) return cb(new Error('Recording must be an audio or video file.'));
    }
    cb(null, true);
  },
});

const VALID_LESSON_IDS = ['lesson_9_checkpoint', 'lesson_12_delivery', 'lesson_13_capstone'] as const;

// spec §4 — which rubric categories a reviewer sees, per lesson.
const LESSON_TAG_MAP: Record<string, string[]> = {
  lesson_9_checkpoint: ['structure', 'visual_design'],
  lesson_12_delivery: ['vocal_delivery', 'pacing'],
  lesson_13_capstone: ['structure', 'visual_design', 'restraint', 'pacing', 'vocal_delivery', 'time_management'],
};

// Feedback-stuck tracking (implementation brief §5.1): runs after the
// upload response is already sent — never blocks a student on this.
// A corrupt/unparseable deck stores parse_status:'failed' rather than
// throwing, so a bad file can never crash the submission flow.
function runMetricExtractionInBackground(submissionId: number, buffer: Buffer) {
  console.log(`[metrics] extracting for submission ${submissionId}...`);
  extractPptxMetrics(buffer)
    .then((result) => {
      console.log(`[metrics] submission ${submissionId}: parse_status=${result.parse_status}`, result.error ? `error=${result.error}` : result);
      return db.insert(submissionMetrics).values({
        submissionId,
        avgWordsPerSlide: result.avg_words_per_slide ?? null,
        avgBulletsPerSlide: result.avg_bullets_per_slide ?? null,
        imageToTextRatio: result.image_to_text_ratio ?? null,
        distinctFontCount: result.distinct_font_count ?? null,
        slideCount: result.slide_count ?? null,
        parseStatus: result.parse_status,
      });
    })
    .catch((err) => console.error(`[metrics] submission ${submissionId}: extraction threw`, err));
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }

// Background extraction (spawns a Python process) can still be running when
// a reviewer submits feedback seconds later — wait briefly rather than
// permanently losing the chance to snapshot tracked_metrics for this review.
async function waitForMetrics(submissionId: number, attempts = 5, delayMs = 1000) {
  for (let i = 0; i < attempts; i++) {
    const row = await db.query.submissionMetrics.findFirst({ where: eq(submissionMetrics.submissionId, submissionId) });
    if (row) return row;
    await sleep(delayMs);
  }
  return null;
}

// storagePath -> short-lived signed URL for API responses; null-safe.
async function withUrls<T extends { fileUrl: string | null; recordingUrl: string | null }>(row: T) {
  const [fileUrl, recordingUrl] = await Promise.all([
    row.fileUrl ? signedUrlFor(row.fileUrl) : Promise.resolve(null),
    row.recordingUrl ? signedUrlFor(row.recordingUrl) : Promise.resolve(null),
  ]);
  return { ...row, fileUrl, recordingUrl };
}

// ---------------- Submit ----------------
router.post(
  '/',
  authenticate,
  upload.fields([{ name: 'deckFile', maxCount: 1 }, { name: 'recording', maxCount: 1 }]),
  async (req: AuthRequest, res: Response) => {
    const { lessonId, submissionType, resubmissionOf } = req.body;
    const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;

    if (!lessonId || !VALID_LESSON_IDS.includes(lessonId)) {
      return res.status(400).json({ error: 'lessonId must be one of ' + VALID_LESSON_IDS.join(', ') });
    }
    if (!submissionType || !['file', 'recording', 'both'].includes(submissionType)) {
      return res.status(400).json({ error: 'submissionType must be file, recording, or both' });
    }

    const deckFile = files?.deckFile?.[0];
    const recordingFile = files?.recording?.[0];

    // spec §9 edge case: validate the right combination of file/recording for this lesson.
    if (lessonId === 'lesson_9_checkpoint' && !deckFile) {
      return res.status(400).json({ error: 'This checkpoint requires a deck file.' });
    }
    if (lessonId === 'lesson_12_delivery' && !recordingFile) {
      return res.status(400).json({ error: 'This checkpoint requires a recording.' });
    }
    if (lessonId === 'lesson_13_capstone' && (!deckFile || !recordingFile)) {
      return res.status(400).json({ error: 'The capstone requires both a deck file and a recording.' });
    }
    if (deckFile && deckFile.size > MAX_FILE_BYTES) {
      return res.status(400).json({ error: 'Deck file exceeds the 25MB limit.' });
    }
    if (recordingFile && recordingFile.size > MAX_RECORDING_BYTES) {
      return res.status(400).json({ error: 'Recording exceeds the 40MB limit.' });
    }

    try {
      const studentId = req.user!.id;
      let filePath: string | null = null;
      let recordingPath: string | null = null;
      if (deckFile) {
        filePath = buildStoragePath(studentId, lessonId, deckFile.originalname);
        await uploadToStorage(filePath, deckFile.buffer, deckFile.mimetype);
      }
      if (recordingFile) {
        recordingPath = buildStoragePath(studentId, lessonId, recordingFile.originalname);
        await uploadToStorage(recordingPath, recordingFile.buffer, recordingFile.mimetype);
      }

      const [inserted] = await db
        .insert(submissions)
        .values({
          studentId,
          lessonId,
          submissionType,
          fileUrl: filePath,
          fileName: deckFile ? deckFile.originalname : null,
          recordingUrl: recordingPath,
          recordingName: recordingFile ? recordingFile.originalname : null,
          resubmissionOf: resubmissionOf ? Number(resubmissionOf) : null,
          status: 'pending',
        })
        .returning();
      res.status(201).json(await withUrls(inserted));
      if (deckFile) runMetricExtractionInBackground(inserted.id, deckFile.buffer); // after response — never blocks upload
    } catch (error) {
      console.error('Create submission error:', error);
      res.status(500).json({ error: 'Failed to create submission' });
    }
  }
);

// ---------------- Reviewer queue (spec §8.2) — filterable per PRD §5 ----------------
router.get('/queue', authenticate, requireReviewer, async (req: AuthRequest, res: Response) => {
  const status = (req.query.status as string) || 'pending';
  const lessonId = req.query.lessonId as string | undefined;
  const studentId = req.query.studentId ? Number(req.query.studentId) : undefined;

  const conditions: SQL[] = [];
  if (status !== 'all') conditions.push(eq(submissions.status, status));
  if (lessonId) conditions.push(eq(submissions.lessonId, lessonId));
  if (studentId) conditions.push(eq(submissions.studentId, studentId));

  try {
    const rows = await db.query.submissions.findMany({
      where: conditions.length ? and(...conditions) : undefined,
      // pending queue triages oldest-first; a reviewed/all history reads newest-first.
      orderBy: status === 'pending' ? asc(submissions.createdAt) : desc(submissions.createdAt),
    });
    const withStudent = await Promise.all(
      rows.map(async (s) => {
        const [student, fb] = await Promise.all([
          db.query.users.findFirst({ where: eq(users.id, s.studentId), columns: { username: true } }),
          s.status === 'reviewed' ? db.query.feedback.findFirst({ where: eq(feedback.submissionId, s.id) }) : Promise.resolve(null),
        ]);
        return withUrls({ ...s, studentName: student?.username || 'Unknown', feedback: fb || null });
      })
    );
    res.json(withStudent);
  } catch (error) {
    console.error('Fetch queue error:', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// ---------------- Student's own submissions + feedback (progress passport) ----------------
router.get('/mine', authenticate, async (req: AuthRequest, res: Response) => {
  const lessonId = req.query.lessonId as string | undefined;
  try {
    const mySubs = await db.query.submissions.findMany({
      where: lessonId ? and(eq(submissions.studentId, req.user!.id), eq(submissions.lessonId, lessonId)) : eq(submissions.studentId, req.user!.id),
      orderBy: desc(submissions.createdAt),
    });
    const withFeedback = await Promise.all(
      mySubs.map(async (s) => {
        const fb = await db.query.feedback.findFirst({ where: eq(feedback.submissionId, s.id) });
        return { submission: await withUrls(s), feedback: fb || null };
      })
    );
    res.json(withFeedback);
  } catch (error) {
    console.error('Fetch mine error:', error);
    res.status(500).json({ error: 'Failed to fetch your submissions' });
  }
});

// ---------------- Reviewer submits feedback (spec §8.2) ----------------
router.post('/:id/feedback', authenticate, requireReviewer, async (req: AuthRequest, res: Response) => {
  const submissionId = Number(req.params.id);
  const { tagIds, comment } = req.body;

  if (!Array.isArray(tagIds) || tagIds.length === 0) {
    return res.status(400).json({ error: 'Pick at least one tag.' });
  }

  try {
    const submission = await db.query.submissions.findFirst({ where: eq(submissions.id, submissionId) });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    // Only wait if there's actually a deck to have extracted metrics from —
    // a recording-only review (lesson_12) has nothing to wait for.
    const metricsRow = submission.fileUrl ? await waitForMetrics(submissionId) : null;
    const trackedMetrics = await buildTrackedMetricsSnapshot(tagIds, metricsRow ?? null);

    const [inserted] = await db
      .insert(feedback)
      .values({
        submissionId,
        reviewerId: req.user!.id,
        tagIds,
        comment: comment ? String(comment).slice(0, 200) : null,
        trackedMetrics,
      })
      .returning();

    await db.update(submissions).set({ status: 'reviewed' }).where(eq(submissions.id, submissionId));
    res.status(201).json(inserted);
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// ---------------- Feedback-stuck tracking: before/after comparisons ----------------
// A student sees only their own; a reviewer can look up any studentId.
router.get('/comparisons', authenticate, async (req: AuthRequest, res: Response) => {
  const requestedId = req.query.studentId ? Number(req.query.studentId) : req.user!.id;
  if (requestedId !== req.user!.id && req.user!.role !== 'reviewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    res.json(await getComparisonsForStudent(requestedId));
  } catch (error) {
    console.error('Fetch comparisons error:', error);
    res.status(500).json({ error: 'Failed to fetch comparisons' });
  }
});

// ---------------- Growth portfolio: touchpoint 1 vs capstone (PRD §5, Should-have) ----------------
router.get('/growth-portfolio', authenticate, async (req: AuthRequest, res: Response) => {
  const requestedId = req.query.studentId ? Number(req.query.studentId) : req.user!.id;
  if (requestedId !== req.user!.id && req.user!.role !== 'reviewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    res.json(await getGrowthPortfolio(requestedId));
  } catch (error) {
    console.error('Fetch growth portfolio error:', error);
    res.status(500).json({ error: 'Failed to fetch growth portfolio' });
  }
});

// ---------------- Weakness-pattern aggregation (PRD §5, Should-have) ----------------
router.get('/weakness-patterns', authenticate, async (req: AuthRequest, res: Response) => {
  const requestedId = req.query.studentId ? Number(req.query.studentId) : req.user!.id;
  if (requestedId !== req.user!.id && req.user!.role !== 'reviewer') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    res.json(await getWeaknessPatternsForStudent(requestedId));
  } catch (error) {
    console.error('Fetch weakness patterns error:', error);
    res.status(500).json({ error: 'Failed to fetch weakness patterns' });
  }
});

router.get('/weakness-patterns/cohort', authenticate, requireReviewer, async (req: AuthRequest, res: Response) => {
  const days = req.query.days ? Number(req.query.days) : undefined;
  try {
    res.json(await getCohortWeaknessPatterns(days));
  } catch (error) {
    console.error('Fetch cohort weakness patterns error:', error);
    res.status(500).json({ error: 'Failed to fetch cohort weakness patterns' });
  }
});

// ---------------- Tags, filtered per lesson (spec §4/§7) ----------------
router.get('/tags/list', async (req: AuthRequest, res: Response) => {
  const lessonId = req.query.lessonId as string | undefined;
  try {
    const all = await db.query.tags.findMany();
    if (!lessonId) return res.json(all);
    const categories = LESSON_TAG_MAP[lessonId];
    if (!categories) return res.status(400).json({ error: 'Unknown lessonId' });
    res.json(all.filter((t) => categories.includes(t.rubricCategory)));
  } catch (error) {
    console.error('Fetch tags error:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

export default router;

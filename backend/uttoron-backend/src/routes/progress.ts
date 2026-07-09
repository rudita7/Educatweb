import { Router, Response } from 'express';
import { db } from '@/db';
import { progress } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate, AuthRequest } from '@/middleware/auth';

const router = Router();

// Get user progress
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userProgress = await db.query.progress.findMany({
      where: eq(progress.userId, req.user!.id),
    });
    res.json(userProgress);
  } catch (error) {
    console.error('Fetch progress error:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Sync progress (upsert)
router.post('/sync', authenticate, async (req: AuthRequest, res: Response) => {
  const { trackId, lessonId, status, score, metadata } = req.body;

  if (!trackId || !lessonId || !status) {
    return res.status(400).json({ error: 'Missing required progress fields' });
  }

  try {
    const existing = await db.query.progress.findFirst({
      where: and(
        eq(progress.userId, req.user!.id),
        eq(progress.trackId, trackId),
        eq(progress.lessonId, lessonId)
      ),
    });

    if (existing) {
      const [updated] = await db.update(progress)
        .set({ status, score, metadata, updatedAt: new Date() })
        .where(eq(progress.id, existing.id))
        .returning();
      res.json(updated);
    } else {
      const [inserted] = await db.insert(progress)
        .values({
          userId: req.user!.id,
          trackId,
          lessonId,
          status,
          score,
          metadata,
        })
        .returning();
      res.status(201).json(inserted);
    }
  } catch (error) {
    console.error('Sync progress error:', error);
    res.status(500).json({ error: 'Failed to sync progress' });
  }
});

export default router;

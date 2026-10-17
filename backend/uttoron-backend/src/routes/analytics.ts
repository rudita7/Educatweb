import { Router, Response } from 'express';
import { db } from '@/db';
import { analyticsEvents, users, progress } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { STAMP_IDS, earnedStamps } from '@/lib/stamps';
import { authenticate, AuthRequest } from '@/middleware/auth';
import { recommendTrack } from '@/lib/decisionTree';

const router = Router();

// Log analytics event
router.post('/log', async (req, res) => {
  const { userId, eventType, metadata } = req.body;

  if (!eventType || !metadata) {
    return res.status(400).json({ error: 'eventType and metadata are required' });
  }

  try {
    await db.insert(analyticsEvents).values({
      userId: userId ? Number(userId) : null,
      eventType,
      metadata,
    });
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Analytics log error:', error);
    res.status(500).json({ error: 'Failed to log event' });
  }
});

// Platform-wide summary for the Analytics page. Aggregate counts only — no
// usernames, nicknames or PINs ever leave this endpoint (students are
// minors), so it can be public like /api/auth/count. The page used to read
// each browser's localStorage and so only ever showed passports created on
// that one device.
//
// Stamp data comes from the one 'site-progress'/'stamps' row each student's
// dashboard syncs (see shared/backendBridge.js), so a student counts once
// they've opened their passport dashboard on any device.
router.get('/summary', async (_req, res) => {
  try {
    const students = await db
      .select({ id: users.id, avatar: users.avatar, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.role, 'student'))
      .orderBy(desc(users.createdAt));

    const rows = await db
      .select({ userId: progress.userId, metadata: progress.metadata })
      .from(progress)
      .where(and(eq(progress.trackId, 'site-progress'), eq(progress.lessonId, 'stamps')));

    const earnedByUser = new Map<number, string[]>();
    rows.forEach((r) => earnedByUser.set(r.userId, earnedStamps(r.metadata)));

    const stampCounts: Record<string, number> = {};
    STAMP_IDS.forEach((id) => { stampCounts[id] = 0; });
    let totalStampsEarned = 0;
    const studentIds = new Set(students.map((s) => s.id));
    earnedByUser.forEach((earned, userId) => {
      // ignore rows belonging to non-student accounts
      if (!studentIds.has(userId)) return;
      earned.forEach((id) => { stampCounts[id] += 1; totalStampsEarned += 1; });
    });

    res.set('Cache-Control', 'public, max-age=30');
    res.json({
      totalStudents: students.length,
      totalStampsEarned,
      stampCounts,
      stampsPossible: STAMP_IDS.length,
      recent: students.slice(0, 10).map((s) => ({
        avatar: s.avatar,
        joinedAt: s.createdAt,
        stampsEarned: (earnedByUser.get(s.id) || []).length,
      })),
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ error: 'Failed to load analytics summary' });
  }
});

// Decision tree route (integrated here for simplicity as it relates to user guidance)
router.post('/recommend-track', async (req, res) => {
  const { interests, previousExperience, timeCommitment } = req.body;

  if (!interests || !Array.isArray(interests)) {
    return res.status(400).json({ error: 'Interests array is required' });
  }

  try {
    const recommendation = recommendTrack({ interests, previousExperience, timeCommitment });
    res.json(recommendation);
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ error: 'Failed to generate recommendation' });
  }
});

export default router;

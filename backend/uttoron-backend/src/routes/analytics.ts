import { Router, Response } from 'express';
import { db } from '@/db';
import { analyticsEvents } from '@/db/schema';
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

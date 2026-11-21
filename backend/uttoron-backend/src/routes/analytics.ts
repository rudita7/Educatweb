import { Router, Response } from 'express';
import { dbAdmin } from '@/db'; // unauthenticated endpoint: the organization is derived from the user, below
import { analyticsEvents, users, organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
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
    // Stamp the event with the user's organization (or the default one for anonymous events)
    // so it is covered by the same row level security as everything else.
    const user = userId ? await dbAdmin.query.users.findFirst({ where: eq(users.id, Number(userId)), columns: { id: true, organizationId: true } }) : null;
    let organizationId = user?.organizationId;
    if (!organizationId) {
      const org = await dbAdmin.query.organizations.findFirst({ where: eq(organizations.slug, process.env.DEFAULT_ORG_SLUG || 'aim-initiative') });
      if (!org) return res.status(500).json({ error: 'Failed to log event' });
      organizationId = org.id;
    }
    await dbAdmin.insert(analyticsEvents).values({
      organizationId,
      userId: user ? user.id : null,
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

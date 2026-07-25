import { Request, Response, NextFunction } from 'express';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing user identification' });
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, Number(userId)),
    });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

// Reviewer-only endpoints (queue, feedback submission) — must run after `authenticate`.
export const requireReviewer = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'reviewer') {
    return res.status(403).json({ error: 'Forbidden: reviewer role required' });
  }
  next();
};

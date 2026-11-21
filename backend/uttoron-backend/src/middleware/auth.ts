import { Request, Response, NextFunction } from 'express';
import { dbAdmin, runInOrg } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    organizationId: number;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing user identification' });
  }

  try {
    // Pre-tenant lookup: we don't know the organization until we've found the user,
    // so this one query uses the owner connection (it selects by primary key only).
    const user = await dbAdmin.query.users.findFirst({
      where: eq(users.id, Number(userId)),
    });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      organizationId: user.organizationId,
    };

    // Everything downstream (the route handler and anything it calls) runs inside
    // one transaction scoped to this user's organization. Held open until the
    // response is done, then committed.
    await runInOrg(user.organizationId, () =>
      new Promise<void>((resolve) => {
        res.once('finish', resolve);
        res.once('close', resolve);
        next();
      })
    );
  } catch (error) {
    if (res.headersSent) { console.error('Request error after response:', error); return; }
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

// Reviewer-only endpoints (queue, feedback submission) - must run after `authenticate`.
export const requireReviewer = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'reviewer') {
    return res.status(403).json({ error: 'Forbidden: reviewer role required' });
  }
  next();
};
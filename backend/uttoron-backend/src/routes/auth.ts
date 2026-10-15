import { Router } from 'express';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const router = Router();
const SALT_ROUNDS = Number(process.env.PIN_SALT_ROUNDS) || 10;

// Total passports issued — a real count from the database, not a per-device
// localStorage tally, so it reads the same number on every device and
// doesn't reset when someone opens the site somewhere new or signs out.
router.get('/count', async (_req, res) => {
  try {
    const [row] = await db.select({ total: count() }).from(users).where(eq(users.role, 'student'));
    res.json({ count: row?.total ?? 0 });
  } catch (error) {
    console.error('Count error:', error);
    res.status(500).json({ error: 'Failed to count passports' });
  }
});

// Register new user with PIN
router.post('/register', async (req, res) => {
  const { username, pin, nickname, avatar } = req.body;

  if (!username || !pin) {
    return res.status(400).json({ error: 'Username and PIN are required' });
  }

  try {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPin = await bcrypt.hash(pin, SALT_ROUNDS);

    const [newUser] = await db.insert(users).values({
      username,
      pin: hashedPin,
      nickname: nickname ? String(nickname).slice(0, 60) : null,
      avatar: avatar ? String(avatar).slice(0, 30) : null,
    }).returning({ id: users.id, username: users.username, role: users.role, nickname: users.nickname, avatar: users.avatar });

    res.status(201).json({ user: newUser });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login with PIN
router.post('/login', async (req, res) => {
  const { username, pin } = req.body;

  if (!username || !pin) {
    return res.status(400).json({ error: 'Username and PIN are required' });
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or PIN' });
    }

    const isPinValid = await bcrypt.compare(pin, user.pin);
    if (!isPinValid) {
      return res.status(401).json({ error: 'Invalid username or PIN' });
    }

    res.json({
      message: 'Login successful',
      user: { id: user.id, username: user.username, role: user.role, nickname: user.nickname, avatar: user.avatar }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

export default router;
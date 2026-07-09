import { Router } from 'express';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const router = Router();
const SALT_ROUNDS = Number(process.env.PIN_SALT_ROUNDS) || 10;

// Register new user with PIN
router.post('/register', async (req, res) => {
  const { username, pin } = req.body;

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
    }).returning({ id: users.id, username: users.username });

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
      user: { id: user.id, username: user.username } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

export default router;

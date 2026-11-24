import { Router } from 'express';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, count, asc, and, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { authenticate, requireReviewer } from '@/middleware/auth';

const router = Router();
const SALT_ROUNDS = Number(process.env.PIN_SALT_ROUNDS) || 10;

// ---- Sign in by name -------------------------------------------------------
// Students choose a nickname when they make a passport and most cannot remember
// their passport number, so they can also sign in with that name + their PIN.
// Names are not unique, so the pair (name, PIN) is kept unique among students:
// register and reset-pin refuse a PIN another student with the same name already
// uses. If two accounts ever do share a name and PIN, login-by-name answers 409
// and the student signs in with their passport number instead.
const nameKey = (s: string) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');

async function sameNameStudents(name: string) {
  return db.query.users.findMany({
    where: and(eq(users.role, 'student'), sql`lower(regexp_replace(btrim(${users.nickname}), '[[:space:]]+', ' ', 'g')) = ${nameKey(name)}`),
  });
}

async function pinTakenByNamesake(name: string, pin: string, exceptUserId?: number) {
  for (const u of await sameNameStudents(name)) {
    if (u.id === exceptUserId) continue;
    if (await bcrypt.compare(pin, u.pin)) return true;
  }
  return false;
}

// A name is easy to guess, so slow down repeated wrong PINs for the same name.
const nameFailures = new Map<string, { fails: number; resetAt: number }>();
const MAX_NAME_FAILS = 10;
const NAME_FAIL_WINDOW_MS = 5 * 60 * 1000;
function nameLocked(key: string) {
  const a = nameFailures.get(key);
  if (!a) return false;
  if (Date.now() > a.resetAt) { nameFailures.delete(key); return false; }
  return a.fails >= MAX_NAME_FAILS;
}
function noteNameFailure(key: string) {
  const now = Date.now();
  const a = nameFailures.get(key);
  if (!a || now > a.resetAt) nameFailures.set(key, { fails: 1, resetAt: now + NAME_FAIL_WINDOW_MS });
  else a.fails++;
}

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

// Teacher's class list: every student passport, so a reviewer can load their
// class onto a shared laptop whose browser has lost its saved students (the
// device's own list lives in the browser and can be cleared). Reviewer-only;
// never returns PINs (they are stored hashed and are not needed here).
router.get('/students', authenticate, requireReviewer, async (_req, res) => {
  try {
    const rows = await db.query.users.findMany({
      where: eq(users.role, 'student'),
      columns: { id: true, username: true, nickname: true, avatar: true, createdAt: true },
      orderBy: asc(users.createdAt),
    });
    res.json(rows);
  } catch (error) {
    console.error('List students error:', error);
    res.status(500).json({ error: 'Failed to list students' });
  }
});

// Teacher resets a student's PIN (for a student who forgot it). PINs are stored
// hashed, so they can never be shown; the teacher chooses a new one and tells
// the student. Reviewer-only.
router.post('/students/:id/reset-pin', authenticate, requireReviewer, async (req, res) => {
  const id = Number(req.params.id);
  const pin = String(req.body?.pin ?? '');
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid student id' });
  if (!/^[0-9]{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
  try {
    const student = await db.query.users.findFirst({ where: and(eq(users.id, id), eq(users.role, 'student')) });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    if (student.nickname && await pinTakenByNamesake(student.nickname, pin, student.id)) {
      return res.status(409).json({ error: 'Another student with the same name already uses that PIN. Choose a different one.' });
    }
    await db.update(users).set({ pin: await bcrypt.hash(pin, SALT_ROUNDS) }).where(eq(users.id, id));
    res.json({ ok: true });
  } catch (error) {
    console.error('Reset PIN error:', error);
    res.status(500).json({ error: 'Failed to reset PIN' });
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

    const cleanNickname = nickname ? String(nickname).trim().replace(/\s+/g, ' ').slice(0, 60) : null;
    if (cleanNickname && await pinTakenByNamesake(cleanNickname, String(pin))) {
      return res.status(409).json({ error: `Another student called "${cleanNickname}" already uses that PIN. Please choose a different PIN.` });
    }

    const hashedPin = await bcrypt.hash(pin, SALT_ROUNDS);

    const [newUser] = await db.insert(users).values({
      username,
      pin: hashedPin,
      nickname: cleanNickname,
      avatar: avatar ? String(avatar).slice(0, 30) : null,
    }).returning({ id: users.id, username: users.username, role: users.role, nickname: users.nickname, avatar: users.avatar });

    res.status(201).json({ user: newUser });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Student sign-in by the name they chose + PIN (see the note at the top).
router.post('/login-by-name', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const pin = String(req.body?.pin ?? '');
  if (!name || !pin) {
    return res.status(400).json({ error: 'Name and PIN are required' });
  }
  const key = nameKey(name);
  if (nameLocked(key)) {
    return res.status(429).json({ error: 'Too many tries with that name. Please wait a few minutes and try again.' });
  }
  try {
    const matches = [];
    for (const u of await sameNameStudents(name)) {
      if (await bcrypt.compare(pin, u.pin)) matches.push(u);
    }
    if (matches.length === 0) {
      noteNameFailure(key);
      return res.status(401).json({ error: 'Invalid name or PIN' });
    }
    if (matches.length > 1) {
      return res.status(409).json({ error: 'Two students with that name have the same PIN. Sign in with your passport number instead.' });
    }
    nameFailures.delete(key);
    const u = matches[0];
    res.json({
      message: 'Login successful',
      user: { id: u.id, username: u.username, role: u.role, nickname: u.nickname, avatar: u.avatar, createdAt: u.createdAt }
    });
  } catch (error) {
    console.error('Login by name error:', error);
    res.status(500).json({ error: 'Failed to login' });
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
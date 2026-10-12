/**
 * Demo-environment seed script — run this ONLY against the separate demo
 * Supabase project / demo backend, never against production. Nothing here
 * touches real student data; every name below is synthetic.
 *
 * Usage:
 *   DEMO_API_BASE=https://your-demo-backend.onrender.com \
 *   DEMO_DECK_1=./demo-assets/sample-deck-draft.pptx \
 *   DEMO_DECK_2=./demo-assets/sample-deck-revised.pptx \
 *   pnpm exec tsx scripts/seed-demo-data.ts
 *
 * DEMO_DECK_1/2 should be two small, clearly-different-looking .pptx files
 * (e.g. one text-heavy, one with images and varied fonts) so the
 * feedback-stuck-tracking before/after numbers look real in a screenshot.
 * Any harmless .pptx works — content doesn't matter, only that the two
 * files differ in word count / image count / font count.
 */
import fs from 'fs';

const API = process.env.DEMO_API_BASE;
if (!API) { console.error('Set DEMO_API_BASE to the demo backend URL first.'); process.exit(1); }

const REVIEWERS = [
  { username: 'demo-teacher-amina', pin: '1111' },
  { username: 'demo-teacher-rahim', pin: '2222' },
];

// Eight clearly-synthetic student names — not modeled on any real student.
const STUDENTS = [
  'demo-student-tanvir', 'demo-student-nusrat', 'demo-student-farhan',
  'demo-student-mithila', 'demo-student-kabir', 'demo-student-priya',
  'demo-student-shuvo', 'demo-student-anika',
];
const STUDENT_PIN = '4321';

async function registerOrLogin(username: string, pin: string) {
  let res = await fetch(`${API}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin }),
  });
  let data = await res.json();
  if (!res.ok && /already exists/i.test(data.error || '')) {
    res = await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, pin }),
    });
    data = await res.json();
  }
  if (!res.ok) throw new Error(`${username}: ${data.error}`);
  return data.user.id as number;
}

async function submitDeck(studentId: number, lessonId: string, submissionType: string, deckPath?: string) {
  const form = new FormData();
  form.append('lessonId', lessonId);
  form.append('submissionType', submissionType);
  if (deckPath) {
    const buf = fs.readFileSync(deckPath);
    form.append('deckFile', new Blob([buf]), 'deck.pptx');
  }
  const res = await fetch(`${API}/api/submissions`, { method: 'POST', headers: { 'x-user-id': String(studentId) }, body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.id as number;
}

async function tag(reviewerId: number, submissionId: number, tagIds: string[], comment: string) {
  const res = await fetch(`${API}/api/submissions/${submissionId}/feedback`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': String(reviewerId) },
    body: JSON.stringify({ tagIds, comment }),
  });
  if (!res.ok) throw new Error(JSON.stringify(await res.json()));
}

async function promoteToReviewer(username: string) {
  // The actual promotion to role='reviewer' still needs createReviewer.ts
  // run against the demo DB directly (it's a DB write, not an API call) —
  // this script only registers the account; promote it right after with:
  //   pnpm exec tsx src/db/createReviewer.ts demo-teacher-amina 1111
  console.log(`Registered ${username} — now run: pnpm exec tsx src/db/createReviewer.ts ${username} <pin>`);
}

async function main() {
  console.log('--- Registering reviewers (promote these manually, see note below) ---');
  for (const r of REVIEWERS) { await registerOrLogin(r.username, r.pin); await promoteToReviewer(r.username); }

  console.log('--- Registering students ---');
  const studentIds: Record<string, number> = {};
  for (const name of STUDENTS) studentIds[name] = await registerOrLogin(name, STUDENT_PIN);

  const deck1 = process.env.DEMO_DECK_1;
  const deck2 = process.env.DEMO_DECK_2;
  if (!deck1 || !deck2) {
    console.log('DEMO_DECK_1 / DEMO_DECK_2 not set — skipping deck submissions. Set them and re-run to populate the growth-portfolio/metrics examples.');
  } else {
    console.log('--- Submitting + tagging decks for the first 3 students (shows the before/after) ---');
    const reviewerId = await registerOrLogin(REVIEWERS[0].username, REVIEWERS[0].pin);
    for (const name of STUDENTS.slice(0, 3)) {
      const sid = studentIds[name];
      const sub1 = await submitDeck(sid, 'lesson_9_checkpoint', 'file', deck1);
      await tag(reviewerId, sub1, ['structure-hard', 'visual-inconsistent'], 'Please simplify your slides and keep fonts consistent.');
      await submitDeck(sid, 'lesson_13_capstone', 'both', deck2); // capstone also needs a recording field in real usage — add one if your demo wants it to show as fully reviewable
      console.log(`  ${name}: touchpoint-1 tagged, capstone submitted (comparison will resolve once capstone is also tagged)`);
    }
  }

  console.log('\nDone. Remaining manual steps:');
  console.log('1. Run createReviewer.ts for each reviewer username above to set role=reviewer.');
  console.log('2. Sign in as a reviewer and tag the remaining pending submissions, including the capstones, to see the before/after.');
  console.log('3. Add a few typing-track results directly if you want that track represented too (no file upload needed — see typing.ts for the request shape).');
}

main().catch((err) => { console.error(err); process.exit(1); });

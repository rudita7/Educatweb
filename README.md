# Uttoron

A free, browser-based skills platform that teaches typing, spreadsheets, data accuracy and presentation
skills to students in Bangladesh — with **real human feedback built into the curriculum** instead of
auto-graded quizzes. Students work through interactive lessons, send real work (a typed result, a deck, a
recording) to a volunteer teacher at set checkpoints, and see the teacher's tagged feedback on their own
passport.

- **Live demo (synthetic data only):** https://uttoron-demo.netlify.app
- **Demo video (under 2 min):** https://youtu.be/6FZrlksfbbg
- **Status:** in active pilot with **50 students**, built in partnership with the **AIM Initiative Foundation** under a signed
  contract and proposal. The agreed plan is to scale to **200 students by April 2027**; the foundation intends to keep
  Uttoron as a permanent resource (this is stated explicitly in the contract and proposal).

---

## What's in it

| Track | Where | What it is |
|---|---|---|
| **Typing** | `uttoron-frontend/webapp/typing-lesson.html` | Two grade bands (6–9: six sessions; 4–5: five sessions), 20 practice phrases per session, an on-screen keyboard with finger-placement guidance, WPM/accuracy scoring, and a baseline-vs-latest comparison. Results go to a teacher for tagging. Works offline (see below). |
| **Spreadsheet Basics** | `webapp/spreadsheet-lesson.html` | Five guided steps on a live grid (enter data, `SUM`, `AVERAGE`, `MAX`, `MIN`). Each step is checked against what the student actually typed. |
| **Data Accuracy & QA** | `uttoron-frontend/track3/` | Four lessons plus a capstone ("A Day in the Records Department"): find errors, correct records, clean and validate data, run a QA project, then submit a quality report scored against an 80% pass mark. |
| **Presentation Skills** | `uttoron-frontend/track-presentation-skills/` | 13 lessons: practise on a built-in simulated PowerPoint ribbon, then repeat the steps in real PowerPoint. Three reviewer checkpoints — Lesson 9 (structure), Lesson 12 (spoken delivery) and Lesson 13 (capstone deck + recording). |
| **Spreadsheet Mastery** | `uttoron-frontend/spreadsheet-mastery/` | A deeper spreadsheet track — four lessons and a capstone covering formulas, lookups, sorting/filtering, data validation, conditional formatting and charts — built on eight engines with unit tests. *Not linked from the homepage yet.* |

The homepage shows eight stamps: the four tracks above plus four placeholders (communication, email, CV,
career) marked "coming soon". A stamp is earned when a student finishes every lesson in its track.

## The feedback loop

1. A student finishes a checkpoint and submits it.
2. A reviewer opens the **reviewer queue**, picks tags from a fixed vocabulary (e.g. *structure*, *visual
   design*, *pacing*, *vocal delivery*, *time management*; for typing: *accuracy*, *typing pacing*,
   *progress* — each tag is positive or constructive) and may add a 200-character comment.
3. The student sees the tags and comment on their dashboard and on their **Feedback Passport**.

Fixed tags keep feedback consistent and quick when one volunteer reviews many students. Around that loop:

- **Objective deck metrics.** For submitted `.pptx` files a Python script (`python-pptx`) extracts four
  deterministic counts — words/slide, bullets/slide, image-to-text ratio, distinct fonts. No AI, no scoring.
- **Before/after comparisons and growth portfolio.** The reviewer sees how a student's first deck compares with
  their capstone, plus recurring weakness patterns for that student and cohort-wide patterns.
- **Attempt history.** For typing, each attempt has a *Progress* panel listing every session in order with an
  overall first-to-latest line, so a reviewer judges growth, not one result.

## Built to cope with real conditions

- **Works offline.** If a typing result can't be sent (no connection), it is stored in IndexedDB on the device and
  sent automatically when the browser is back online. Only network failures are queued — a result the server
  rejects still fails loudly.
- **Passports work from any device.** A passport is a number plus a 4-digit PIN — no email or phone. Signing in on a
  second device restores the passport, and stamp progress is saved to the server and merged (a stamp is never lost
  by merging).
- **Real counters.** The "passports issued" count and the Analytics page read platform-wide totals from the backend
  (aggregates only — no names).
- **Accessibility pass.** Every page was checked with an automated contrast scan (WCAG AA, 4.5:1 for text) as part of a
  site-wide bug audit, and the low-contrast text it found was fixed.

## Architecture

```
Browser (static HTML / CSS / vanilla JS)  ──►  Express + TypeScript API  ──►  Postgres + file storage (Supabase)
 Netlify, no build step                        Render (Docker)                  tables + private bucket
                                                  └─ python-pptx subprocess for deck metrics
```

- **Frontend** — `uttoron-frontend/`: plain pages sharing a few scripts (`shared/backendBridge.js` talks to the API,
  `shared/offlineQueue.js` is the IndexedDB queue). Each track has its own folder of lessons and "engines" (pure
  logic modules: formula evaluation, fuzzy duplicate matching, undo/redo stack, rule validation, state machines…).
- **Backend** — `backend/uttoron-backend/`: Express 5 + Drizzle ORM. Passwords/PINs are hashed (`bcryptjs`).
  Submitted files go to a private Supabase Storage bucket and are served by short-lived signed URL.
- **Database** — Postgres with 10 tables (users, progress, submissions, submission metrics, feedback, tags, typing
  results and typing feedback, analytics events, …); migrations live in `src/db/migrations/`.
- **Why a custom backend rather than calling Supabase from the browser:** reviewer-only endpoints, signed URLs for
  private files and server-side deck analysis can't be done safely with a public client key alone.

Notable engines: Levenshtein-distance + Union-Find duplicate clustering (`track3/shared/engines/fuzzyMatchEngine.js`),
a command-pattern undo/redo stack, a record review state machine, a rule engine, and the spreadsheet formula,
fill, sort/filter, validation, conditional-format and error-injection engines in `spreadsheet-mastery/engines/`.

## Repository layout

```
backend/uttoron-backend/   API (src/routes, src/db, scripts/ for deck metrics + demo seed/reset)
uttoron-frontend/
  webapp/                  homepage + passport dashboard, typing lesson, spreadsheet lesson, hub pages, analytics
  track3/                  Data Accuracy & QA (4 lessons + capstone)
  track-presentation-skills/  13 lessons, reviewer queue, Feedback Passport
  spreadsheet-mastery/     4 lessons + capstone, engines + unit tests
  shared/                  API bridge, offline queue, API base URL config
docs/                      build-process notes
.github/workflows/         keep-alive for the demo environment
```

## Run it locally

**Backend** (Node 22, pnpm, Python 3 for deck metrics):
```bash
cd backend/uttoron-backend
pnpm install
pip3 install -r scripts/requirements.txt
cp .env.example .env          # DATABASE_URL, PORT, PIN_SALT_ROUNDS, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — never commit it
# apply the SQL in src/db/migrations/ (0000 → 0004) to your Postgres, then:
pnpm exec tsx src/db/seed.ts                                   # the fixed tag vocabulary
pnpm exec tsx src/db/createReviewer.ts <username> <pin>        # a reviewer account
pnpm run dev                  # http://localhost:3000
```

**Frontend** (any static server; the API address is one line in `shared/apiConfig.js`, default `http://localhost:3000`):
```bash
cd uttoron-frontend
python3 -m http.server 8910   # then open http://localhost:8910/webapp/index1.html
```

**Tests** — the spreadsheet engines have standalone unit tests (90 passing tests across eight files):
```bash
cd uttoron-frontend/spreadsheet-mastery
for f in engines/*.test.js; do node "$f"; done
```

## Deployment and the demo environment

- **Frontend:** a static site on Netlify — publish directory `uttoron-frontend`; `_redirects` sends `/` to the homepage.
- **Backend:** a Docker web service on Render (`backend/uttoron-backend/Dockerfile`), configured through the
  environment variables above.
- **Demo:** a *separate* Netlify site + Render service + Supabase project holding synthetic data only, so reviewers can
  click around without touching real students' records. `scripts/seed-demo-data.ts` fills it, `scripts/reset-demo.sql`
  wipes it, and `.github/workflows/demo-keepalive.yml` pings it daily so free tiers don't sleep before it's viewed.
  (The first request after a long idle can take 30–60 s while Render wakes up.)

## API at a glance

| Area | Endpoints |
|---|---|
| Passports | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/count` |
| Progress | `GET /api/progress`, `POST /api/progress/sync` |
| Presentation review | `POST /api/submissions`, `GET /api/submissions/mine`, `GET …/queue` *(reviewer)*, `POST …/:id/feedback` *(reviewer)*, `GET …/comparisons`, `…/growth-portfolio`, `…/weakness-patterns`, `…/weakness-patterns/cohort` *(reviewer)*, `GET …/tags/list` |
| Typing review | `POST /api/typing/results`, `GET …/mine`, `GET …/queue` *(reviewer)*, `POST …/:id/feedback` *(reviewer)*, `GET …/comparisons`, `GET …/tags/list` |
| Analytics | `GET /api/analytics/summary` (public aggregates), `POST /api/analytics/log`, `POST /api/analytics/recommend-track` |

## Known limitations

Stated plainly, because this is a prototype:

- **Authentication is minimal.** After sign-in the browser identifies itself with an `x-user-id` header and the server
  checks that account's role (e.g. reviewer-only routes). That was enough to build and pilot the system, but it is not a
  replacement for signed session tokens; replacing it is the first hardening step planned before scaling to 200 students.
- **PINs are 4 digits** (hashed on the server), and the passport PIN is also kept in the browser's local storage on the
  device used to sign in.
- **Four stamps are placeholders** (communication, email, CV, career).
- **Spreadsheet Mastery** is built and tested but not yet linked from the homepage.
- **Analytics stamp counts** update when a student opens their passport dashboard, which is when progress is saved to
  the server.
- The demo environment is the one verified end to end from outside; the pilot runs on a separate production deployment.

## Documentation and credits

- `docs/BUILD_PROCESS.md` — build timeline and two real dead ends (a native-dependency build problem and a stored-XSS fix).
- `AI_USAGE.md` — an account of where AI tools were used in building this project and which files they affected.
  The commit history is left intact and unmodified as the build record.
- **Partnership.** Uttoron was built in partnership with the **AIM Initiative Foundation** under a signed contract and
  proposal, and is intended to remain in use there as a permanent resource. The site footer credits the foundation.
- **License.** Not licensed for reuse yet (all rights reserved). This may change once the project has scaled and other
  foundations are involved.

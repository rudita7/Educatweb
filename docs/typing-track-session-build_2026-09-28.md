# Uttoron — Typing Track Session Build + Student Feedback View

**Developer build log.** Written after reading and editing the actual repo at
`github.com/rudita7/Educatweb` (backend: `backend/uttoron-backend`, frontend:
`uttoron-frontend`). This documents exactly what changed in this pass, why,
and what's still missing — read it before touching any of the files below.
It follows on directly from `typing_track_tagging_feature_spec.md` (the
tagging/feedback backend that spec describes was already built before this
pass started; this pass is what comes after it).

**Revision note:** this pass shipped in two rounds — the first built the
Grade 6-9 typing track and the student feedback view; a same-day follow-up
added the Grade 4-5 typing track alongside it. This document describes the
final, combined state, not the intermediate Grade-6-9-only version — if
you're diffing against an earlier copy of this file, the Grade 6-9
checkpoint IDs were renamed (`typing_s1_baseline` → `typing_g69_s1_baseline`,
etc.) in the second round for symmetry with the new Grade 4-5 IDs. Nothing
was ever deployed under the old names, so this was a safe rename, not a
migration.

---

## 0. What was asked, and what existed before

Three things were asked for in one pass, plus a same-day follow-up:

1. Put the curriculum's actual typing session content into the typing
   lesson page (it was one static lesson with 4 canned phrases, unrelated
   to the curriculum).
2. Document the build, developer-ready, the way this repo's other spec
   files are written.
3. Give a student somewhere to see the feedback a reviewer left them — this
   was flagged as **missing from the live site**, and it was: the backend
   (`GET /api/typing/mine`, `GET /api/submissions/mine`) and the reviewer
   side (`reviewer.js`) both existed and worked, but the only page that ever
   displayed a student's own feedback back to them was
   `track-presentation-skills/passport/index.html` — a separate page,
   presentation-only, that the main site (`webapp/index1.html`) never linked
   to. A student finishing a typing checkpoint had no way to find out a
   reviewer had responded, ever.
4. (Follow-up) Cover Grade 4-5 too, not just Grade 6-9.

Before this pass, `webapp/typing-lesson.html` was a single lesson: 4 hardcoded
sentences, a hand diagram, a virtual keyboard, and one checkpoint
(`checkpointId: 'typing_checkpoint'`) submitted once at the end, with no
concept of grade level at all. The Phase 0–2 instrumentation from
`typing_track_tagging_feature_spec.md` was real and working; there just
wasn't a real *track* underneath it yet — the spec said as much explicitly
(§2: "does not cover … rebuilding the typing lesson into a multi-week
track … that's the curriculum document's job"). This pass is that
follow-up job, for both grade bands the curriculum defines.

---

## 1. Typing session content — where it came from, and why two tracks

The curriculum has separate Month 1 content per grade band:

- **Grade 6-9 — "Typing Fluency & File Management"** (8 curriculum
  sessions). Chosen first, deliberately: it matches Rudi's own prior
  decision to pilot session-based, in-platform curriculum delivery on the
  Grade 6-9 typing track before extending elsewhere (see the project's
  `decisions-and-learnings.md`).
- **Grade 4-5 — "Keyboarding & Computer Basics"** (also 8 curriculum
  sessions, younger-skewed: mouse control, home row from scratch, simpler
  words). Added in the follow-up round.

Each grade band's curriculum Month 1 has 8 sessions, but **not every
session involves a measured typing check** — some are file management,
formatting, or (Grade 4-5 only) pure hardware/mouse basics with no typed
text at all. Only the sessions with a real "type this and we log
WPM/accuracy" moment became a checkpointed session on this page:

| | Grade 6-9 (6 of 8) | Grade 4-5 (5 of 8) |
|---|---|---|
| Included | 1, 2, 3, 5, 7, 8 | 2, 3, 5, 7, 8 |
| Excluded, and why | 4 (nested folders/renaming — real OS task), 6 (file search + keyboard shortcuts — not a typing speed check) | 1 (hardware ID + power on/off — no typed text), 4 (files/folders — real OS task), 6 (bold/italic/font-size formatting — the check is "did you format it right," not typing speed) |

This is why the on-page session numbering has gaps (1, 2, 3, 5, 7, 8 for
Grade 6-9; 2, 3, 5, 7, 8 for Grade 4-5) rather than running 1–6/1–5 — it's
intentional, mirroring the curriculum's own numbering so a teacher running
the physical curriculum and a student on the page are always talking about
the same "Session 5." Every excluded session is called out by name in the
neighboring included session's `curriculumNote` (e.g. Grade 4-5 Session 7's
note: "The bold/italic formatting half of this session happens in your
word processor, not on this page").

Per-session phrase sets were written to match each session's stated skill
focus (see `SESSIONS_G69`/`SESSIONS_G45` in §2), not copied verbatim from
the curriculum (the curriculum describes *what kind* of typing practice
each session covers — e.g. "home-row-only words" for Grade 4-5 Session 3 —
it doesn't always supply exact sentences; where it does list example words,
e.g. Grade 4-5 Session 3's "dad, sad, flask, jazz, fall," those exact words
were reused). If Rudi wants different or longer phrase sets, that's a
content edit to the relevant `SESSIONS_*` array only — nothing else depends
on the exact wording.

**No `grade` field was added anywhere in the schema or backend.** Per the
tagging spec's own §0 note, the codebase has no concept of student grade
level at all, and adding one just for this would have been new
infrastructure for a need the rest of the platform doesn't have. Instead,
which grade band a student sees is a **purely client-side choice** (§2's
grade-band picker) — the two tracks are just two parallel sets of
checkpoint IDs (`typing_g69_*` / `typing_g45_*`), namespaced so a reviewer
can tell them apart in the queue without any schema change.

---

## 2. File-by-file changes

### `uttoron-frontend/webapp/typing-lesson.html`

The single `LESSON_DATA` object was replaced with two session arrays —
`SESSIONS_G69` (6 entries) and `SESSIONS_G45` (5 entries) — plus
`GRADE_BANDS` (maps `'g69'`/`'g45'` to `{ label, subtitle, sessions }`) and
a merged `SESSIONS_BY_ID` lookup (safe to merge because every id is
prefixed by band, e.g. `'g69-s1'` vs `'g45-s2'`). Each session entry:

```js
{
    id: 'g69-s1', number: 1,
    checkpointId: 'typing_g69_s1_baseline',
    title: 'Typing Baseline & Touch-Typing Refresher',
    objective: '...',        // shown as the page subtitle while doing this session
    curriculumNote: '...',   // shown smaller, under the objective, on the session picker
    isBaseline: true,        // one session per band — the one Final compares against
    isFinal: true,           // one session per band — triggers the baseline-comparison card (§ below)
    phrases: [ /* 4 sentences */ ]
}
```

Structural additions:

- **A grade-band picker screen** (`renderGradeBandPicker()`) is now the
  very first thing a student sees: two cards, "Grade 6-9" and "Grade 4-5,"
  each showing its subtitle and session count. The choice is saved to
  `localStorage` as `typingGradeBand:<passport num>` (`getSavedGradeBand()`
  / `saveGradeBand()`) so a returning student skips straight to their
  session picker; a **"Switch grade"** button on the session picker goes
  back to this screen.
- **A session picker screen** (`renderSessionPicker()`), scoped to whichever
  band is active, shown after the band is chosen. Lists that band's
  sessions with their objective/curriculum note and a Start/Redo button per
  session, so a student can see the whole track and pick up where they left
  off — mirrors how `track-presentation-skills` exposes its lessons as a
  real sequence rather than one blob.
- **Per-session completion tracking**, separate from the existing
  `progress.typing` boolean stamp (which still means "started typing at
  all," for the main dashboard grid, and is untouched): a new localStorage
  key `typingSessions:<passport num>` holds `{ sessionId: true, ... }`, read
  by `getSessionProgress()` / written by `markSessionCompleted()`. Since
  session ids are unique across both bands, this one key covers both
  without collision.
- **`renderTypingLesson()`** now checks `currentGradeBand` first (falls
  back to the band picker), then `currentSessionId` (falls back to the
  session picker), then looks the session up in `SESSIONS_BY_ID`. It shows
  the session's `objective` in the header and has a **"← All sessions"**
  button back to the picker. The phrase-by-phrase typing mechanics
  (character highlighting, virtual keyboard, finger-placement diagram,
  WPM/accuracy instrumentation) are **completely unchanged** from the
  original single-lesson version — that code was already generic
  per-phrase logic, it just now runs against whichever session's `phrases`
  array is active.
- **`submitCheckpointToBackend(checkpointId)`** takes the session's own
  checkpoint id as a parameter (instead of a hardcoded single id), and
  returns `{ backendUid, combined }` on success — needed for the baseline
  comparison below.
- **`showCompletionScreen(session, submitOutcome)`** looks up "next
  session" and "the baseline session" from `GRADE_BANDS[currentGradeBand]
  .sessions` (not a single global array), so a Grade 4-5 student's "next
  session" button and baseline comparison both stay inside Grade 4-5, and
  likewise for Grade 6-9. Shows which session just finished, a **"Session
  N+1 →"** button to go straight into the next one, an "All sessions"
  button, and — **only on that band's Final session** — a
  baseline-comparison card.

### The baseline comparison (small feature, same for both bands)

When a student finishes their band's Final session, the page finds that
band's `isBaseline` session and calls
`TypingStore.listMine(backendUid, baselineSession.checkpointId)` — the
student's **own** results endpoint, which needs no reviewer tag — pulls
their oldest baseline attempt, and shows a WPM/accuracy before → after card
right on the completion screen. This directly implements the curriculum's
own final-session assessment instruction ("compare to your baseline")
without waiting on the (optional, Phase 4) `getComparisons` /
before-after-tracking feature, which only surfaces *reviewed* attempts and
would often show nothing if a reviewer hasn't caught up yet. If Rudi later
wants the reviewer-tagged comparisons too (Phase 4 from the tagging spec is
still unbuilt in the UI — the backend function exists,
`getTypingComparisonsForStudent` in `typingProgressTracking.ts`, but
nothing calls it from any page), that's a separate, additive piece of work,
not a replacement for this.

### `backend/uttoron-backend/src/routes/typing.ts`

`VALID_CHECKPOINT_IDS` changed from a single value to 11 (6 for Grade 6-9,
5 for Grade 4-5):

```ts
const VALID_CHECKPOINT_IDS = [
  'typing_g69_s1_baseline',
  'typing_g69_s2_full_keyboard',
  'typing_g69_s3_speed',
  'typing_g69_s5_speed_naming',
  'typing_g69_s7_real_world',
  'typing_g69_s8_final',
  'typing_g45_s2_baseline',
  'typing_g45_s3_home_row',
  'typing_g45_s5_beyond_home_row',
  'typing_g45_s7_paragraph',
  'typing_g45_s8_final',
] as const;
```

**No database migration needed** — `checkpointId` on `typing_results` is a
plain `text` column (see `schema.ts`); this array is an
application-level allow-list checked in the `POST /results` handler, not a
DB constraint. **This file must be redeployed to the backend for the new
IDs to be accepted** — until it is, every `POST /api/typing/results` call
from the rebuilt frontend will fail its `checkpointId` validation (400
error), because the currently-deployed backend still only knows
`'typing_checkpoint'`. See §5 for deploy order.

`getTypingComparisonsForStudent` (`typingProgressTracking.ts`) needed no
changes — it already compares any result to that student's chronologically
next result regardless of checkpointId, so it works the same (and is
arguably more meaningful now) across different sessions, not just redos of
one lesson.

### `uttoron-frontend/webapp/typingResultStore.js`

`CHECKPOINT_LABELS` updated from the single `typing_checkpoint` entry to
one label per session across both bands, prefixed for quick scanning in
the reviewer queue (`typing_g69_s1_baseline` → `'G6-9 · Session 1 ·
Baseline'`, `typing_g45_s2_baseline` → `'G4-5 · Session 2 · Home Row
Introduction'`, etc.) — this is what `reviewer.js`'s existing
`TypingStore.CHECKPOINT_LABELS[r.checkpointId] || r.checkpointId` already
reads to label queue cards, so **the reviewer queue picks up all the new
session names automatically; `reviewer.js` itself needed no changes** for
either grade band.

### `uttoron-frontend/webapp/index1.html` — new "Reviewer Feedback" section

Added to the existing dashboard (`#view-dashboard`), directly below the
stamp grid. (Unaffected by the Grade 4-5 follow-up — this section already
called `TypingStore.listMine(backendUid)` with no checkpointId filter, so
it picks up results from both grade bands automatically.)

- Four new script tags, loaded before the page's own inline script:
  `../shared/apiConfig.js`, `../shared/backendBridge.js`,
  `../track-presentation-skills/engines/submissionStore.js`,
  `typingResultStore.js`. (Load order matters: `backendBridge.js` must
  come before the two store files, which both read `global.Backend` at
  load time.)
- `renderFeedbackSection()`: identifies the student's backend account
  (`Backend.identify`, same bridging every other track uses — no separate
  sign-in), then fetches `PS.submissionStore.listMine(backendUid)` and
  `TypingStore.listMine(backendUid)` **unfiltered** (no lessonId/checkpointId
  arg — both functions support this, returning everything across every
  lesson/session/band), and renders one card per submission/result: label,
  submitted date, reviewed/pending status, and — once reviewed — the tags
  and comment.
- Card markup is fully self-contained/inline-styled (reusing this page's own
  `--ink`/`--teal`/`--marigold`/`--coral` CSS variables, which are the exact
  same palette `track-presentation-skills` and `typing-lesson.html` use) —
  deliberately **not** pulling in `presentationSkills.css`, since that
  stylesheet has its own page-wide rules that risked colliding with
  `index1.html`'s existing layout. `passport.js`'s card structure was the
  model, but the CSS classes it depends on (`.tag-chip`, `.reviewer-comment`)
  were not reused for that reason.
- Failure modes are handled explicitly, not just left to throw: no session
  → section doesn't render at all (dashboard already requires a session);
  network/account-bridging failure → a plain "Couldn't connect" message with
  the actual error, not a blank space; no submissions yet → a plain
  "Nothing submitted yet" message, not an empty section that looks broken.

This is intentionally the **one place** a student checks feedback across
every track that has a feedback system, rather than adding a second,
typing-only mini-passport page next to the existing presentation-only one.
The existing `track-presentation-skills/passport/index.html` page still
exists and still works exactly as before — nothing about it was touched or
removed, it's just no longer the only place this information shows up.

---

## 3. What this pass does NOT cover (honest gaps)

- **File-management and formatting sessions** (Grade 6-9 Sessions 4 & 6;
  Grade 4-5 Sessions 1, 4 & 6) — not typing exercises, not attempted here;
  the site currently has no page at all for hands-on file management or
  word-processor-formatting practice. If that's wanted, it's new scope,
  not an extension of this page.
- **Spreadsheet and Data Accuracy tracks have no feedback system at all** —
  the "Reviewer Feedback" section on `index1.html` only shows Presentation
  Skills and Typing because those are the only two tracks with a real
  backend submission/feedback pipeline. Finishing a Spreadsheet or Data
  Accuracy lesson still only sets a local `progress` stamp.
- **Phase 4 (reviewer-tagged before/after comparisons) is still not surfaced
  anywhere in the UI** — the backend function
  (`getTypingComparisonsForStudent`) exists and works, `getComparisons` is
  wired up in `typingResultStore.js`, but no page calls it. The baseline
  card in §2 covers the "compare to your own baseline" need using a
  simpler, always-available path (`listMine`, no reviewer tag required)
  instead.
- **`track-presentation-skills/passport/index.html` was not merged into or
  redirected to `index1.html`'s new feedback section** — both now exist,
  showing overlapping (presentation) data through two different UIs. Worth
  deciding later whether the old page should redirect to the dashboard, but
  changing/removing an existing page wasn't part of what was asked here.
- **No actual `grade` field anywhere** (see §1) — the grade-band picker is
  a per-visit client-side choice with no server-side memory of which band
  a given student "is." A student (or a curious sibling) can freely switch
  bands and do both; nothing prevents or flags that. If Rudi wants a
  student locked to one band once chosen, or wants a teacher to assign it,
  that's a real schema change (a `grade` field on `users`), not a
  frontend-only fix.

---

## 4. Testing performed

No test framework exists in this repo (`package.json` has none), so this
was verified with a headless-browser smoke test (Playwright, Chromium)
rather than unit tests, across both rounds of this pass:

- `typing-lesson.html`: loaded the page, confirmed the grade-band picker
  renders both bands correctly; confirmed each band's session picker shows
  the right session count and curriculum text; ran a full session (typed
  all 4 phrases via real keyboard events) in both Grade 6-9 (Session 1)
  and Grade 4-5 (Session 2), confirming `localStorage` correctly records
  `typingSessions:<num>` and `progress:<num>` in each case, and that the
  completion screen's "Session N →" button correctly stays within the
  chosen band; confirmed grade-band choice persists across a page reload
  (`typingGradeBand:<num>`); ran Grade 6-9's Session 1 → Session 8 in one
  pass to exercise the "next session" chain and the final-session
  completion screen; confirmed zero console/page errors throughout.
- `index1.html`: loaded the dashboard with a seeded local passport,
  confirmed the "Reviewer Feedback" section renders and degrades cleanly
  when the backend is unreachable (this sandbox can't reach
  `uttoron-backend.onrender.com` — an environment limitation of where this
  was built, not a bug); then mocked `Backend.identify`,
  `PS.submissionStore.listMine`, and `TypingStore.listMine` with realistic
  sample responses (a reviewed presentation checkpoint with tags + comment,
  a pending one, a reviewed typing session) to confirm the actual card
  layout, grouping, tag chips, and comment styling render correctly — they
  do.
- Both files' inline `<script>` blocks were extracted and run through
  `node --check` for syntax validation after every round of edits.

**Not tested**: an actual round trip against the live, deployed backend
(not reachable from this environment) — the reviewer queue's typing tab
(`reviewer.js`) picking up the new checkpoint IDs and G6-9/G4-5-prefixed
labels, or a real reviewer tagging a session-checkpointed result end to
end for either band. Once deployed, do at least one real submit → tag →
student-sees-it pass by hand, for both grade bands, before calling this
done.

---

## 5. Deploy order

This repo has no `render.yaml`/CI config committed — Render and Netlify are
presumably both set to auto-deploy on push to `main` (matching the existing
`apiConfig.js` pointing at `uttoron-backend.onrender.com` and the site
being live on Netlify already). Given that:

1. **Push the backend change first** (`routes/typing.ts`). Until it's live,
   the old backend still only accepts `checkpointId: 'typing_checkpoint'`.
2. **Then push the frontend changes** (`typing-lesson.html`,
   `typingResultStore.js`, `index1.html`). If the frontend goes out before
   the backend, students hitting the rebuilt typing page will get a 400 on
   submit until the backend catches up — brief and self-healing once both
   are live, but avoidable by ordering the pushes.
3. No new environment variables, no new dependencies, no migration to run.

---

## 6. File manifest

| File | Change |
|---|---|
| `backend/uttoron-backend/src/routes/typing.ts` | `VALID_CHECKPOINT_IDS`: 1 → 11 checkpoint ids (6 Grade 6-9 + 5 Grade 4-5) |
| `uttoron-frontend/webapp/typingResultStore.js` | `CHECKPOINT_LABELS`: 1 → 11 labels, `G6-9 ·`/`G4-5 ·` prefixed |
| `uttoron-frontend/webapp/typing-lesson.html` | Single lesson → grade-band picker → per-band session picker → 6-or-5-session track + baseline comparison |
| `uttoron-frontend/webapp/index1.html` | New "Reviewer Feedback" dashboard section + 4 new script tags (covers both bands automatically, no changes needed for the follow-up) |

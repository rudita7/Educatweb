# Build timeline & process notes

Extracted from commit history. Dates are commit dates, not necessarily when the underlying work
happened (see note on bulk uploads below). AI assistance is described in `AI_USAGE.docx`; the
commits Claude authored are listed by `git log --author=Claude`.

## Timeline

**Jul 5–15, 2026 — initial build.** Core site structure, the spreadsheet-mastery track's core
engines (fuzzy-match reconciliation using Levenshtein distance + Union-Find for grouping likely
duplicate entries, a command-pattern undo/redo stack, a review state machine), early typing/data
tracks. Pushed via GitHub's web upload interface (commit messages read "Add files via upload" —
GitHub's own default text for that method, not a custom message), so there's no granular
per-feature history for this period; it arrived as a handful of bulk commits.

**Jul 25–28, 2026 — presentation-skills track + real backend.** The 13-lesson presentation-skills
track, a complete rewrite from a local-storage-only submission system to a real Express/Postgres
backend (role-based auth, Supabase Storage for files, a Python subprocess for deck-metric
extraction), and the deployment to Render + Netlify. This is also where the project's first real
security hardening happened — see "Dead end #1" below.

**Aug 2026 — official launch.** The project launched officially in August 2026, in partnership with the
AIM Initiative Foundation (the partnership itself began in July).

**Sep 27–28, 2026 — typing-track feedback.** Extended the same reviewer/feedback system to the
typing track (two grade bands), plus a stored-XSS fix in the dashboard — see "Dead end #2."

**Oct 11–16, 2026 — demo environment, offline sync and cross-device passports.**
- *Oct 11* (`90096cf`): demo-environment tooling — a keep-alive workflow, a demo reset script, a synthetic-data seed
  script — and the first version of this document.
- *Oct 12* (`eca12a8`): offline sync for the typing track — a result that cannot be sent is stored in the browser
  (IndexedDB) and sent automatically when the connection returns.
- *Oct 15* (`d062603`, `7fa0cd5`, `7cf582d`, `83cbdfb`): a per-student progress-history view in the reviewer's typing
  queue; a demo-only option to shorten typing sessions for recording; passports that work from any device (new
  `nickname`/`avatar` columns, migration `0004`); and cross-device stamp sync plus a server-side passport counter.
- *Oct 16* (`9017b4c`): the AIM Initiative Foundation logo in the homepage footer.

**From Oct 17, 2026 — site-wide audit (on the `demo` branch).** An automated contrast scan of every page
(185 low-contrast findings, all fixed), a Lesson 12 self-review that could not be completed, two stamps that could
never be earned, stricter checks in the spreadsheet lesson, a platform-wide Analytics endpoint and completion
badges on the hub pages. These fixes are on the `demo` branch, which the demo site runs; they are not merged into
`main`, which is the code the pilot runs.

## Early prototype vs. current version

The clearest before/after in this repo is the presentation-skills submission system:

- **Early version**: submissions stored client-side only (IndexedDB), no real reviewer could see
  another student's work from a different device, and "feedback" was entirely local. This
  version was iterated on locally during development but was replaced before it was ever
  committed to this repository — it doesn't exist in git history, only in this description.
- **Current version**: submissions go through a real backend, are stored in Supabase (private
  bucket, signed URLs, role-gated reviewer access), and a reviewer on a different device/account
  sees the same queue a student submitted to.

## Dead end #1: the deployment that wouldn't build

The Jul 25–28 commit history includes five commits explicitly labeled `TEMP:` — these were
deliberate, successive isolation steps to find why the Render deployment kept failing (a
minimal hello-world server, then the real dependency set, then the real build pipeline, each
tested before moving to the next). The root causes, found in that order:

1. A newer `pnpm` version blocks native-module build scripts (like `bcrypt`'s compiled addon) by
   default unless explicitly allowlisted — this had to be configured in `pnpm-workspace.yaml`,
   not the older (and now-deprecated) `package.json` field some documentation still references.
2. Even after that fix, `bcrypt`'s native compile step was still a recurring source of
   environment-specific failures (it behaves differently depending on the exact OS/architecture
   it's compiled on). The actual fix was architectural, not configuration: swap `bcrypt` for
   `bcryptjs`, a pure-JavaScript implementation with no native compilation step at all, removing
   the entire class of problem rather than continuing to patch around it.

## Dead end #2: a real security bug, found and fixed

Commit `09e9bb1` fixes a stored XSS vulnerability in the dashboard's Reviewer Feedback section —
teacher-submitted comment text was being rendered without escaping, meaning a comment containing
HTML/script content would execute in a student's browser when they viewed their feedback. Fixed
by escaping the text before rendering. This is exactly the kind of bug that's easy to introduce
when building a feature quickly (render user-supplied text, forget to escape it) and a good
example of why a second security pass matters even on a small internal tool.

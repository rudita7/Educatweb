-- Demo environment reset script. Run this against the DEMO Supabase project
-- only — never against production. Restores a clean slate so reviewers
-- clicking around doesn't leave the demo in a messy state for the next
-- person. Safe to run repeatedly.
--
-- Usage: paste into the demo project's Supabase SQL Editor, or:
--   psql "$DEMO_DATABASE_URL" -f scripts/reset-demo.sql

TRUNCATE TABLE typing_feedback, typing_results, feedback, submission_metrics, submissions, progress, analytics_events RESTART IDENTITY CASCADE;

-- Deliberately NOT truncating `tags` or `users` — tags are fixed taxonomy
-- (reseed separately with seed.ts if ever needed), and users should be
-- re-registered via seed-demo-data.ts after this, since PINs are hashed and
-- can't be restored from a dump without re-registering.
TRUNCATE TABLE users RESTART IDENTITY CASCADE;

-- After running this, re-run:
--   pnpm exec tsx src/db/seed.ts            (tags — only needed once, not per-reset)
--   pnpm exec tsx scripts/seed-demo-data.ts  (synthetic students/teachers/submissions)

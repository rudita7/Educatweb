# Multi-tenancy: keeping each NGO's students separate

Uttoron is one application serving more than one partner organization. The rule is simple:
**a signed-in user of organization A must never be able to see or change organization B's data — even
if a route handler forgets to check.** That is enforced by Postgres itself (Row Level Security), not by `if`
statements in the API.

## The three layers

| Layer | What it is | Holds real student data? |
|---|---|---|
| Public landing page | `uttoron-frontend/landing/index.html` (served at `/about`). Static HTML, no scripts, no API calls. | No |
| Demo / sandbox | Separate Netlify + Render + Supabase project seeded with invented students (`scripts/seed-demo-data.ts`). | No — synthetic only |
| Production | The real pilot. Every row belongs to an organization; RLS isolates them. | Yes |

## How the isolation works

- `organizations` table: one row per partner (`slug`, `name`).
- Every table that holds student/teacher data has `organization_id integer NOT NULL REFERENCES organizations(id)`
  (users, progress, analytics_events, submissions, feedback, submission_metrics, typing_results, typing_feedback).
  `tags` is a shared vocabulary and stays global.
- Each of those tables has RLS enabled with one policy, `tenant_isolation`, for the `uttoron_app` role:
  `organization_id = current_setting('app.current_org')`, both for reading (`USING`) and writing (`WITH CHECK`).
- `organization_id` has a column default that reads the same setting, so route code never has to pass it:
  an insert is stamped with the current organization, and the policy rejects any attempt to write another one.
- Per request, `authenticate` (src/middleware/auth.ts) looks up the user, then runs the rest of the request
  inside one transaction on the `uttoron_app` role with `set_config('app.current_org', <id>, true)`.
  The `true` makes it transaction-local, so a pooled connection can't carry one tenant into the next request.
- If no organization is set, the policy matches nothing: the failure mode is "empty result", not "everything".

Two database handles (src/db/index.ts):

- `db` — restricted role, RLS enforced. Used by every route handler and helper in `src/lib`.
- `dbAdmin` — owner role, bypasses RLS. Used only where there is no tenant yet: login, register, the
  user-by-id lookup inside `authenticate`, `POST /api/analytics/log`, and the one-off admin scripts.

## Rolling it out (two steps, no downtime)

**Step 1 — apply the migration. Changes no behaviour.**

1. Back up the database.
2. Apply `src/db/migrations/0006_multi_tenant_rls.sql`. It creates `organizations`, inserts
   `aim-initiative`, adds `organization_id` to every tenant table, back-fills every existing row into
   `aim-initiative`, enables RLS, and creates the `uttoron_app` role (no login yet).
3. Deploy this code. With `DATABASE_URL_APP` unset the API still connects as the owner role, so RLS is not
   yet in effect, and logs a warning saying so.

**Step 2 — turn enforcement on.**

1. Give the role a password (never put it in a migration):
   ```sql
   ALTER ROLE uttoron_app LOGIN PASSWORD '<long random password>';
   ```
2. On Render set `DATABASE_URL_APP` to the same connection string as `DATABASE_URL`, but with user
   `uttoron_app` and that password. (On Supabase, if you use the pooler the username is `uttoron_app.<project-ref>`;
   use the session or direct connection, or the transaction pooler — `set_config(..., true)` is safe in all of them.)
3. Redeploy. The startup warning disappears. Run the isolation test (below) against a staging copy first.

## Onboarding a new NGO

```sql
INSERT INTO organizations (slug, name) VALUES ('example-ngo', 'Example NGO');
```
```bash
pnpm exec tsx src/db/createReviewer.ts <username> <pin> example-ngo     # their first teacher
```
Students join an organization when their sign-up request includes `"organization": "example-ngo"`
(`POST /api/auth/register`); without it they join `DEFAULT_ORG_SLUG`. Give each NGO a link that passes its slug.

## Testing it

`scripts/test-tenant-isolation.ts` creates two throwaway organizations and checks, through the real API
*and* directly in the database, that: reviewers see only their own organization's queue; feedback on another
organization's submission is refused; an unfiltered `SELECT *` returns only the session's organization; no
organization set returns nothing; cross-organization INSERT/UPDATE/DELETE are blocked; the app role cannot
read `organizations`; and the organization setting does not leak between pooled uses. Run it against a
throwaway database only (usage is in the file header). With RLS disabled the same test fails — e.g. a
reviewer from one organization can attach feedback to another's student — which is exactly the gap this closes.

## What this does NOT protect against (read this before onboarding a second NGO)

- **Forged identity.** The API still identifies callers by an `x-user-id` header (see README "Known
  limitations"). RLS keeps a *correctly identified* user inside their organization and contains bugs in route
  code, but anyone who can guess another user's numeric id can still claim to be that user, and so land in
  that user's organization. Replacing the header with signed session tokens (e.g. a JWT or server-side session
  issued at login) is the necessary companion to this work and should be done before a second NGO's real
  students are on the system.
- **Superuser/owner access.** The owner role and Supabase's `service_role` bypass RLS by design. Keep
  `DATABASE_URL` and the service-role key server-side only.
- **Cross-organization references are not constrained by foreign keys.** RLS stops a session writing into
  another organization, but a bug that wrote a row whose `student_id` pointed at another organization's user
  would not be caught by a foreign key. The policies make that unreachable from the API; add composite
  `(organization_id, id)` foreign keys if you want belt and braces.
- **Public aggregates span organizations.** `GET /api/auth/count` counts students across all organizations
  (a single number, no names). Scope it per organization if partners shouldn't see a platform-wide total.
- **Long requests hold a connection.** Each authenticated request keeps a database transaction open until the
  response is sent, including deck/recording uploads. Fine at pilot scale; if uploads become heavy, raise the
  pool size or move the upload ahead of the transaction.

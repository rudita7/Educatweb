import { AsyncLocalStorage } from 'node:async_hooks';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

// ---------------------------------------------------------------------------
// Two database handles — see docs/MULTI_TENANCY.md.
//
//  dbAdmin  DATABASE_URL      Owner/service role. BYPASSES row level security.
//                             Used ONLY where there is no tenant yet: login,
//                             register, resolving "which organization is this
//                             user in?" in the auth middleware, public counts.
//
//  db       DATABASE_URL_APP  The restricted `uttoron_app` role. Row level
//                             security applies, so every query it runs can see
//                             only the organization its transaction is scoped
//                             to (runInOrg). Used by every route handler.
//
// If DATABASE_URL_APP is not set, `db` falls back to the owner connection: the
// app keeps working exactly as before, with isolation NOT enforced by the
// database (a warning is logged at startup). That makes the migration safe to
// roll out in two steps.
// ---------------------------------------------------------------------------

const adminUrl = process.env.DATABASE_URL;
if (!adminUrl) {
  throw new Error('DATABASE_URL is not set in environment variables');
}
const appUrl = process.env.DATABASE_URL_APP;

export const rlsEnforced = Boolean(appUrl);
if (!rlsEnforced) {
  console.warn(
    '[db] DATABASE_URL_APP is not set — queries run as the owner role and row level security is NOT enforced. ' +
      'Set DATABASE_URL_APP to the uttoron_app role before onboarding a second organization (docs/MULTI_TENANCY.md).'
  );
}

const adminClient = postgres(adminUrl);
export const dbAdmin = drizzle(adminClient, { schema });

const appDb = appUrl ? drizzle(postgres(appUrl), { schema }) : dbAdmin;

type Executor = typeof dbAdmin;
const scope = new AsyncLocalStorage<Executor>();

/**
 * Run `fn` with every `db.*` call inside it pinned to one organization.
 * Opens a transaction on the restricted role and sets `app.current_org` for
 * that transaction only (set_config(..., true) = transaction-local, so a
 * pooled connection can never carry one tenant's id into another request).
 */
export function runInOrg<T>(organizationId: number, fn: () => Promise<T>): Promise<T> {
  if (!Number.isInteger(organizationId)) {
    throw new Error('runInOrg: organizationId must be an integer');
  }
  return appDb.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_org', ${String(organizationId)}, true)`);
    return scope.run(tx as unknown as Executor, fn);
  });
}

/**
 * Route-handler database handle. Inside runInOrg it transparently uses the
 * org-scoped transaction; outside one it uses the restricted role with no
 * organization set, which — with RLS enforced — fails closed (no rows).
 */
export const db: Executor = new Proxy(appDb as Executor, {
  get(target, prop, receiver) {
    const active = scope.getStore() ?? target;
    const value = Reflect.get(active, prop, active === target ? receiver : active);
    return typeof value === 'function' ? value.bind(active) : value;
  },
});

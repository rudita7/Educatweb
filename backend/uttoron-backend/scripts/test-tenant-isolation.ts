/**
 * Tenant-isolation test — proves one organization can never see or write
 * another's data, both through the API and directly in the database.
 *
 * Run against a THROWAWAY database that has migrations 0000–0006 applied and a
 * running API started with DATABASE_URL (owner) and DATABASE_URL_APP (uttoron_app):
 *
 *   API_BASE=http://localhost:3000 \
 *   DATABASE_URL=postgres://owner@host/db \
 *   DATABASE_URL_APP=postgres://uttoron_app:pw@host/db \
 *   pnpm exec tsx scripts/test-tenant-isolation.ts
 *
 * It creates two test organizations (iso-test-a / iso-test-b). Never point it at production.
 */
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

const API = process.env.API_BASE || 'http://localhost:3000';
const ADMIN = process.env.DATABASE_URL;
const APP = process.env.DATABASE_URL_APP;
if (!ADMIN || !APP) { console.error('Set DATABASE_URL and DATABASE_URL_APP'); process.exit(1); }

const admin = postgres(ADMIN);
const app = postgres(APP);
let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  ← ' + detail}`);
  if (!ok) failures++;
}

async function api(method: string, path: string, userId?: number, body?: unknown) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId ? { 'x-user-id': String(userId) } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

const typing = { checkpointId: 'typing_g69_s1_baseline', wpm: 30, accuracy: 95, errorCount: 2, durationSeconds: 60, textLength: 150 };

async function main() {
  const run = Date.now().toString().slice(-6);
  // --- two organizations, each with a student (registered through the real API) and a reviewer
  for (const s of ['iso-test-a', 'iso-test-b']) {
    await admin`insert into organizations (slug, name) values (${s}, ${s}) on conflict (slug) do nothing`;
  }
  const [{ id: orgA }] = await admin`select id from organizations where slug = 'iso-test-a'`;
  const [{ id: orgB }] = await admin`select id from organizations where slug = 'iso-test-b'`;

  const regA = await api('POST', '/api/auth/register', undefined, { username: `UT-A${run}`, pin: '1234', organization: 'iso-test-a' });
  const regB = await api('POST', '/api/auth/register', undefined, { username: `UT-B${run}`, pin: '1234', organization: 'iso-test-b' });
  check('register into a named organization', regA.status === 201 && regB.status === 201, JSON.stringify([regA, regB]));
  const bad = await api('POST', '/api/auth/register', undefined, { username: `UT-X${run}`, pin: '1234', organization: 'no-such-org' });
  check('register into unknown organization is rejected', bad.status === 400);
  const studentA = regA.json.user.id, studentB = regB.json.user.id;

  const pin = await bcrypt.hash('1111', 4);
  const [revA] = await admin`insert into users (organization_id, username, pin, role) values (${orgA}, ${'rev-a-' + run}, ${pin}, 'reviewer') returning id`;
  const [revB] = await admin`insert into users (organization_id, username, pin, role) values (${orgB}, ${'rev-b-' + run}, ${pin}, 'reviewer') returning id`;

  // --- API level
  const rA = await api('POST', '/api/typing/results', studentA, typing);
  const rB = await api('POST', '/api/typing/results', studentB, typing);
  check('student can submit a result', rA.status === 201 && rB.status === 201, JSON.stringify([rA, rB]));
  const [rowA] = await admin`select organization_id from typing_results where id = ${rA.json.id}`;
  check('new row is stamped with the submitter\'s organization automatically', rowA.organization_id === orgA);

  const qA = await api('GET', '/api/typing/queue?status=all', revA.id);
  const qB = await api('GET', '/api/typing/queue?status=all', revB.id);
  check('reviewer A sees only org A results', qA.json.length === 1 && qA.json[0].id === rA.json.id, JSON.stringify(qA.json));
  check('reviewer B sees only org B results', qB.json.length === 1 && qB.json[0].id === rB.json.id);

  const cross = await api('POST', `/api/typing/${rB.json.id}/feedback`, revA.id, { tagIds: [1], comment: 'x' });
  check('reviewer A cannot give feedback on org B result (404)', cross.status === 404, JSON.stringify(cross));
  const [{ n }] = await admin`select count(*)::int n from typing_feedback where result_id = ${rB.json.id}`;
  check('…and no feedback row was written', n === 0);

  const peek = await api('GET', `/api/typing/comparisons?studentId=${studentB}`, revA.id);
  check('reviewer A cannot read org B student\'s comparisons', JSON.stringify(peek.json).indexOf(String(rB.json.id)) === -1 && (peek.status !== 200 || (Array.isArray(peek.json) ? peek.json.length === 0 : true)), JSON.stringify(peek));

  const mine = await api('GET', '/api/typing/mine', studentA);
  check('student sees only own results', mine.json.length === 1);

  // --- Database level: simulate a buggy route that forgot every WHERE clause
  const asOrg = async (org: number | null, fn: (tx: postgres.TransactionSql) => Promise<any>) =>
    app.begin(async (tx) => { if (org !== null) await tx`select set_config('app.current_org', ${String(org)}, true)`; return fn(tx); }) as Promise<any>;

  const all = await asOrg(orgA, (tx) => tx`select id, organization_id from typing_results`);
  check('DB: unfiltered "select *" as org A returns only org A rows', all.length >= 1 && all.every((r: any) => r.organization_id === orgA));
  const none = await asOrg(null, (tx) => tx`select id from typing_results`);
  check('DB: no organization set → sees nothing (fails closed)', none.length === 0);
  const usersSeen = await asOrg(orgA, (tx) => tx`select organization_id from users`);
  check('DB: users table is isolated too', usersSeen.every((r: any) => r.organization_id === orgA));

  let blocked = false;
  try {
    await asOrg(orgA, (tx) => tx`insert into typing_results (organization_id, student_id, checkpoint_id, wpm, accuracy, error_count, duration_seconds, text_length) values (${orgB}, ${studentB}, 'x', 1, 1, 0, 1, 1)`);
  } catch { blocked = true; }
  check('DB: org A session cannot INSERT a row into org B', blocked);

  const upd = await asOrg(orgA, (tx) => tx`update typing_results set status = 'reviewed' where id = ${rB.json.id} returning id`);
  check('DB: org A session cannot UPDATE an org B row', upd.length === 0);
  const del = await asOrg(orgA, (tx) => tx`delete from typing_results where id = ${rB.json.id} returning id`);
  check('DB: org A session cannot DELETE an org B row', del.length === 0);

  let orgsBlocked = false;
  try { await asOrg(orgA, (tx) => tx`select * from organizations`); } catch { orgsBlocked = true; }
  check('DB: app role cannot read the organizations table', orgsBlocked);

  // set_config(..., true) is transaction-local: a pooled connection must not leak the previous org
  await asOrg(orgA, (tx) => tx`select 1`);
  const leaked = await app`select current_setting('app.current_org', true) as v`;
  check('DB: organization setting does not leak to the next use of the connection', !leaked[0].v);

  // cleanup test data
  await admin`delete from typing_feedback where organization_id in (${orgA}, ${orgB})`;
  await admin`delete from typing_results where organization_id in (${orgA}, ${orgB})`;
  await admin`delete from users where organization_id in (${orgA}, ${orgB})`;
  await admin`delete from organizations where id in (${orgA}, ${orgB})`;

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll isolation checks passed');
  await admin.end(); await app.end();
  process.exit(failures ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });

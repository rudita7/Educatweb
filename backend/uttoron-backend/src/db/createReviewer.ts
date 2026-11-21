import { dbAdmin as db } from '@/db'; // one-off admin script: runs as the owner role
import { users, organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// One-time setup for a teacher/reviewer account - run once per reviewer via:
//   pnpm exec tsx src/db/createReviewer.ts <username> <pin> [organization-slug]
// The organization defaults to DEFAULT_ORG_SLUG / 'aim-initiative'.
// Promotes an existing account to role='reviewer' if the username already
// exists (e.g. the site owner's own student passport), otherwise creates one.
async function main() {
  const [username, pin, orgSlug] = process.argv.slice(2);
  if (!username || !pin) {
    console.error('Usage: tsx src/db/createReviewer.ts <username> <pin> [organization-slug]');
    process.exit(1);
  }

  const slug = orgSlug || process.env.DEFAULT_ORG_SLUG || 'aim-initiative';
  const org = await db.query.organizations.findFirst({ where: eq(organizations.slug, slug) });
  if (!org) { console.error(`No organization with slug "${slug}".`); process.exit(1); }

  const hashedPin = await bcrypt.hash(pin, Number(process.env.PIN_SALT_ROUNDS) || 10);
  const existing = await db.query.users.findFirst({ where: eq(users.username, username) });

  if (existing) {
    if (existing.organizationId !== org.id) { console.error(`"${username}" belongs to a different organization; refusing to promote.`); process.exit(1); }
    await db.update(users).set({ role: 'reviewer', pin: hashedPin }).where(eq(users.id, existing.id));
    console.log(`Promoted existing user "${username}" (id ${existing.id}) to role=reviewer.`);
  } else {
    const [created] = await db.insert(users).values({ organizationId: org.id, username, pin: hashedPin, role: 'reviewer' }).returning({ id: users.id });
    console.log(`Created reviewer "${username}" (id ${created.id}).`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create/promote reviewer:', err);
  process.exit(1);
});
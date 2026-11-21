-- Multi-tenancy: organizations + organization_id on every tenant table + Row Level Security.
--
-- Safe to apply to a database that already holds the pilot's real data:
--   1. every existing row is backfilled into the 'aim-initiative' organization
--   2. RLS policies only apply to the `uttoron_app` role; the role the API uses today
--      (Supabase `postgres`, BYPASSRLS) is unaffected, so applying this changes no behaviour
--      until DATABASE_URL_APP is pointed at `uttoron_app` (see docs/MULTI_TENANCY.md).
--
-- Hand-written ordering (the drizzle-generated version would fail on existing rows).

CREATE TABLE "organizations" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
INSERT INTO "organizations" ("slug", "name") VALUES ('aim-initiative', 'AIM Initiative Foundation');
--> statement-breakpoint

-- 1. add the column nullable, 2. backfill, 3. enforce NOT NULL + default + FK + index
DO $$
DECLARE
  t text;
  default_org integer := (SELECT id FROM organizations WHERE slug = 'aim-initiative');
BEGIN
  FOREACH t IN ARRAY ARRAY['users','progress','analytics_events','submissions','feedback',
                           'submission_metrics','typing_results','typing_feedback']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN organization_id integer', t);
    EXECUTE format('UPDATE %I SET organization_id = %s', t, default_org);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN organization_id SET NOT NULL', t);
    -- new rows take the organization the session is scoped to (set per transaction by the API)
    EXECUTE format($f$ALTER TABLE %I ALTER COLUMN organization_id SET DEFAULT nullif(current_setting('app.current_org', true), '')::integer$f$, t);
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES organizations(id)', t, t || '_organization_id_organizations_id_fk');
    EXECUTE format('CREATE INDEX %I ON %I (organization_id)', t || '_organization_id_idx', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- The application role. NOLOGIN here because a password must never live in a migration:
-- run  ALTER ROLE uttoron_app LOGIN PASSWORD '...';  once by hand (docs/MULTI_TENANCY.md).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'uttoron_app') THEN
    CREATE ROLE uttoron_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO uttoron_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON users, progress, analytics_events, submissions, feedback,
  submission_metrics, typing_results, typing_feedback TO uttoron_app;
--> statement-breakpoint
GRANT SELECT ON tags TO uttoron_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO uttoron_app;
--> statement-breakpoint

-- Row Level Security. The whole point: the DATABASE refuses to show or write another
-- organization's rows, no matter what the API code does.
-- No policy for any other role => Supabase's anon/authenticated roles (the public
-- PostgREST API) see nothing either. `organizations` has RLS on and no policy: the app
-- role cannot read it at all.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','progress','analytics_events','submissions','feedback',
                           'submission_metrics','typing_results','typing_feedback']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$CREATE POLICY tenant_isolation ON %I TO uttoron_app
      USING (organization_id = nullif(current_setting('app.current_org', true), '')::integer)
      WITH CHECK (organization_id = nullif(current_setting('app.current_org', true), '')::integer)$f$, t);
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tags_read_all ON "tags" FOR SELECT TO uttoron_app USING (true);

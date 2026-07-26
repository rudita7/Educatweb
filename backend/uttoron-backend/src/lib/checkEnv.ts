import * as dotenv from 'dotenv';

dotenv.config();

// Registered before any other module loads, so whatever actually crashes
// the process on boot gets printed loudly instead of Render's deploy log
// showing only "Application exited early" with no explanation.
process.on('uncaughtException', (err) => {
  console.error('FATAL - uncaught exception during startup:');
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('FATAL - unhandled rejection during startup:');
  console.error(reason);
  process.exit(1);
});

const REQUIRED_ENV_VARS = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Missing required environment variable(s): ${missing.join(', ')}`);
  console.error('Set these in your hosting platform\'s environment settings, then redeploy.');
  process.exit(1);
}

import { createClient } from '@supabase/supabase-js';

// Server-side only — uses the service_role key, which bypasses Storage RLS.
// Never send this key to the frontend; it lives only in this process's env.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'submissions';
const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes — long enough to load a page, short enough to limit exposure

let client: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to store submission files.');
  }
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  return client;
}

// Path convention: <studentId>/<lessonId>/<timestamp>-<random>-<safeName>
// Keeps a student's own files grouped, avoids collisions, never trusts the
// client-supplied filename for anything beyond display.
export function buildStoragePath(studentId: number, lessonId: string, originalName: string) {
  const safe = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  return `${studentId}/${lessonId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
}

export async function uploadToStorage(storagePath: string, buffer: Buffer, contentType: string) {
  const { error } = await getClient().storage.from(BUCKET).upload(storagePath, buffer, { contentType, upsert: false });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return storagePath;
}

export async function signedUrlFor(storagePath: string) {
  const { data, error } = await getClient().storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw new Error(`Could not create signed URL: ${error?.message || 'unknown error'}`);
  return data.signedUrl;
}

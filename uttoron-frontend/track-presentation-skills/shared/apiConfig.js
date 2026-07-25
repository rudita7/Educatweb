/* Single place to point the frontend at the deployed backend.
   Update PS_API_BASE once you have a real hosted backend URL (e.g. from
   Render) — every page that talks to the backend reads this one value via
   submissionStore.js, so this is the only file that needs editing.

   Leave as-is for local development (backend running on localhost:3000). */
window.PS_API_BASE = 'http://localhost:3000';
// Once deployed, replace the line above with e.g.:
// window.PS_API_BASE = 'https://uttoron-backend.onrender.com';

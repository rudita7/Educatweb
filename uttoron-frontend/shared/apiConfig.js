/* Single place to point every track's frontend at the deployed backend.
   Update UTTORON_API_BASE once you have a real hosted backend URL (e.g.
   from Render) — every page that talks to the backend reads this one value
   via shared/backendBridge.js, so this is the only file that needs editing.

   This used to live at track-presentation-skills/shared/apiConfig.js as
   window.PS_API_BASE. Moved here (typing feedback spec §6) because it was
   never presentation-specific — it's the one backend both tracks talk to —
   and the typing track was the first thing that needed to share it.

   Leave as-is for local development (backend running on localhost:3000). */
window.UTTORON_API_BASE = 'https://uttoron-backend.onrender.com';
// Once deployed, replace the line above with e.g.:
// window.UTTORON_API_BASE = 'https://uttoron-backend.onrender.com';

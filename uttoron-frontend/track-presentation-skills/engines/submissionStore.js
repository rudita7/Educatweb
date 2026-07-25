/* Submission + feedback storage (spec §6-9) — student-facing engine.

   Talks to the real Express/Postgres backend (backend/uttoron-backend) —
   this used to be an IndexedDB-only stand-in; now that the backend is
   deployed, this file is the only thing that changed. lesson9.js/12.js/
   13.js and the reviewer queue still call the same shaped operations
   (createSubmission / listMine / listQueue / submitFeedback), so this swap
   stayed contained to one file, as designed from the start.

   ACCOUNT BRIDGING: every track's account system (nickname + 4-digit PIN,
   see webapp/index1.html) is 100% local, site-wide — not just this track.
   Rather than migrating every track's accounts to the backend, this file
   quietly registers/logs in a matching backend account the first time a
   student hits a checkpoint on a given device (identify()). The bridged
   username is NOT the raw local passport number alone: two different
   devices can independently generate the same 4-digit number (it's only
   locally unique), but the backend's `users.username` has a real, shared
   uniqueness constraint. Appending the nickname plus a random per-device
   suffix keeps bridged accounts collision-free while staying human-readable
   in the reviewer queue (nickname + passport number, salt stripped for
   display) — see reviewer.js. */
(function (global) {
    "use strict";

    // Point this at the deployed backend once it's hosted (Phase 2). Falls
    // back to localhost for local dev/testing.
    const API_BASE = global.PS_API_BASE || 'http://localhost:3000';

    // ---------------- Tag taxonomy (spec §7 — must match the backend seed) ----------------
    const TAGS = [
        { id: 'structure-clear', label: 'Clear, logical flow', category: 'structure', sentiment: 'positive' },
        { id: 'structure-hard', label: 'Structure was hard to follow', category: 'structure', sentiment: 'constructive' },
        { id: 'visual-clean', label: 'Clean, consistent slides', category: 'visual_design', sentiment: 'positive' },
        { id: 'visual-inconsistent', label: 'Inconsistent fonts, colors, or alignment', category: 'visual_design', sentiment: 'constructive' },
        { id: 'restraint-supported', label: 'Transitions and animations supported the content', category: 'restraint', sentiment: 'positive' },
        { id: 'restraint-distracting', label: 'Animations/transitions were distracting', category: 'restraint', sentiment: 'constructive' },
        { id: 'pacing-well', label: 'Well-paced, with natural pauses', category: 'pacing', sentiment: 'positive' },
        { id: 'pacing-rushed', label: 'Felt rushed', category: 'pacing', sentiment: 'constructive' },
        { id: 'pacing-dragged', label: 'Dragged in places', category: 'pacing', sentiment: 'constructive' },
        { id: 'vocal-confident', label: 'Confident, varied tone', category: 'vocal_delivery', sentiment: 'positive' },
        { id: 'vocal-filler', label: 'Noticeable filler words', category: 'vocal_delivery', sentiment: 'constructive' },
        { id: 'vocal-monotone', label: 'Monotone delivery', category: 'vocal_delivery', sentiment: 'constructive' },
        { id: 'time-within', label: 'Within the time target', category: 'time_management', sentiment: 'positive' },
        { id: 'time-over', label: 'Ran over time', category: 'time_management', sentiment: 'constructive' },
        { id: 'time-short', label: 'Too short / underdeveloped', category: 'time_management', sentiment: 'constructive' }
    ];
    const LESSON_TAG_MAP = {
        lesson_9_checkpoint: ['structure', 'visual_design'],
        lesson_12_delivery: ['vocal_delivery', 'pacing'],
        lesson_13_capstone: ['structure', 'visual_design', 'restraint', 'pacing', 'vocal_delivery', 'time_management']
    };
    const LESSON_LABELS = {
        lesson_9_checkpoint: 'Lesson 9 · Structural Checkpoint',
        lesson_12_delivery: 'Lesson 12 · Delivery Checkpoint',
        lesson_13_capstone: 'Lesson 13 · Capstone'
    };
    function tagsForLesson(lessonId) {
        const cats = LESSON_TAG_MAP[lessonId] || [];
        return TAGS.filter(t => cats.includes(t.category));
    }

    const MAX_FILE_MB = 25;
    const MAX_RECORDING_MB = 40;
    function validatePptx(file) {
        if (!file) return { ok: false, reason: 'No file selected.' };
        if (!/\.pptx$/i.test(file.name)) return { ok: false, reason: 'Please choose a .pptx file (PowerPoint format).' };
        if (file.size > MAX_FILE_MB * 1024 * 1024) return { ok: false, reason: `File is too large — keep it under ${MAX_FILE_MB}MB.` };
        return { ok: true };
    }
    function validateRecordingBlob(blob) {
        if (!blob) return { ok: false, reason: 'No recording found.' };
        if (blob.size > MAX_RECORDING_MB * 1024 * 1024) return { ok: false, reason: 'Recording is too large — keep it under 4 minutes.' };
        return { ok: true };
    }
    function fileObjectURL(blob) { return blob ? URL.createObjectURL(blob) : null; }

    // ---------------- Backend account bridging ----------------
    function uidKey(num) { return 'ps:backend-uid:' + num; }
    function usernameKey(num) { return 'ps:backend-username:' + num; }

    async function ensureBackendAccount(num, nickname, pin) {
        const cached = localStorage.getItem(uidKey(num));
        if (cached) return Number(cached);

        let username = localStorage.getItem(usernameKey(num));
        if (!username) {
            username = nickname + '#' + num + '.' + Math.random().toString(36).slice(2, 8);
            localStorage.setItem(usernameKey(num), username);
        }

        let res = await fetch(API_BASE + '/api/auth/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, pin })
        });
        let data = await res.json().catch(() => ({}));
        if (res.status === 400 && /already exists/i.test(data.error || '')) {
            // Same device, second visit after a cache clear — log in instead.
            res = await fetch(API_BASE + '/api/auth/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, pin })
            });
            data = await res.json().catch(() => ({}));
        }
        if (!res.ok) throw new Error(data.error || 'Could not connect your passport to the review system.');
        localStorage.setItem(uidKey(num), String(data.user.id));
        return data.user.id;
    }

    // Call before any submission action. `Storage`/`session` come straight
    // from the lesson shell — Storage.get('user:'+num) holds the local
    // passport record (including its plaintext PIN, never sent anywhere
    // except this one bridging call).
    async function identify(session, Storage) {
        if (!session) return null;
        const localUser = Storage.get('user:' + session.num);
        if (!localUser) return null;
        return ensureBackendAccount(session.num, session.nickname, localUser.pin);
    }

    async function login(username, pin) {
        const res = await fetch(API_BASE + '/api/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, pin })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Invalid username or PIN.');
        return data.user; // { id, username, role }
    }

    // ---------------- API helpers ----------------
    async function apiFetch(path, opts) {
        let res;
        try {
            res = await fetch(API_BASE + path, opts);
        } catch (networkErr) {
            const err = new Error('Network error — check your connection.');
            err.isNetworkError = true;
            throw err;
        }
        let data = null;
        try { data = await res.json(); } catch (e) { /* empty body, fine */ }
        if (!res.ok) {
            const err = new Error((data && data.error) || ('Request failed (' + res.status + ')'));
            err.status = res.status;
            throw err;
        }
        return data;
    }

    // Low-bandwidth submission (PRD §7): a dropped connection on a big
    // upload shouldn't force the student to start over from nothing.
    // Retries network failures / 5xx with backoff; a real validation error
    // (4xx — wrong file type, missing field) fails immediately since
    // retrying can't fix that.
    async function fetchWithRetry(path, opts, { retries = 3, baseDelayMs = 1500, onRetry } = {}) {
        let lastErr;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await apiFetch(path, opts);
            } catch (err) {
                lastErr = err;
                const retryable = err.isNetworkError || (err.status && err.status >= 500);
                if (!retryable || attempt === retries) throw err;
                if (onRetry) onRetry(attempt + 1, retries);
                await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)));
            }
        }
        throw lastErr;
    }

    async function createSubmission({ lessonId, submissionType, file, recording, recordingName, resubmissionOf, backendUid, onRetry }) {
        const form = new FormData();
        form.append('lessonId', lessonId);
        form.append('submissionType', submissionType);
        if (resubmissionOf) form.append('resubmissionOf', String(resubmissionOf));
        if (file) form.append('deckFile', file, file.name);
        if (recording) form.append('recording', recording, recordingName || 'recording.webm');
        return fetchWithRetry('/api/submissions', { method: 'POST', headers: { 'x-user-id': String(backendUid) }, body: form }, { onRetry });
    }

    // Returns [{submission, feedback}], newest-first — optionally scoped to
    // one lesson (each checkpoint page passes its own lessonId so submissions
    // from other checkpoints never bleed into the wrong page).
    async function listMine(backendUid, lessonId) {
        const qs = lessonId ? ('?lessonId=' + encodeURIComponent(lessonId)) : '';
        return apiFetch('/api/submissions/mine' + qs, { headers: { 'x-user-id': String(backendUid) } });
    }

    async function listQueue(backendUid, opts) {
        const params = new URLSearchParams();
        if (opts && opts.status) params.set('status', opts.status);
        if (opts && opts.lessonId) params.set('lessonId', opts.lessonId);
        if (opts && opts.studentId) params.set('studentId', String(opts.studentId));
        const qs = params.toString() ? ('?' + params.toString()) : '';
        return apiFetch('/api/submissions/queue' + qs, { headers: { 'x-user-id': String(backendUid) } });
    }

    async function submitFeedback({ backendUid, submissionId, tagIds, comment }) {
        return apiFetch('/api/submissions/' + submissionId + '/feedback', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': String(backendUid) },
            body: JSON.stringify({ tagIds, comment })
        });
    }

    // Feedback-stuck tracking: before/after metric comparisons for
    // structure/visual_design tags. `backendUid` is the caller's own id
    // (reviewer or the student themselves); `studentId` defaults to the
    // caller when omitted.
    async function getComparisons(backendUid, studentId) {
        const qs = studentId ? ('?studentId=' + encodeURIComponent(studentId)) : '';
        return apiFetch('/api/submissions/comparisons' + qs, { headers: { 'x-user-id': String(backendUid) } });
    }

    // Growth portfolio: touchpoint-1 deck vs capstone deck, side by side —
    // independent of tagging, uses every deck's metrics directly.
    async function getGrowthPortfolio(backendUid, studentId) {
        const qs = studentId ? ('?studentId=' + encodeURIComponent(studentId)) : '';
        return apiFetch('/api/submissions/growth-portfolio' + qs, { headers: { 'x-user-id': String(backendUid) } });
    }

    // Weakness-pattern aggregation: per-student category counts ("pacing
    // flagged in 2 of last 3 reviews"), and — reviewer only — cohort-wide.
    async function getWeaknessPatterns(backendUid, studentId) {
        const qs = studentId ? ('?studentId=' + encodeURIComponent(studentId)) : '';
        return apiFetch('/api/submissions/weakness-patterns' + qs, { headers: { 'x-user-id': String(backendUid) } });
    }
    async function getCohortWeaknessPatterns(backendUid, days) {
        const qs = days ? ('?days=' + encodeURIComponent(days)) : '';
        return apiFetch('/api/submissions/weakness-patterns/cohort' + qs, { headers: { 'x-user-id': String(backendUid) } });
    }

    global.PS = global.PS || {};
    global.PS.submissionStore = {
        identify, login, createSubmission, listMine, listQueue, submitFeedback, getComparisons,
        getGrowthPortfolio, getWeaknessPatterns, getCohortWeaknessPatterns,
        fileObjectURL, validatePptx, validateRecordingBlob,
        TAGS, LESSON_TAG_MAP, LESSON_LABELS, tagsForLesson,
        MAX_FILE_MB, MAX_RECORDING_MB
    };
})(window);

/* Submission + feedback storage (spec §6-9) — student-facing engine.

   Talks to the real Express/Postgres backend (backend/uttoron-backend) —
   this used to be an IndexedDB-only stand-in; now that the backend is
   deployed, this file is the only thing that changed. lesson9.js/12.js/
   13.js and the reviewer queue still call the same shaped operations
   (createSubmission / listMine / listQueue / submitFeedback), so this swap
   stayed contained to one file, as designed from the start.

   Account bridging (identify/ensureBackendAccount), sign-in (login), and
   the generic fetch helpers (apiFetch/fetchWithRetry) moved out to
   shared/backendBridge.js (typing feedback spec §6) — they were never
   presentation-specific, and the typing track needed the exact same
   bridging. This file now delegates to window.Backend for all of that and
   keeps only what's actually presentation-specific: the tag taxonomy,
   file/recording validation, and the submission/feedback/queue calls.
   Load shared/apiConfig.js + shared/backendBridge.js before this file. */
(function (global) {
    "use strict";

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

    // ---------------- Backend account bridging + generic fetch (shared/backendBridge.js) ----------------
    const { identify, login, apiFetch, fetchWithRetry } = global.Backend;

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

/* Typing track — feedback checkpoint client (typing feedback spec §6).

   Small typing-specific sibling to track-presentation-skills' submission
   client, using the same shared account-bridging + fetch helpers
   (shared/backendBridge.js). Load shared/apiConfig.js and
   shared/backendBridge.js before this file. */
(function (global) {
    "use strict";

    // Spec §8 tag taxonomy — must match the backend seed (seed.ts). Kept
    // here (not fetched from /api/typing/tags/list) for the same reason
    // submissionStore.js keeps its own copy: the reviewer page renders the
    // picker instantly without waiting on a round trip, and stays in sync
    // because both are hand-edited from the same spec table.
    const TYPING_TAGS = [
        { id: 'typing-accurate', label: 'Strong accuracy at this speed', category: 'accuracy', sentiment: 'positive' },
        { id: 'typing-many-errors', label: 'Frequent mistyped keys', category: 'accuracy', sentiment: 'constructive' },
        { id: 'typing-steady-pace', label: 'Steady, even rhythm', category: 'typing_pacing', sentiment: 'positive' },
        { id: 'typing-rushes', label: 'Rushes and loses accuracy under speed', category: 'typing_pacing', sentiment: 'constructive' },
        { id: 'typing-slow-careful', label: 'Accurate but notably slow', category: 'typing_pacing', sentiment: 'constructive' },
        { id: 'typing-improving', label: 'Clear improvement since last attempt', category: 'progress', sentiment: 'positive' },
        { id: 'typing-plateaued', label: 'No change since last attempt', category: 'progress', sentiment: 'constructive' }
    ];
    // One label per real curriculum session, across both grade bands the
    // typing track now covers (see typing-lesson.html and the build-log
    // spec for the full session content). Redoing a session still produces
    // a new dated row under the same checkpointId (spec §6 option b), not
    // a new id. Prefix tells a reviewer which grade band a queue card is
    // from at a glance.
    const CHECKPOINT_LABELS = {
        // Grade 6-9 — Month 1: Typing Fluency & File Management
        typing_g69_s1_baseline: 'G6-9 · Session 1 · Baseline',
        typing_g69_s2_full_keyboard: 'G6-9 · Session 2 · Full Keyboard Drills',
        typing_g69_s3_speed: 'G6-9 · Session 3 · Speed Building',
        typing_g69_s5_speed_naming: 'G6-9 · Session 5 · Speed + File Naming',
        typing_g69_s7_real_world: 'G6-9 · Session 7 · Real-World Text',
        typing_g69_s8_final: 'G6-9 · Session 8 · Final Test',
        // Grade 4-5 — Month 1: Keyboarding & Computer Basics
        typing_g45_s2_baseline: 'G4-5 · Session 2 · Home Row Introduction',
        typing_g45_s3_home_row: 'G4-5 · Session 3 · Home Row Practice',
        typing_g45_s5_beyond_home_row: 'G4-5 · Session 5 · Beyond Home Row',
        typing_g45_s7_paragraph: 'G4-5 · Session 7 · Typing + Formatting Practice',
        typing_g45_s8_final: 'G4-5 · Session 8 · Final Test',
    };
    function tagsForTypingCheckpoint() { return TYPING_TAGS; } // revisit if a second checkpoint type is ever added

    const { identify, apiFetch, fetchWithRetry } = global.Backend;

    async function submitTypingResult({ backendUid, checkpointId, wpm, accuracy, errorCount, durationSeconds, textLength, onRetry }) {
        return fetchWithRetry('/api/typing/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': String(backendUid) },
            body: JSON.stringify({ checkpointId, wpm, accuracy, errorCount, durationSeconds, textLength }),
        }, { onRetry });
    }

    // [{result, feedback}], newest-first.
    async function listMine(backendUid, checkpointId) {
        const qs = checkpointId ? ('?checkpointId=' + encodeURIComponent(checkpointId)) : '';
        return apiFetch('/api/typing/mine' + qs, { headers: { 'x-user-id': String(backendUid) } });
    }

    async function listQueue(backendUid, opts) {
        const params = new URLSearchParams();
        if (opts && opts.status) params.set('status', opts.status);
        if (opts && opts.checkpointId) params.set('checkpointId', opts.checkpointId);
        if (opts && opts.studentId) params.set('studentId', String(opts.studentId));
        const qs = params.toString() ? ('?' + params.toString()) : '';
        return apiFetch('/api/typing/queue' + qs, { headers: { 'x-user-id': String(backendUid) } });
    }

    async function submitFeedback({ backendUid, resultId, tagIds, comment }) {
        return apiFetch('/api/typing/' + resultId + '/feedback', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': String(backendUid) },
            body: JSON.stringify({ tagIds, comment })
        });
    }

    // Phase 4 (optional) — before/after WPM & accuracy comparisons.
    async function getComparisons(backendUid, studentId) {
        const qs = studentId ? ('?studentId=' + encodeURIComponent(studentId)) : '';
        return apiFetch('/api/typing/comparisons' + qs, { headers: { 'x-user-id': String(backendUid) } });
    }

    global.TypingStore = {
        identify, submitTypingResult, listMine, listQueue, submitFeedback, getComparisons,
        TYPING_TAGS, CHECKPOINT_LABELS, tagsForTypingCheckpoint
    };
})(window);

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
    // Only one checkpoint exists today (spec §6, option b — redoing the
    // lesson later produces a new dated row, not a new checkpoint name).
    const CHECKPOINT_LABELS = { typing_checkpoint: 'Typing · Checkpoint attempt' };
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

/* Shared backend-bridging + fetch helpers — used by every track that talks
   to the real Express/Postgres backend (currently: Presentation Skills and
   Typing).

   Extracted out of track-presentation-skills/engines/submissionStore.js
   (typing feedback spec §6, open question 2): identify()/ensureBackendAccount()/
   login()/apiFetch()/fetchWithRetry() were never presentation-specific —
   they just turn the site-wide local passport (nickname + 4-digit PIN, see
   webapp/index1.html) into a real backend account and talk to the API.
   Typing needing the exact same bridging was the sign this belonged here
   instead of duplicated into a second track.

   Load shared/apiConfig.js before this file (sets window.UTTORON_API_BASE).

   ACCOUNT BRIDGING: the passport number (e.g. "UT-4821") IS the backend
   username — register-or-login against it directly, so the same student
   always resolves to the same backend account from any device, not just
   the one they signed up on. This used to append a random per-device
   suffix instead (two devices could independently generate the same
   4-digit number, and that scheme avoided colliding on it) — the real fix
   is that the passport number is now actually checked for uniqueness
   against the live database at creation time (see index1.html's signup
   handler), not just this device's local storage, so it doesn't need a
   salt to stay collision-free anymore. The tradeoff this intentionally
   accepts: a passport created before this change is still only reachable
   from the device that created it, under its old salted username — this
   only fixes it going forward.

   IMPORTANT: the cached backend account is keyed by passport num only
   (uttoron:backend-uid:<num>), NOT by track — one passport bridges to ONE
   backend user account, reused by every track, so a reviewer sees one
   consistent student identity whether they're looking at a deck submission
   or a typing result. A student who bridged before this file existed has a
   cached id under the old presentation-only key (ps:backend-uid:<num>);
   ensureBackendAccount() picks that up and migrates it forward rather than
   registering a second, disconnected account for the same student. */
(function (global) {
    "use strict";

    const API_BASE = global.UTTORON_API_BASE || global.PS_API_BASE || 'http://localhost:3000';

    function uidKey(num) { return 'uttoron:backend-uid:' + num; }
    function legacyUidKey(num) { return 'ps:backend-uid:' + num; } // pre-extraction key, presentation-track-only

    async function ensureBackendAccount(num, nickname, pin, avatar) {
        const cached = localStorage.getItem(uidKey(num)) || localStorage.getItem(legacyUidKey(num));
        if (cached) {
            localStorage.setItem(uidKey(num), cached); // migrate off the legacy presentation-only key, if that's where it came from
            return Number(cached);
        }

        // Passport number is the backend username directly now (see file
        // header) — register-or-login against it, which naturally handles
        // both "brand new account" and "this device just doesn't have it
        // cached yet" in one call.
        let res = await fetch(API_BASE + '/api/auth/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: num, pin, nickname, avatar })
        });
        let data = await res.json().catch(() => ({}));
        if (res.status === 400 && /already exists/i.test(data.error || '')) {
            res = await fetch(API_BASE + '/api/auth/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: num, pin })
            });
            data = await res.json().catch(() => ({}));
        }
        if (!res.ok) throw new Error(data.error || 'Could not connect your passport to the review system.');
        localStorage.setItem(uidKey(num), String(data.user.id));
        return data.user.id;
    }

    // Call before any submission action. `Storage`/`session` come straight
    // from the calling page — Storage.get('user:'+num) holds the local
    // passport record (including its plaintext PIN, never sent anywhere
    // except this one bridging call). `session` needs at minimum { num }
    // (nickname is looked up from the local passport record if missing —
    // webapp/typing-lesson.html's site-wide session only stores num).
    async function identify(session, Storage) {
        if (!session || !session.num) return null;
        const localUser = Storage.get('user:' + session.num);
        if (!localUser) return null;
        const nickname = session.nickname || localUser.nickname;
        const avatar = session.avatar || localUser.avatar;
        return ensureBackendAccount(session.num, nickname, localUser.pin, avatar);
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
    // (4xx — wrong file type, missing field, bad number) fails immediately
    // since retrying can't fix that.
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

    global.Backend = {
        API_BASE, identify, ensureBackendAccount, login, apiFetch, fetchWithRetry
    };
})(window);

(function () {
    "use strict";

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

    // Bridged student accounts are named `nickname#passportNum.salt` (see
    // submissionStore.js — the salt keeps accounts collision-free across
    // devices). Strip the salt for a clean, human-readable display name.
    function displayName(studentName) { return String(studentName || '').replace(/\.[a-z0-9]{6}$/i, ''); }

    // A student's backend username is their passport number. The nickname they
    // chose when creating the passport (studentNickname, from the queue API) is
    // shown as their name, with the passport number beside it; older queue
    // responses without a nickname still show the passport number alone.
    function studentText(row) {
        const pass = displayName(row.studentName);
        return row.studentNickname ? row.studentNickname + ' (' + pass + ')' : pass;
    }
    function studentHtml(row) {
        const pass = escapeHtml(displayName(row.studentName));
        return row.studentNickname
            ? `${escapeHtml(row.studentNickname)} <span style="font-family:var(--font-mono);font-size:0.72rem;opacity:0.75;font-weight:400;">${pass}</span>`
            : pass;
    }
    function studentSearchText(row) { return studentText(row).toLowerCase(); }

    let toastTimer = null;
    function showToast(msg, type) {
        const el = $('#toast');
        el.textContent = msg;
        el.className = 'toast show ' + (type || '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
    }

    // ============================================================
    //  Sign-in (real backend account, role-checked)
    // ============================================================
    let reviewerUid = null;

    $('#pinSubmit').addEventListener('click', trySignIn);
    $('#pinInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') trySignIn(); });
    $('#reviewerUsername').addEventListener('keydown', (e) => { if (e.key === 'Enter') trySignIn(); });

    async function trySignIn() {
        const username = $('#reviewerUsername').value.trim();
        const pin = $('#pinInput').value.trim();
        if (!username || !pin) {
            $('#pinMsg').textContent = 'Enter both your username and PIN.';
            $('#pinMsg').className = 'form-msg error';
            return;
        }
        $('#pinSubmit').disabled = true;
        try {
            const user = await PS.submissionStore.login(username, pin);
            if (user.role !== 'reviewer') {
                $('#pinMsg').textContent = "This account isn't set up as a reviewer.";
                $('#pinMsg').className = 'form-msg error';
                return;
            }
            reviewerUid = user.id;
            sessionStorage.setItem('ps:reviewer-session', JSON.stringify({ uid: user.id, username: user.username }));
            showQueue();
        } catch (err) {
            $('#pinMsg').textContent = err.message || 'Sign-in failed.';
            $('#pinMsg').className = 'form-msg error';
        } finally {
            $('#pinSubmit').disabled = false;
        }
    }

    function showQueue() {
        $('#pinGate').classList.add('hidden');
        $('#queueView').classList.remove('hidden');
        renderQueue();
        renderCohortInsights();
    }

    // ============================================================
    //  Track tabs (typing feedback spec §7) — one reviewer sign-in,
    //  both tracks' queues from one screen.
    // ============================================================
    $$('.queue-tab').forEach(btn => btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        $$('.queue-tab').forEach(b => b.classList.toggle('active', b === btn));
        $('#presentationPanel').classList.toggle('hidden', tab !== 'presentation');
        $('#typingPanel').classList.toggle('hidden', tab !== 'typing');
        $('#studentsPanel').classList.toggle('hidden', tab !== 'students');
        if (tab === 'typing') renderTypingQueue();
        if (tab === 'students') renderStudentsDirectory(true);
    }));

    const cached = sessionStorage.getItem('ps:reviewer-session');
    if (cached) {
        try { reviewerUid = JSON.parse(cached).uid; showQueue(); } catch (e) { sessionStorage.removeItem('ps:reviewer-session'); }
    }

    // ============================================================
    //  Queue rendering
    // ============================================================
    const selectedTags = {}; // submissionId -> Set of tagIds

    ['filterStatus', 'filterLesson'].forEach(id => $('#' + id).addEventListener('change', renderQueue));
    let studentInsightsTimer = null;
    $('#filterStudent').addEventListener('input', () => {
        renderQueue();
        clearTimeout(studentInsightsTimer);
        studentInsightsTimer = setTimeout(renderStudentInsights, 350); // debounce — avoid a request per keystroke
    });

    $('#typingFilterStatus').addEventListener('change', renderTypingQueue);
    let typingFilterTimer = null;
    $('#typingFilterStudent').addEventListener('input', () => {
        clearTimeout(typingFilterTimer);
        typingFilterTimer = setTimeout(renderTypingQueue, 350);
    });

    async function renderQueue() {
        const status = $('#filterStatus').value;
        const lessonId = $('#filterLesson').value;
        const nameFilter = $('#filterStudent').value.trim().toLowerCase();

        let queue;
        try {
            queue = await PS.submissionStore.listQueue(reviewerUid, { status, lessonId: lessonId || undefined });
        } catch (err) {
            $('#queueList').innerHTML = `<div class="empty-queue">⚠️ Couldn't load the queue (${escapeHtml(err.message)}).</div>`;
            return;
        }
        if (nameFilter) queue = queue.filter(s => studentSearchText(s).includes(nameFilter));

        if (!queue.length) {
            $('#queueList').innerHTML = '<div class="empty-queue">📭 Nothing matches these filters right now.</div>';
            return;
        }

        // Feedback-stuck tracking: fetch comparisons once per distinct
        // student appearing among already-reviewed cards (nothing to show
        // on pending ones — there's no feedback yet to have tracked anything).
        const studentIdsNeedingComparisons = Array.from(new Set(queue.filter(s => s.status !== 'pending').map(s => s.studentId)));
        const comparisonsByStudent = {};
        await Promise.all(studentIdsNeedingComparisons.map(async (sid) => {
            try { comparisonsByStudent[sid] = await PS.submissionStore.getComparisons(reviewerUid, sid); }
            catch (e) { comparisonsByStudent[sid] = []; }
        }));

        $('#queueList').innerHTML = queue.map(sub => {
            if (!selectedTags[sub.id]) selectedTags[sub.id] = new Set();
            const tags = PS.submissionStore.tagsForLesson(sub.lessonId);
            const byCategory = {};
            tags.forEach(t => { (byCategory[t.category] = byCategory[t.category] || []).push(t); });

            let mediaHtml = '';
            if (sub.fileUrl) {
                mediaHtml += `<a class="btn btn-secondary btn-sm" href="${sub.fileUrl}" download="${escapeHtml(sub.fileName || 'deck.pptx')}" style="margin-right:8px;">⬇ Download ${escapeHtml(sub.fileName || 'deck.pptx')}</a>`;
            }
            if (sub.recordingUrl) {
                const isVideo = /\.(mp4|webm|mov)$/i.test(sub.recordingName || '') || (sub.recordingName || '').toLowerCase().includes('video');
                mediaHtml += `<div class="recorder-playback" style="max-width:420px;margin-top:10px;">${isVideo ? `<video controls src="${sub.recordingUrl}"></video>` : `<audio controls src="${sub.recordingUrl}"></audio>`}</div>`;
            }

            const isPending = sub.status === 'pending';
            const reviewSection = isPending ? `
                    <div class="tag-picker-grid">
                        ${Object.keys(byCategory).map(cat => `
                            <div class="tag-cat-group">
                                <div class="tag-cat-label">${escapeHtml(cat.replace('_', ' '))}</div>
                                <div>
                                    ${byCategory[cat].map(t => `<span class="tag-opt ${t.sentiment}" data-sub="${sub.id}" data-tag="${t.id}">${t.sentiment === 'positive' ? '✅' : '💡'} ${escapeHtml(t.label)}</span>`).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <textarea class="reflection-textarea" data-comment-for="${sub.id}" rows="2" maxlength="200" placeholder="Optional short comment (max 200 characters)…"></textarea>
                    <div class="check-panel">
                        <div style="display:flex;justify-content:flex-end;">
                            <button class="btn btn-primary btn-sm" data-submit-fb="${sub.id}">Submit feedback</button>
                        </div>
                    </div>
                ` : renderExistingFeedback(sub.feedback, sub.id, comparisonsByStudent[sub.studentId] || []);

            return `
                <div class="queue-card" data-id="${sub.id}">
                    <div class="q-head">
                        <div>
                            <span class="q-student">${studentHtml(sub)}</span>
                            <span class="status-chip ${sub.status}" style="margin-left:8px;">${escapeHtml(PS.submissionStore.LESSON_LABELS[sub.lessonId] || sub.lessonId)}</span>
                            ${sub.resubmissionOf ? '<span class="status-chip pending" style="margin-left:6px;">resubmission</span>' : ''}
                            ${!isPending ? '<span class="status-chip reviewed" style="margin-left:6px;">✓ reviewed</span>' : ''}
                        </div>
                        <span class="q-meta">${new Date(sub.createdAt).toLocaleString()}</span>
                    </div>
                    <div>${mediaHtml || '<span style="color:rgba(255,255,255,0.4);font-size:0.85rem;">No file attached.</span>'}</div>
                    ${reviewSection}
                </div>
            `;
        }).join('');

        $$('.tag-opt').forEach(chip => chip.addEventListener('click', () => {
            const subId = chip.dataset.sub, tagId = chip.dataset.tag;
            const set = selectedTags[subId];
            if (set.has(tagId)) { set.delete(tagId); chip.classList.remove('selected'); }
            else { set.add(tagId); chip.classList.add('selected'); }
        }));

        $$('[data-submit-fb]').forEach(btn => btn.addEventListener('click', async () => {
            const subId = btn.dataset.submitFb;
            const tagIds = Array.from(selectedTags[subId] || []);
            if (!tagIds.length) { showToast('Pick at least one tag before submitting.', 'error'); return; }
            const comment = $('[data-comment-for="' + subId + '"]').value.trim();
            btn.disabled = true;
            try {
                await PS.submissionStore.submitFeedback({ backendUid: reviewerUid, submissionId: subId, tagIds, comment });
                showToast('Feedback submitted.', 'success');
                delete selectedTags[subId];
                renderQueue();
            } catch (err) {
                showToast(err.message || 'Could not submit feedback.', 'error');
                btn.disabled = false;
            }
        }));
    }

    // ============================================================
    //  Typing queue rendering (typing feedback spec §7)
    //
    //  Reuses renderQueue()'s tag-picker markup/CSS and queue-card shell
    //  as-is (they were already generic). The one real structural
    //  difference: no file/recording to preview, so the media block is
    //  swapped for a plain numeric readout — WPM/accuracy/errors/duration.
    // ============================================================
    const selectedTypingTags = {}; // resultId -> Set of tagIds

    function formatTypingMetrics(r) {
        const runs = TypingStore.isIncomplete(r) ? ` · Runs: ${r.runsCompleted} of ${r.runsTotal}` : '';
        return `WPM: ${r.wpm.toFixed(1)} · Accuracy: ${r.accuracy.toFixed(1)}% · Errors: ${r.errorCount} · ${r.durationSeconds.toFixed(1)}s${runs}`;
    }
    // Class mode: a student who ran out of time can submit what they finished.
    function incompleteChip(r) {
        return TypingStore.isIncomplete(r)
            ? `<span class="status-chip" style="margin-left:6px;background:#E8A33D;color:#1a1a1a;border:1px solid #b9801f;font-weight:700;">Incomplete · ${r.runsCompleted} of ${r.runsTotal} runs</span>`
            : '';
    }

    // Phase 4 (optional, spec §9) — plain before/after WPM & accuracy next
    // to the reviewed attempt that started tracking them. Same
    // deliberately-neutral framing as the presentation track's
    // metric-comparison: no color, no verdict, a teacher reads the numbers.
    function renderTypingComparison(comparisons, resultId) {
        const match = (comparisons || []).find(c => c.baselineResultId === resultId);
        if (!match || !match.resolved) return '';
        const wpmPct = match.wpmBefore !== 0 ? ` (${match.wpmDelta >= 0 ? '+' : ''}${((match.wpmDelta / match.wpmBefore) * 100).toFixed(0)}%)` : '';
        return `<div class="metric-comparison">📊 wpm: ${match.wpmBefore.toFixed(1)} → ${match.wpmAfter.toFixed(1)}${wpmPct} · accuracy: ${match.accuracyBefore.toFixed(1)}% → ${match.accuracyAfter.toFixed(1)}%</div>`;
    }

    function renderExistingTypingFeedback(fb, resultId, comparisons) {
        if (!fb) return '<p style="font-size:0.82rem;color:rgba(255,255,255,0.45);margin-top:8px;">Reviewed — no feedback details available.</p>';
        const tagList = (fb.tagIds || []).map(id => TypingStore.TYPING_TAGS.find(t => t.id === id)).filter(Boolean);
        return `<div style="margin-top:10px;">
            ${tagList.map(t => `<span class="tag-chip ${t.sentiment}">${t.sentiment === 'positive' ? '✅' : '💡'} ${escapeHtml(t.label)}</span>`).join('')}
            ${fb.comment ? `<div class="reviewer-comment">“${escapeHtml(fb.comment)}”</div>` : ''}
            ${renderTypingComparison(comparisons, resultId)}
        </div>`;
    }

    // Per-student progress history (across every session, not just a
    // baseline/final pair) — a reviewer clicks "📈 Progress" once per
    // student and gets every attempt they've ever submitted, oldest first,
    // so growth (or a plateau) is visible at a glance rather than only on
    // whichever single result happens to be the tagged baseline/final.
    function renderHistoryRow(r) {
        const label = TypingStore.CHECKPOINT_LABELS[r.checkpointId] || r.checkpointId;
        const when = new Date(r.createdAt).toLocaleDateString();
        return `<tr>
            <td style="padding:4px 10px 4px 0;white-space:nowrap;">${escapeHtml(when)}</td>
            <td style="padding:4px 10px;">${escapeHtml(label)}${TypingStore.isIncomplete(r) ? ' <b>(incomplete: ' + r.runsCompleted + ' of ' + r.runsTotal + ' runs)</b>' : ''}</td>
            <td style="padding:4px 10px;font-family:var(--font-mono);">${r.wpm.toFixed(1)} wpm</td>
            <td style="padding:4px 10px;font-family:var(--font-mono);">${r.accuracy.toFixed(1)}%</td>
            <td style="padding:4px 0;">${r.status === 'reviewed' ? '✓ reviewed' : '⏳ pending'}</td>
        </tr>`;
    }

    function renderHistoryPanel(history, comparisons) {
        if (!history.length) return '<div style="padding:10px 0;font-size:0.82rem;color:rgba(255,255,255,0.5);">No sessions submitted yet.</div>';
        const sorted = [...history].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const resolved = (comparisons || []).find(c => c.resolved);
        const summary = resolved
            ? `<div class="metric-comparison" style="margin-bottom:8px;">📊 Overall: wpm ${resolved.wpmBefore.toFixed(1)} → ${resolved.wpmAfter.toFixed(1)} · accuracy ${resolved.accuracyBefore.toFixed(1)}% → ${resolved.accuracyAfter.toFixed(1)}%</div>`
            : '';
        return `${summary}<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
            <thead><tr style="color:rgba(255,255,255,0.5);text-align:left;">
                <th style="padding:4px 10px 4px 0;font-weight:500;">Date</th>
                <th style="padding:4px 10px;font-weight:500;">Session</th>
                <th style="padding:4px 10px;font-weight:500;">WPM</th>
                <th style="padding:4px 10px;font-weight:500;">Accuracy</th>
                <th style="padding:4px 0;font-weight:500;">Status</th>
            </tr></thead>
            <tbody>${sorted.map(renderHistoryRow).join('')}</tbody>
        </table>`;
    }

    const loadedHistory = {}; // studentId -> rendered HTML, cached so re-toggling doesn't refetch

    async function toggleStudentHistory(studentId, panel) {
        const isOpen = panel.style.display !== 'none';
        if (isOpen) { panel.style.display = 'none'; return; }
        panel.style.display = 'block';
        if (loadedHistory[studentId]) { panel.innerHTML = loadedHistory[studentId]; return; }
        panel.innerHTML = '<div style="padding:10px 0;font-size:0.82rem;color:rgba(255,255,255,0.5);">Loading…</div>';
        try {
            const [history, comparisons] = await Promise.all([
                TypingStore.listQueue(reviewerUid, { studentId, status: 'all' }),
                TypingStore.getComparisons(reviewerUid, studentId).catch(() => []),
            ]);
            const html = renderHistoryPanel(history, comparisons);
            loadedHistory[studentId] = html;
            panel.innerHTML = html;
        } catch (err) {
            panel.innerHTML = `<div style="padding:10px 0;font-size:0.82rem;color:#f2a0a0;">Couldn't load this student's history (${escapeHtml(err.message)}).</div>`;
        }
    }

    // ============================================================
    //  Students tab: every passport on the server, with a way to reset a
    //  forgotten PIN (PINs are stored hashed and can never be shown) and a CSV
    //  of names + passport numbers.
    // ============================================================
    let studentsCache = [];
    const studentName = (s) => s.nickname || s.username;

    async function renderStudentsDirectory(reload) {
        const list = $('#studentsList');
        if (reload || !studentsCache.length) {
            list.innerHTML = '<div class="empty-queue">Loading…</div>';
            try {
                studentsCache = await Backend.apiFetch('/api/auth/students', { headers: { 'x-user-id': String(reviewerUid) } });
            } catch (err) {
                list.innerHTML = `<div class="empty-queue">⚠️ Couldn't load the students (${escapeHtml(err.message)}).</div>`;
                return;
            }
        }
        const q = ($('#studentsFilter').value || '').trim().toLowerCase();
        const rows = studentsCache
            .filter(s => (studentName(s) + ' ' + s.username).toLowerCase().includes(q))
            .sort((a, b) => studentName(a).toLowerCase().localeCompare(studentName(b).toLowerCase()));
        if (!rows.length) { list.innerHTML = '<div class="empty-queue">📭 No students match.</div>'; return; }
        const cell = 'padding:6px 14px 6px 0;';
        list.innerHTML = `<table style="border-collapse:collapse;font-size:0.9rem;color:rgba(255,255,255,0.9);">
            <thead><tr style="text-align:left;color:rgba(255,255,255,0.6);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;">
                <th style="${cell}">Name</th><th style="${cell}">Passport number</th><th style="${cell}">Joined</th><th></th></tr></thead>
            <tbody>${rows.map(s => `<tr style="border-top:1px solid rgba(255,255,255,0.08);">
                <td style="${cell}font-weight:600;">${escapeHtml(studentName(s))}</td>
                <td style="${cell}font-family:var(--font-mono);">${escapeHtml(s.username)}</td>
                <td style="${cell}">${escapeHtml(new Date(s.createdAt).toLocaleDateString())}</td>
                <td style="${cell}"><button class="btn btn-secondary btn-sm" data-reset-pin="${s.id}">Reset PIN</button></td>
            </tr>`).join('')}</tbody></table>`;
        $$('[data-reset-pin]').forEach(btn => btn.addEventListener('click', async () => {
            const s = studentsCache.find(x => String(x.id) === btn.dataset.resetPin);
            if (!s) return;
            const pin = window.prompt('New 4-digit PIN for ' + studentName(s) + ' (' + s.username + ').\n\nTell the student their new PIN. It is stored scrambled and cannot be shown again.');
            if (pin === null) return;
            if (!/^[0-9]{4}$/.test(pin.trim())) { window.alert('The PIN must be exactly 4 digits.'); return; }
            try {
                await Backend.apiFetch('/api/auth/students/' + s.id + '/reset-pin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-user-id': String(reviewerUid) },
                    body: JSON.stringify({ pin: pin.trim() })
                });
                window.alert(studentName(s) + '’s PIN is now ' + pin.trim() + '. Tell them now; it will not be shown again.');
            } catch (err) {
                window.alert('Could not reset the PIN: ' + err.message);
            }
        }));
    }
    $('#studentsFilter').addEventListener('input', () => renderStudentsDirectory(false));
    $('#studentsCsv').addEventListener('click', () => {
        const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const lines = ['Name,Passport number,Joined'].concat(studentsCache
            .slice().sort((a, b) => studentName(a).toLowerCase().localeCompare(studentName(b).toLowerCase()))
            .map(s => [q(studentName(s)), q(s.username), q(new Date(s.createdAt).toLocaleDateString())].join(',')));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
        a.download = 'uttoron-students.csv';
        a.click();
    });

    // ============================================================
    //  Session rankings (class mode). Once every result for a typing session
    //  has been reviewed, the students who took it are ranked by one
    //  aggregate score, highest first:
    //      score = WPM x accuracy / 100   (net speed: mistakes reduce it)
    //  One row per student: their most recent COMPLETE attempt. Students who
    //  only submitted an incomplete attempt (they ran out of time) are listed
    //  separately and not ranked, because they typed fewer runs.
    // ============================================================
    function typingScore(r) { return Math.round(r.wpm * r.accuracy / 100 * 10) / 10; }

    function buildSessionRankings(rows) {
        const bySession = {};
        rows.forEach(r => { (bySession[r.checkpointId] = bySession[r.checkpointId] || []).push(r); });
        const order = Object.keys(TypingStore.CHECKPOINT_LABELS);
        const byScore = (a, b) => typingScore(b) - typingScore(a) || b.accuracy - a.accuracy || studentText(a).localeCompare(studentText(b));
        return Object.keys(bySession).map(cp => {
            const list = bySession[cp];
            const byStudent = {};
            list.forEach(r => { (byStudent[r.studentId] = byStudent[r.studentId] || []).push(r); });
            const ranked = [], incomplete = [];
            Object.values(byStudent).forEach(att => {
                att.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest first
                const complete = att.find(r => !TypingStore.isIncomplete(r));
                if (complete) ranked.push(complete); else incomplete.push(att[0]);
            });
            ranked.sort(byScore); incomplete.sort(byScore);
            return { checkpointId: cp, pending: list.filter(r => r.status === 'pending').length, ranked, incomplete };
        }).sort((a, b) => {
            const ia = order.indexOf(a.checkpointId), ib = order.indexOf(b.checkpointId);
            return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
        });
    }

    function renderRankingTable(rows, ranked) {
        const cell = 'padding:5px 12px 5px 0;';
        const body = rows.map((r, i) => `<tr>
            <td style="${cell}font-family:var(--font-mono);">${ranked ? (i + 1) : '–'}</td>
            <td style="${cell}">${studentHtml(r)}</td>
            <td style="${cell}font-family:var(--font-mono);font-weight:700;">${typingScore(r).toFixed(1)}</td>
            <td style="${cell}font-family:var(--font-mono);">${r.wpm.toFixed(1)}</td>
            <td style="${cell}font-family:var(--font-mono);">${r.accuracy.toFixed(1)}%</td>
            ${ranked ? '' : `<td style="${cell}">${r.runsCompleted} of ${r.runsTotal} runs</td>`}
        </tr>`).join('');
        let avg = '';
        if (ranked && rows.length > 1) {
            const mean = (f) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
            avg = `<tr style="border-top:1px solid rgba(255,255,255,0.18);color:rgba(255,255,255,0.7);">
                <td style="${cell}"></td><td style="${cell}">Class average</td>
                <td style="${cell}font-family:var(--font-mono);">${mean(typingScore).toFixed(1)}</td>
                <td style="${cell}font-family:var(--font-mono);">${mean(r => r.wpm).toFixed(1)}</td>
                <td style="${cell}font-family:var(--font-mono);">${mean(r => r.accuracy).toFixed(1)}%</td></tr>`;
        }
        return `<table style="border-collapse:collapse;font-size:0.88rem;color:rgba(255,255,255,0.9);margin:6px 0 4px;">
            <thead><tr style="text-align:left;color:rgba(255,255,255,0.6);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;">
                <th style="${cell}">${ranked ? 'Rank' : ''}</th><th style="${cell}">Student</th><th style="${cell}">Score</th><th style="${cell}">WPM</th><th style="${cell}">Accuracy</th>${ranked ? '' : `<th style="${cell}">Runs</th>`}
            </tr></thead><tbody>${body}${avg}</tbody></table>`;
    }

    async function renderTypingRankings() {
        const el = $('#typingRankings');
        if (!el) return;
        let rows;
        try { rows = await TypingStore.listQueue(reviewerUid, { status: 'all' }); }
        catch (err) { el.innerHTML = ''; return; }
        const sessions = buildSessionRankings(rows);
        const ready = sessions.filter(s => s.pending === 0 && (s.ranked.length || s.incomplete.length));
        const waiting = sessions.filter(s => s.pending > 0);
        if (!ready.length && !waiting.length) { el.innerHTML = ''; return; }
        const label = (s) => escapeHtml(TypingStore.CHECKPOINT_LABELS[s.checkpointId] || s.checkpointId);
        el.innerHTML = `
            <div style="margin:4px 0 18px;padding:14px 16px;border:1px solid rgba(255,255,255,0.12);border-radius:12px;">
                <div style="font-weight:700;font-size:1rem;margin-bottom:2px;">📊 Session rankings</div>
                <div style="font-size:0.78rem;color:rgba(255,255,255,0.65);margin-bottom:8px;">Shown once every result for a session is reviewed. Score = WPM × accuracy ÷ 100, highest first; each student's latest complete attempt counts.</div>
                ${ready.map((s, i) => `
                    <details ${i === 0 ? 'open' : ''} style="margin:6px 0;">
                        <summary style="cursor:pointer;font-weight:600;">${label(s)} <span style="font-weight:400;color:rgba(255,255,255,0.65);">· ${s.ranked.length} ranked${s.incomplete.length ? ', ' + s.incomplete.length + ' incomplete' : ''}</span></summary>
                        ${s.ranked.length ? renderRankingTable(s.ranked, true) : ''}
                        ${s.incomplete.length ? `<div style="font-size:0.78rem;color:rgba(255,255,255,0.65);margin-top:6px;">Incomplete, not ranked:</div>${renderRankingTable(s.incomplete, false)}` : ''}
                    </details>`).join('')}
                ${waiting.map(s => `<div style="font-size:0.82rem;color:rgba(255,255,255,0.65);margin-top:6px;">⏳ ${label(s)}: ${s.pending} result${s.pending === 1 ? '' : 's'} still to review — the ranking appears when they are all reviewed.</div>`).join('')}
            </div>`;
    }

    async function renderTypingQueue() {
        renderTypingRankings(); // independent of the status/name filters below
        const status = $('#typingFilterStatus').value;
        const nameFilter = $('#typingFilterStudent').value.trim().toLowerCase();

        let queue;
        try {
            queue = await TypingStore.listQueue(reviewerUid, { status });
        } catch (err) {
            $('#typingQueueList').innerHTML = `<div class="empty-queue">⚠️ Couldn't load the queue (${escapeHtml(err.message)}).</div>`;
            return;
        }
        if (nameFilter) queue = queue.filter(r => studentSearchText(r).includes(nameFilter));

        if (!queue.length) {
            $('#typingQueueList').innerHTML = '<div class="empty-queue">📭 Nothing matches these filters right now.</div>';
            return;
        }

        // Comparisons (Phase 4) — only meaningful for already-reviewed
        // attempts, same reasoning as the presentation queue.
        const studentIdsNeedingComparisons = Array.from(new Set(queue.filter(r => r.status !== 'pending').map(r => r.studentId)));
        const comparisonsByStudent = {};
        await Promise.all(studentIdsNeedingComparisons.map(async (sid) => {
            try { comparisonsByStudent[sid] = await TypingStore.getComparisons(reviewerUid, sid); }
            catch (e) { comparisonsByStudent[sid] = []; }
        }));

        const seenStudents = new Set(); // one "📈 Progress" toggle per student, not per submission
        $('#typingQueueList').innerHTML = queue.map(r => {
            if (!selectedTypingTags[r.id]) selectedTypingTags[r.id] = new Set();
            const tagsList = TypingStore.tagsForTypingCheckpoint();
            const byCategory = {};
            tagsList.forEach(t => { (byCategory[t.category] = byCategory[t.category] || []).push(t); });

            const showHistoryBtn = !seenStudents.has(r.studentId);
            seenStudents.add(r.studentId);

            const isPending = r.status === 'pending';
            const reviewSection = isPending ? `
                    <div class="tag-picker-grid">
                        ${Object.keys(byCategory).map(cat => `
                            <div class="tag-cat-group">
                                <div class="tag-cat-label">${escapeHtml(cat.replace('_', ' '))}</div>
                                <div>
                                    ${byCategory[cat].map(t => `<span class="tag-opt ${t.sentiment}" data-typing-sub="${r.id}" data-tag="${t.id}">${t.sentiment === 'positive' ? '✅' : '💡'} ${escapeHtml(t.label)}</span>`).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <textarea class="reflection-textarea" data-typing-comment-for="${r.id}" rows="2" maxlength="200" placeholder="Optional short comment (max 200 characters)…"></textarea>
                    <div class="check-panel">
                        <div style="display:flex;justify-content:flex-end;">
                            <button class="btn btn-primary btn-sm" data-submit-typing-fb="${r.id}">Submit feedback</button>
                        </div>
                    </div>
                ` : renderExistingTypingFeedback(r.feedback, r.id, comparisonsByStudent[r.studentId] || []);

            return `
                <div class="queue-card" data-id="${r.id}">
                    <div class="q-head">
                        <div>
                            <span class="q-student">${studentHtml(r)}</span>
                            <span class="status-chip ${r.status}" style="margin-left:8px;">${escapeHtml(TypingStore.CHECKPOINT_LABELS[r.checkpointId] || r.checkpointId)}</span>
                            ${incompleteChip(r)}
                            ${!isPending ? '<span class="status-chip reviewed" style="margin-left:6px;">✓ reviewed</span>' : ''}
                            ${showHistoryBtn ? `<button class="btn btn-secondary btn-sm" style="margin-left:8px;" data-toggle-history="${r.studentId}">📈 Progress</button>` : ''}
                        </div>
                        <span class="q-meta">${new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                    <div style="font-family:var(--font-mono);font-size:0.82rem;color:rgba(255,255,255,0.75);">${formatTypingMetrics(r)}</div>
                    ${reviewSection}
                    ${showHistoryBtn ? `<div class="history-panel" data-history-panel="${r.studentId}" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);"></div>` : ''}
                </div>
            `;
        }).join('');

        $$('[data-toggle-history]').forEach(btn => btn.addEventListener('click', () => {
            const sid = btn.dataset.toggleHistory;
            const panel = $(`[data-history-panel="${sid}"]`);
            if (panel) toggleStudentHistory(sid, panel);
        }));

        $$('[data-typing-sub]').forEach(chip => chip.addEventListener('click', () => {
            const resId = chip.dataset.typingSub, tagId = chip.dataset.tag;
            const set = selectedTypingTags[resId];
            if (set.has(tagId)) { set.delete(tagId); chip.classList.remove('selected'); }
            else { set.add(tagId); chip.classList.add('selected'); }
        }));

        $$('[data-submit-typing-fb]').forEach(btn => btn.addEventListener('click', async () => {
            const resId = btn.dataset.submitTypingFb;
            const tagIds = Array.from(selectedTypingTags[resId] || []);
            if (!tagIds.length) { showToast('Pick at least one tag before submitting.', 'error'); return; }
            const comment = $('[data-typing-comment-for="' + resId + '"]').value.trim();
            btn.disabled = true;
            try {
                await TypingStore.submitFeedback({ backendUid: reviewerUid, resultId: resId, tagIds, comment });
                showToast('Feedback submitted.', 'success');
                delete selectedTypingTags[resId];
                renderTypingQueue();
            } catch (err) {
                showToast(err.message || 'Could not submit feedback.', 'error');
                btn.disabled = false;
            }
        }));
    }

    // Plain labels only — no "good"/"bad" framing anywhere near these numbers.
    const METRIC_LABELS = {
        avgWordsPerSlide: 'words/slide',
        avgBulletsPerSlide: 'bullets/slide',
        imageToTextRatio: 'image-to-text ratio',
        distinctFontCount: 'distinct fonts',
    };
    function formatMetricValue(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }

    // Feedback-stuck tracking display (implementation brief §5.5): plain
    // before/after numbers next to the tag that started tracking them.
    // Deliberately no color, no score, no pass/fail — a teacher reads the
    // numbers and decides what they mean.
    function renderMetricComparison(category, comparisons, submissionId) {
        const match = comparisons.find(c => c.category === category && c.baselineSubmissionId === submissionId);
        if (!match || !match.resolved) return '';
        const lines = match.metrics.map(m => {
            const pct = m.percentChange === null ? '' : ` (${m.percentChange >= 0 ? '+' : ''}${m.percentChange.toFixed(0)}%)`;
            return `${escapeHtml(METRIC_LABELS[m.metric] || m.metric)}: ${formatMetricValue(m.before)} → ${formatMetricValue(m.after)}${pct}`;
        });
        return `<div class="metric-comparison">📊 ${lines.join(' · ')}</div>`;
    }

    function renderExistingFeedback(fb, submissionId, comparisons) {
        if (!fb) return '<p style="font-size:0.82rem;color:rgba(255,255,255,0.45);margin-top:8px;">Reviewed — no feedback details available.</p>';
        const tags = (fb.tagIds || []).map(id => PS.submissionStore.TAGS.find(t => t.id === id)).filter(Boolean);
        const categoriesSeen = new Set();
        return `<div style="margin-top:10px;">
            ${tags.map(t => `<span class="tag-chip ${t.sentiment}">${t.sentiment === 'positive' ? '✅' : '💡'} ${escapeHtml(t.label)}</span>`).join('')}
            ${fb.comment ? `<div class="reviewer-comment">“${escapeHtml(fb.comment)}”</div>` : ''}
            ${tags.map(t => {
                if (categoriesSeen.has(t.category)) return '';
                categoriesSeen.add(t.category);
                return renderMetricComparison(t.category, comparisons || [], submissionId);
            }).join('')}
        </div>`;
    }

    // ============================================================
    //  Cohort insights (PRD §5, Should-have — weakness-pattern aggregation)
    // ============================================================
    async function renderCohortInsights() {
        try {
            const data = await PS.submissionStore.getCohortWeaknessPatterns(reviewerUid, 30);
            if (!data.totalReviews) {
                $('#cohortInsights').innerHTML = '<p style="color:rgba(255,255,255,0.45);font-size:0.85rem;">No reviews yet in this window.</p>';
                return;
            }
            $('#cohortInsights').innerHTML = data.patterns.map(p =>
                `<span class="tag-chip constructive" style="margin:3px 6px 3px 0;">${escapeHtml(p.category.replace('_', ' '))}: ${p.count}/${data.totalReviews} reviews (${p.percentage}%)</span>`
            ).join('');
        } catch (err) {
            $('#cohortInsights').innerHTML = `<p style="color:rgba(255,255,255,0.45);font-size:0.85rem;">Couldn't load insights (${escapeHtml(err.message)}).</p>`;
        }
    }

    // ============================================================
    //  Per-student growth portfolio + weakness patterns (PRD §5, Should-have)
    // ============================================================
    async function renderStudentInsights() {
        const nameFilter = $('#filterStudent').value.trim().toLowerCase();
        if (!nameFilter) { $('#studentInsights').innerHTML = ''; return; }

        // Resolve name -> studentId against the FULL history (status=all),
        // not whatever status filter happens to be active — a student with
        // only reviewed work would otherwise vanish while "Pending" is selected.
        let allSubs;
        try { allSubs = await PS.submissionStore.listQueue(reviewerUid, { status: 'all' }); }
        catch (err) { $('#studentInsights').innerHTML = ''; return; }

        const matches = allSubs.filter(s => studentSearchText(s).includes(nameFilter));
        const uniqueStudentIds = Array.from(new Set(matches.map(s => s.studentId)));
        if (uniqueStudentIds.length !== 1) { $('#studentInsights').innerHTML = ''; return; } // no match, or ambiguous — nothing safe to show

        const studentId = uniqueStudentIds[0];
        const resolvedName = studentText(matches[0]);

        let portfolio, patterns;
        try {
            [portfolio, patterns] = await Promise.all([
                PS.submissionStore.getGrowthPortfolio(reviewerUid, studentId),
                PS.submissionStore.getWeaknessPatterns(reviewerUid, studentId),
            ]);
        } catch (err) {
            $('#studentInsights').innerHTML = `<div class="ledger" style="margin-bottom:16px;"><div class="ledger-title">⚠️ Couldn't load insights for ${escapeHtml(resolvedName)} (${escapeHtml(err.message)})</div></div>`;
            return;
        }

        const patternsHtml = patterns.patterns.length
            ? patterns.patterns.map(p => `<span class="tag-chip constructive" style="margin:3px 6px 3px 0;">${escapeHtml(p.category.replace('_', ' '))}: flagged in ${p.count} of ${p.totalReviews} reviews</span>`).join('')
            : '<p style="color:rgba(255,255,255,0.45);font-size:0.85rem;">No recurring patterns yet.</p>';

        let portfolioHtml;
        if (!portfolio.touchpoint1 || !portfolio.capstone) {
            portfolioHtml = '<p style="color:rgba(255,255,255,0.45);font-size:0.85rem;">Not enough deck submissions yet to compare touchpoint 1 with the capstone.</p>';
        } else {
            const side = (label, entry) => `
                <div style="flex:1;min-width:200px;">
                    <div style="font-family:var(--font-mono);font-size:0.68rem;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:4px;">${label}</div>
                    ${entry.fileUrl ? `<a class="btn btn-secondary btn-sm" href="${entry.fileUrl}" download="${escapeHtml(entry.fileName || 'deck.pptx')}">⬇ ${escapeHtml(entry.fileName || 'deck.pptx')}</a>` : ''}
                </div>`;
            const diffHtml = portfolio.diff
                ? `<div class="metric-comparison" style="margin-top:12px;">📊 ${portfolio.diff.map(d => {
                    const pct = d.percentChange === null ? '' : ` (${d.percentChange >= 0 ? '+' : ''}${d.percentChange.toFixed(0)}%)`;
                    return `${escapeHtml(METRIC_LABELS[d.metric] || d.metric)}: ${formatMetricValue(d.before)} → ${formatMetricValue(d.after)}${pct}`;
                }).join(' · ')}</div>`
                : '<p style="color:rgba(255,255,255,0.45);font-size:0.82rem;margin-top:8px;">One of these decks didn\'t parse cleanly, so a numeric comparison isn\'t available — the files are still downloadable above.</p>';
            portfolioHtml = `<div style="display:flex;gap:16px;flex-wrap:wrap;">${side('Touchpoint 1', portfolio.touchpoint1)}${side('Capstone', portfolio.capstone)}</div>${diffHtml}`;
        }

        $('#studentInsights').innerHTML = `
            <div class="ledger" style="margin-bottom:16px;">
                <div class="ledger-title">🌱 Growth portfolio — ${escapeHtml(resolvedName)}</div>
                <div style="margin-top:8px;">${portfolioHtml}</div>
            </div>
            <div class="ledger" style="margin-bottom:20px;">
                <div class="ledger-title">🔁 Recurring patterns — ${escapeHtml(resolvedName)}</div>
                <div style="margin-top:8px;">${patternsHtml}</div>
            </div>
        `;
    }

    // Re-render if this tab regains focus (e.g. a new submission came in elsewhere).
    window.addEventListener('focus', () => {
        if ($('#queueView').classList.contains('hidden')) return;
        if (!$('#typingPanel').classList.contains('hidden')) { renderTypingQueue(); return; }
        renderQueue();
        renderCohortInsights();
    });
})();

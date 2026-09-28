(function () {
    "use strict";

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

    // Bridged student accounts are named `nickname#passportNum.salt` (see
    // submissionStore.js — the salt keeps accounts collision-free across
    // devices). Strip the salt for a clean, human-readable display name.
    function displayName(studentName) { return String(studentName || '').replace(/\.[a-z0-9]{6}$/i, ''); }

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
        if (tab === 'typing') renderTypingQueue();
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
        if (nameFilter) queue = queue.filter(s => displayName(s.studentName).toLowerCase().includes(nameFilter));

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
                            <span class="q-student">${escapeHtml(displayName(sub.studentName))}</span>
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
        return `WPM: ${r.wpm.toFixed(1)} · Accuracy: ${r.accuracy.toFixed(1)}% · Errors: ${r.errorCount} · ${r.durationSeconds.toFixed(1)}s`;
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

    async function renderTypingQueue() {
        const status = $('#typingFilterStatus').value;
        const nameFilter = $('#typingFilterStudent').value.trim().toLowerCase();

        let queue;
        try {
            queue = await TypingStore.listQueue(reviewerUid, { status });
        } catch (err) {
            $('#typingQueueList').innerHTML = `<div class="empty-queue">⚠️ Couldn't load the queue (${escapeHtml(err.message)}).</div>`;
            return;
        }
        if (nameFilter) queue = queue.filter(r => displayName(r.studentName).toLowerCase().includes(nameFilter));

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

        $('#typingQueueList').innerHTML = queue.map(r => {
            if (!selectedTypingTags[r.id]) selectedTypingTags[r.id] = new Set();
            const tagsList = TypingStore.tagsForTypingCheckpoint();
            const byCategory = {};
            tagsList.forEach(t => { (byCategory[t.category] = byCategory[t.category] || []).push(t); });

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
                            <span class="q-student">${escapeHtml(displayName(r.studentName))}</span>
                            <span class="status-chip ${r.status}" style="margin-left:8px;">${escapeHtml(TypingStore.CHECKPOINT_LABELS[r.checkpointId] || r.checkpointId)}</span>
                            ${!isPending ? '<span class="status-chip reviewed" style="margin-left:6px;">✓ reviewed</span>' : ''}
                        </div>
                        <span class="q-meta">${new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                    <div style="font-family:var(--font-mono);font-size:0.82rem;color:rgba(255,255,255,0.75);">${formatTypingMetrics(r)}</div>
                    ${reviewSection}
                </div>
            `;
        }).join('');

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

        const matches = allSubs.filter(s => displayName(s.studentName).toLowerCase().includes(nameFilter));
        const uniqueStudentIds = Array.from(new Set(matches.map(s => s.studentId)));
        if (uniqueStudentIds.length !== 1) { $('#studentInsights').innerHTML = ''; return; } // no match, or ambiguous — nothing safe to show

        const studentId = uniqueStudentIds[0];
        const resolvedName = displayName(matches[0].studentName);

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

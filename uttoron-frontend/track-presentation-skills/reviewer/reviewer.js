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
    window.addEventListener('focus', () => { if (!$('#queueView').classList.contains('hidden')) { renderQueue(); renderCohortInsights(); } });
})();

(function () {
    "use strict";

    const $ = PS.$, escapeHtml = PS.escapeHtml;
    const session = PS.loadSession();

    const LESSON_ORDER = ['lesson_9_checkpoint', 'lesson_12_delivery', 'lesson_13_capstone'];

    function renderFeedbackBlock(fb) {
        const tags = (fb.tagIds || []).map(id => PS.submissionStore.TAGS.find(t => t.id === id)).filter(Boolean);
        const byCategory = {};
        tags.forEach(t => { (byCategory[t.category] = byCategory[t.category] || []).push(t); });
        return `<div style="margin-top:10px;">
            ${Object.keys(byCategory).map(cat => `
                <div style="margin-bottom:8px;">
                    <div style="font-family:var(--font-mono);font-size:0.62rem;text-transform:uppercase;letter-spacing:0.06em;color:rgba(255,255,255,0.4);margin-bottom:3px;">${escapeHtml(cat.replace('_', ' '))}</div>
                    ${byCategory[cat].map(t => `<span class="tag-chip ${t.sentiment}">${t.sentiment === 'positive' ? '✅' : '💡'} ${escapeHtml(t.label)}</span>`).join('')}
                </div>
            `).join('')}
            ${fb.comment ? `<div class="reviewer-comment">“${escapeHtml(fb.comment)}”</div>` : ''}
        </div>`;
    }

    function renderCard(lessonId, entry) {
        const label = PS.submissionStore.LESSON_LABELS[lessonId];
        if (!entry) {
            return `<div class="submission-card" style="opacity:0.5;">
                <div class="sub-head"><span class="sub-file">${escapeHtml(label)}</span><span class="status-chip pending">Not yet submitted</span></div>
            </div>`;
        }
        const { submission, feedback: fb } = entry;
        return `<div class="submission-card">
            <div class="sub-head">
                <span class="sub-file">${escapeHtml(label)}</span>
                <span class="status-chip ${submission.status}">${submission.status === 'reviewed' ? '✓ Reviewed' : '⏳ Pending'}</span>
            </div>
            <div class="sub-meta">Submitted ${new Date(submission.createdAt).toLocaleString()}${submission.resubmissionOf ? ' · resubmission' : ''}</div>
            ${fb ? renderFeedbackBlock(fb) : '<p style="font-size:0.82rem;color:rgba(255,255,255,0.45);margin-top:8px;">Waiting on a reviewer.</p>'}
        </div>`;
    }

    async function init() {
        if (!session) {
            $('#passportBody').innerHTML = `<div class="instruction-card">Sign in from the home page to see your feedback passport.</div>`;
            return;
        }
        let backendUid;
        try {
            backendUid = await PS.submissionStore.identify(session, PS.Storage);
        } catch (err) {
            $('#passportBody').innerHTML = `<div class="instruction-card">⚠️ Couldn't connect to the review system (${escapeHtml(err.message)}). Reload to try again.</div>`;
            return;
        }
        if (!backendUid) {
            $('#passportBody').innerHTML = `<div class="instruction-card">Sign in from the home page to see your feedback passport.</div>`;
            return;
        }

        const mine = await PS.submissionStore.listMine(backendUid);
        // Newest submission per lesson (a resubmission should show the latest, not the original).
        const latestByLesson = {};
        mine.forEach(entry => {
            const id = entry.submission.lessonId;
            if (!latestByLesson[id] || entry.submission.createdAt > latestByLesson[id].submission.createdAt) latestByLesson[id] = entry;
        });

        const submittedCount = LESSON_ORDER.filter(id => latestByLesson[id]).length;
        $('#passportBody').innerHTML = `
            <div class="ledger" style="margin-bottom:20px;">
                <div class="ledger-title">Progress</div>
                <p style="color:var(--ink);">${submittedCount} of ${LESSON_ORDER.length} checkpoints submitted.</p>
            </div>
            ${LESSON_ORDER.map(id => renderCard(id, latestByLesson[id])).join('')}
        `;
    }
    init();
})();

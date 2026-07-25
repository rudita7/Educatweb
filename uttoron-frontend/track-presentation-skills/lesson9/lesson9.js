(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-lesson9-checkpoint',
        trackKey: 'presentation-skills',
        modules: [
            { n: 1, label: 'Context' },
            { n: 2, label: 'Submit' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, markModuleDone, session, Storage } = shell;

    const LESSON_ID = 'lesson_9_checkpoint';
    let pendingFile = null;
    let mine = [];
    let backendUid = null;

    $('#m1-continue').addEventListener('click', () => { markModuleDone(1); shell.goToModule(2); });

    // ============================================================
    //  Submit area
    // ============================================================
    function latestStatus() {
        if (!mine.length) return null;
        return mine[0].submission.status; // listMine returns newest-first
    }

    function renderSubmitArea() {
        if (!session || !backendUid) {
            $('#submitArea').innerHTML = `<div class="instruction-card">Sign in from the home page first — a reviewer needs to know whose work this is.</div>`;
            return;
        }
        const status = latestStatus();
        if (status === 'pending') {
            $('#submitArea').innerHTML = `<div class="instruction-card">⏳ Your deck is already in the review queue. You'll see feedback below once it's reviewed — no need to resubmit.</div>`;
            return;
        }

        const isResubmit = status === 'reviewed';
        $('#submitArea').innerHTML = `
            <label class="upload-zone" id="dropZone">
                <div class="upload-icon">📎</div>
                <div><strong>${isResubmit ? 'Submit a revised .pptx' : 'Click to choose your .pptx file'}</strong></div>
                <div class="upload-hint">.pptx only · up to ${PS.submissionStore.MAX_FILE_MB}MB</div>
                <input type="file" id="fileInput" accept=".pptx" />
            </label>
            <div id="fileChipHolder"></div>
            <div class="check-panel">
                <div style="display:flex;justify-content:flex-end;">
                    <button class="btn btn-primary btn-sm" id="submitBtn" disabled>Submit for feedback</button>
                </div>
                <div class="feedback" id="submitFeedback"></div>
            </div>
        `;
        const zone = $('#dropZone');
        const input = $('#fileInput');
        input.addEventListener('change', () => handleFile(input.files[0]));
        ['dragover', 'dragenter'].forEach(evt => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add('dragover'); }));
        ['dragleave', 'drop'].forEach(evt => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove('dragover'); }));
        zone.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

        function handleFile(file) {
            const check = PS.submissionStore.validatePptx(file);
            if (!check.ok) { feedback('#submitFeedback', false, check.reason); pendingFile = null; renderFileChip(); return; }
            pendingFile = file;
            feedback('#submitFeedback', true, '✅ Ready to submit.');
            renderFileChip();
        }
        function renderFileChip() {
            $('#fileChipHolder').innerHTML = pendingFile
                ? `<div class="file-chip">📄 ${escapeHtml(pendingFile.name)} (${(pendingFile.size / 1024 / 1024).toFixed(1)}MB) <button type="button" class="remove-file" id="removeFile">✕</button></div>`
                : '';
            const rm = $('#removeFile');
            if (rm) rm.addEventListener('click', () => { pendingFile = null; input.value = ''; renderFileChip(); $('#submitBtn').disabled = true; });
            $('#submitBtn').disabled = !pendingFile;
        }

        $('#submitBtn').addEventListener('click', async () => {
            if (!pendingFile) return;
            $('#submitBtn').disabled = true;
            try {
                await PS.submissionStore.createSubmission({
                    lessonId: LESSON_ID,
                    submissionType: 'file',
                    file: pendingFile,
                    resubmissionOf: isResubmit ? mine[0].submission.id : null,
                    backendUid,
                    onRetry: (n, total) => feedback('#submitFeedback', true, `⏳ Connection dropped — retrying (${n}/${total})…`)
                });
                feedback('#submitFeedback', true, '✅ Submitted — you\'ll see feedback here once it\'s reviewed.');
                showToast('Deck submitted for feedback!', 'success');
                markModuleDone(2);
                pendingFile = null;
                await refresh();
            } catch (err) {
                feedback('#submitFeedback', false, err.message || 'Something went wrong submitting your file. Try again.');
                $('#submitBtn').disabled = false;
            }
        });
    }

    // ============================================================
    //  Status / feedback area
    // ============================================================
    function renderStatusArea() {
        if (!mine.length) { $('#statusArea').innerHTML = ''; return; }
        $('#statusArea').innerHTML = `
            <div class="ledger-title" style="color:rgba(255,255,255,0.4);margin-bottom:10px;">Your submissions</div>
            ${mine.map(({ submission, feedback: fb }) => `
                <div class="submission-card">
                    <div class="sub-head">
                        <span class="sub-file">📄 ${escapeHtml(submission.fileName || 'submission')}</span>
                        <span class="status-chip ${submission.status}">${submission.status === 'reviewed' ? '✓ Reviewed' : '⏳ Pending'}</span>
                    </div>
                    <div class="sub-meta">Submitted ${new Date(submission.createdAt).toLocaleString()}${submission.resubmissionOf ? ' · resubmission' : ''}</div>
                    ${fb ? renderFeedbackBlock(fb) : (submission.status === 'pending' ? '<p style="font-size:0.82rem;color:rgba(255,255,255,0.45);margin-top:8px;">Waiting on a reviewer — turnaround depends on volunteer availability.</p>' : '')}
                </div>
            `).join('')}
        `;
    }
    function renderFeedbackBlock(fb) {
        const tags = fb.tagIds.map(id => PS.submissionStore.TAGS.find(t => t.id === id)).filter(Boolean);
        const positives = tags.filter(t => t.sentiment === 'positive');
        const constructive = tags.filter(t => t.sentiment === 'constructive');
        return `
            <div style="margin-top:10px;">
                ${positives.map(t => `<span class="tag-chip positive">✅ ${escapeHtml(t.label)}</span>`).join('')}
                ${constructive.map(t => `<span class="tag-chip constructive">💡 ${escapeHtml(t.label)}</span>`).join('')}
                ${fb.comment ? `<div class="reviewer-comment">“${escapeHtml(fb.comment)}”</div>` : ''}
            </div>
        `;
    }

    // ============================================================
    //  INIT
    // ============================================================
    async function refresh() {
        mine = backendUid ? await PS.submissionStore.listMine(backendUid, LESSON_ID) : [];
        renderSubmitArea();
        renderStatusArea();
    }

    async function init() {
        shell.renderRail();
        if (!session) {
            shell.goToModule(1);
            showToast('You’re not signed in — sign in from the home page to submit for feedback.', 'error');
            return;
        }
        try {
            backendUid = await PS.submissionStore.identify(session, Storage);
        } catch (err) {
            $('#submitArea').innerHTML = `<div class="instruction-card">⚠️ Couldn't connect to the review system (${escapeHtml(err.message)}). Check your connection and reload this page.</div>`;
            shell.goToModule(1);
            return;
        }
        await refresh();
        if (mine.length) { markModuleDone(1); markModuleDone(2); } // an earlier visit already submitted
        shell.goToModule(1);
    }
    init();
})();

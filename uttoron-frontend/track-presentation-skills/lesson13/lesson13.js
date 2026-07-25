(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-lesson13-capstone',
        trackKey: 'presentation-skills',
        modules: [
            { n: 1, label: 'Overview' },
            { n: 2, label: 'Your Deck' },
            { n: 3, label: 'Deliver' },
            { n: 4, label: 'Submit' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, markModuleDone, session, Storage } = shell;

    const LESSON_ID = 'lesson_13_capstone';
    let backendUid = null;
    $('#m1-continue').addEventListener('click', () => { markModuleDone(1); shell.goToModule(2); });

    // ============================================================
    //  STEP 2 — Upload the deck (.pptx)
    // ============================================================
    let deckFile = null;

    function renderDeckUpload() {
        $('#deckUploadArea').innerHTML = `
            <label class="upload-zone" id="deckZone">
                <div class="upload-icon">📎</div>
                <div><strong>Click to choose your final .pptx</strong></div>
                <div class="upload-hint">.pptx only · up to ${PS.submissionStore.MAX_FILE_MB}MB</div>
                <input type="file" id="deckInput" accept=".pptx" />
            </label>
            <div id="deckChipHolder"></div>
        `;
        $('#deckInput').addEventListener('change', () => handleDeckFile($('#deckInput').files[0]));
    }
    function handleDeckFile(file) {
        const check = PS.submissionStore.validatePptx(file);
        if (!check.ok) { showToast(check.reason, 'error'); return; }
        deckFile = file;
        $('#deckChipHolder').innerHTML = `<div class="file-chip">📄 ${escapeHtml(file.name)} (${(file.size / 1024 / 1024).toFixed(1)}MB) <button type="button" class="remove-file" id="removeDeckFile">✕</button></div>`;
        $('#removeDeckFile').addEventListener('click', () => { deckFile = null; $('#deckChipHolder').innerHTML = ''; updateM2(); });
        updateM2();
    }
    function updateM2() { $('#m2-continue').disabled = !deckFile; }
    $('#m2-continue').addEventListener('click', () => { markModuleDone(2); shell.goToModule(3); });

    // ============================================================
    //  STEP 3 — Record or upload the delivery (2-4 min)
    // ============================================================
    let recordedBlob = null;
    let recordedFromUpload = false;
    let recorder = null;
    let ticking = null;

    function renderRecorderBox() {
        if (!PS.recorder.isSupported()) { renderUploadFallback('Recording isn\'t supported on this browser.'); return; }
        $('#recorderBox').innerHTML = `
            <div class="record-row">
                <button class="record-btn" id="recBtn" type="button">🎙️</button>
                <div>
                    <div class="record-timer" id="recTimer">0:00</div>
                    <div class="record-status" id="recStatus">Tap to start — aim for 2 to 4 minutes</div>
                </div>
            </div>
            <div class="recorder-playback" id="playbackHolder"></div>
            <p style="font-size:0.76rem;color:rgba(255,255,255,0.4);margin-top:10px;">Presented live instead? Upload a video someone else recorded:
                <label style="text-decoration:underline;cursor:pointer;color:var(--marigold);">choose a file<input type="file" id="liveUpload" accept="audio/*,video/*" style="display:none;" /></label>
            </p>
        `;
        $('#recBtn').addEventListener('click', toggleRecording);
        $('#liveUpload').addEventListener('change', (e) => handleUpload(e.target.files[0]));
    }
    async function toggleRecording() {
        const btn = $('#recBtn');
        if (recorder && recorder.mediaRecorder && recorder.mediaRecorder.state === 'recording') { recorder.stop(); return; }
        try {
            recorder = new PS.recorder.InBrowserRecorder({ maxSeconds: 4 * 60 + 30 });
            recorder.onStop = (blob) => {
                recordedBlob = blob; recordedFromUpload = false;
                clearInterval(ticking);
                btn.classList.remove('recording');
                $('#recStatus').textContent = 'Recorded — listen/watch back below';
                renderPlayback();
            };
            await recorder.start();
            btn.classList.add('recording');
            $('#recStatus').textContent = 'Recording… tap again to stop (auto-stops at 4:30)';
            ticking = setInterval(() => {
                const s = Math.floor(recorder.elapsedMs() / 1000);
                $('#recTimer').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
            }, 200);
        } catch (err) {
            renderUploadFallback('Microphone unavailable (' + (err && err.message ? err.message : 'permission denied') + ').');
        }
    }
    function renderUploadFallback(reason) {
        $('#recorderBox').innerHTML = `
            <div class="instruction-card">🎙️ ${escapeHtml(reason)} Upload a recording of your delivery instead.</div>
            <label class="upload-zone" style="margin-top:10px;">
                <div class="upload-icon">📎</div>
                <div><strong>Click to upload your delivery recording</strong></div>
                <div class="upload-hint">Audio or video · up to ${PS.submissionStore.MAX_RECORDING_MB}MB</div>
                <input type="file" id="fallbackUpload" accept="audio/*,video/*" />
            </label>
            <div class="recorder-playback" id="playbackHolder"></div>
        `;
        $('#fallbackUpload').addEventListener('change', (e) => handleUpload(e.target.files[0]));
    }
    function handleUpload(file) {
        if (!file) return;
        const check = PS.submissionStore.validateRecordingBlob(file);
        if (!check.ok) { showToast(check.reason, 'error'); return; }
        recordedBlob = file; recordedFromUpload = true;
        renderPlayback();
    }
    function renderPlayback() {
        const url = PS.submissionStore.fileObjectURL(recordedBlob);
        const isVideo = recordedBlob.type.startsWith('video');
        $('#playbackHolder').innerHTML = `
            ${isVideo ? `<video controls src="${url}"></video>` : `<audio controls src="${url}"></audio>`}
            <button class="btn btn-secondary btn-sm" id="reRecord" type="button" style="margin-top:10px;">↺ Replace this recording</button>
        `;
        $('#reRecord').addEventListener('click', () => { recordedBlob = null; updateM3(); PS.recorder.isSupported() ? renderRecorderBox() : renderUploadFallback('Choose a different recording.'); });
        updateM3();
    }
    function updateM3() { $('#m3-continue').disabled = !recordedBlob; }
    $('#m3-continue').addEventListener('click', () => {
        feedback('#m3-feedback', true, '✅ Delivery captured. One last step — submit both together.');
        markModuleDone(3);
        shell.goToModule(4);
        renderSubmitArea();
    });

    // ============================================================
    //  STEP 4 — Submit deck + recording together
    // ============================================================
    let mine = [];
    function latestStatus() { return mine.length ? mine[0].submission.status : null; }

    function renderSubmitArea() {
        if (!session || !backendUid) { $('#submitArea').innerHTML = `<div class="instruction-card">Sign in from the home page first — a reviewer needs to know whose work this is.</div>`; return; }
        const status = latestStatus();
        if (status === 'pending') { $('#submitArea').innerHTML = `<div class="instruction-card">⏳ Your capstone is already in the review queue. Check below once it's reviewed.</div>`; return; }
        if (!deckFile || !recordedBlob) { $('#submitArea').innerHTML = `<div class="instruction-card">Go back and finish Steps 2 and 3 — you need both a deck file and a recording.</div>`; return; }

        $('#submitArea').innerHTML = `
            <div class="file-chip">📄 ${escapeHtml(deckFile.name)}</div>
            <div class="file-chip" style="margin-left:8px;">🎙️ Delivery recording (${(recordedBlob.size / 1024 / 1024).toFixed(1)}MB)</div>
            <div class="check-panel">
                <div style="display:flex;justify-content:flex-end;">
                    <button class="btn btn-primary btn-sm" id="submitCapBtn">Submit deck + recording for full review</button>
                </div>
                <div class="feedback" id="submitFeedback"></div>
            </div>
        `;
        $('#submitCapBtn').addEventListener('click', async () => {
            $('#submitCapBtn').disabled = true;
            try {
                await PS.submissionStore.createSubmission({
                    lessonId: LESSON_ID,
                    submissionType: 'both',
                    file: deckFile,
                    recording: recordedBlob,
                    recordingName: recordedFromUpload ? 'upload' : 'capstone-delivery.webm',
                    resubmissionOf: status === 'reviewed' ? mine[0].submission.id : null,
                    backendUid,
                    onRetry: (n, total) => feedback('#submitFeedback', true, `⏳ Connection dropped — retrying (${n}/${total})…`)
                });
                feedback('#submitFeedback', true, '✅ Submitted! This is the full-review checkpoint — expect feedback across all six categories.');
                showToast('Capstone submitted for review!', 'success');
                markModuleDone(4);
                await refresh();
            } catch (err) {
                feedback('#submitFeedback', false, err.message || 'Something went wrong submitting your files. Try again.');
                $('#submitCapBtn').disabled = false;
            }
        });
    }

    function renderStatusArea() {
        if (!mine.length) { $('#statusArea').innerHTML = ''; return; }
        $('#statusArea').innerHTML = `
            <div class="ledger-title" style="color:rgba(255,255,255,0.4);margin-bottom:10px;">Your capstone submissions</div>
            ${mine.map(({ submission, feedback: fb }) => `
                <div class="submission-card">
                    <div class="sub-head">
                        <span class="sub-file">📄 ${escapeHtml(submission.fileName || 'deck')} + 🎙️ recording</span>
                        <span class="status-chip ${submission.status}">${submission.status === 'reviewed' ? '✓ Reviewed' : '⏳ Pending'}</span>
                    </div>
                    <div class="sub-meta">Submitted ${new Date(submission.createdAt).toLocaleString()}${submission.resubmissionOf ? ' · resubmission' : ''}</div>
                    ${fb ? renderFeedbackBlock(fb) : (submission.status === 'pending' ? '<p style="font-size:0.82rem;color:rgba(255,255,255,0.45);margin-top:8px;">Waiting on a reviewer.</p>' : '')}
                </div>
            `).join('')}
        `;
    }
    function renderFeedbackBlock(fb) {
        const tags = fb.tagIds.map(id => PS.submissionStore.TAGS.find(t => t.id === id)).filter(Boolean);
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

    async function refresh() {
        mine = backendUid ? await PS.submissionStore.listMine(backendUid, LESSON_ID) : [];
        renderSubmitArea();
        renderStatusArea();
    }

    // ============================================================
    //  INIT
    // ============================================================
    async function init() {
        shell.renderRail();
        renderDeckUpload();
        renderRecorderBox();
        if (!session) {
            shell.goToModule(1);
            showToast('You’re not signed in — sign in from the home page to submit for review.', 'error');
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
        if (mine.length) { markModuleDone(1); markModuleDone(2); markModuleDone(3); markModuleDone(4); }
        shell.goToModule(1);
    }
    init();
})();

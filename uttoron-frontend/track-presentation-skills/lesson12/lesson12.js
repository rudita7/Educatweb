(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-lesson12-delivery',
        trackKey: 'presentation-skills',
        modules: [
            { n: 1, label: 'Context' },
            { n: 2, label: 'Record & Review' },
            { n: 3, label: 'Submit' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, markModuleDone, session, Storage } = shell;

    const LESSON_ID = 'lesson_12_delivery';
    let backendUid = null;
    $('#m1-continue').addEventListener('click', () => { markModuleDone(1); shell.goToModule(2); });

    // ============================================================
    //  STEP 2 — Record + self-review (manual — no automatic detection)
    // ============================================================
    let recorder = null;
    let recordedBlob = null;
    let recordedFromUpload = false;
    const review = { paused: false, steady: false, varied: false, tally: '' };

    function renderRecorderBox() {
        if (!PS.recorder.isSupported()) { renderUploadFallback('Recording isn\'t supported on this browser.'); return; }
        $('#recorderBox').innerHTML = `
            <div class="record-row">
                <button class="record-btn" id="recBtn" type="button">🎙️</button>
                <div>
                    <div class="record-timer" id="recTimer">0:00</div>
                    <div class="record-status" id="recStatus">Tap to start recording</div>
                </div>
            </div>
            <div class="recorder-playback" id="playbackHolder"></div>
            <p style="font-size:0.76rem;color:rgba(255,255,255,0.4);margin-top:10px;">🔒 This recording is only used for this checkpoint's submission — nothing is analyzed automatically, and nothing leaves your device except what you choose to submit for review.</p>
        `;
        $('#recBtn').addEventListener('click', toggleRecording);
    }

    let ticking = null;
    async function toggleRecording() {
        const btn = $('#recBtn');
        if (recorder && recorder.mediaRecorder && recorder.mediaRecorder.state === 'recording') {
            recorder.stop();
            return;
        }
        try {
            recorder = new PS.recorder.InBrowserRecorder({ maxSeconds: 90 });
            recorder.onStop = (blob) => {
                recordedBlob = blob;
                recordedFromUpload = false;
                clearInterval(ticking);
                btn.classList.remove('recording');
                $('#recStatus').textContent = 'Recorded — listen back below';
                renderPlayback();
                renderSelfReview();
            };
            await recorder.start();
            btn.classList.add('recording');
            $('#recStatus').textContent = 'Recording… tap again to stop';
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
            <div class="instruction-card">🎙️ ${escapeHtml(reason)} No problem — record with your phone's voice/camera app instead, then upload the file here.</div>
            <label class="upload-zone" style="margin-top:10px;">
                <div class="upload-icon">📎</div>
                <div><strong>Click to upload your recording</strong></div>
                <div class="upload-hint">Audio or video · up to ${PS.submissionStore.MAX_RECORDING_MB}MB</div>
                <input type="file" id="fallbackUpload" accept="audio/*,video/*" />
            </label>
            <div class="recorder-playback" id="playbackHolder"></div>
        `;
        $('#fallbackUpload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const check = PS.submissionStore.validateRecordingBlob(file);
            if (!check.ok) { showToast(check.reason, 'error'); return; }
            recordedBlob = file;
            recordedFromUpload = true;
            renderPlayback();
            renderSelfReview();
        });
    }

    function renderPlayback() {
        const url = PS.submissionStore.fileObjectURL(recordedBlob);
        const isVideo = recordedBlob.type.startsWith('video');
        $('#playbackHolder').innerHTML = `
            ${isVideo ? `<video controls src="${url}"></video>` : `<audio controls src="${url}"></audio>`}
            <button class="btn btn-secondary btn-sm" id="reRecord" type="button" style="margin-top:10px;">↺ ${recordedFromUpload ? 'Choose a different file' : 'Re-record'}</button>
        `;
        $('#reRecord').addEventListener('click', () => {
            recordedBlob = null;
            $('#selfReviewArea').innerHTML = '';
            Object.assign(review, { paused: false, steady: false, varied: false, tally: '' });
            updateM2();
            PS.recorder.isSupported() && !recordedFromUpload ? renderRecorderBox() : renderUploadFallback('Choose a different recording.');
        });
    }

    function renderSelfReview() {
        $('#selfReviewArea').innerHTML = `
            <div class="ledger">
                <div class="ledger-title">Self-review — listen back, then be honest</div>
                <ul class="self-review-list">
                    <li><label style="display:flex;gap:10px;"><input type="checkbox" id="rv-paused" /> I paused briefly after key points, instead of rushing straight through.</label></li>
                    <li><label style="display:flex;gap:10px;"><input type="checkbox" id="rv-steady" /> My pace felt steady — not rushed, not dragging.</label></li>
                    <li><label style="display:flex;gap:10px;"><input type="checkbox" id="rv-varied" /> My tone varied instead of staying flat the whole time.</label></li>
                </ul>
                <div class="filler-tally-row">
                    <label for="rv-tally" style="font-size:0.85rem;">Rough filler-word tally (your own count, just from listening):</label>
                    <input type="number" id="rv-tally" min="0" value="${review.tally}" />
                </div>
            </div>
        `;
        $('#rv-paused').checked = review.paused; $('#rv-steady').checked = review.steady; $('#rv-varied').checked = review.varied;
        ['paused', 'steady', 'varied'].forEach(k => $('#rv-' + k).addEventListener('change', (e) => { review[k] = e.target.checked; updateM2(); }));
        $('#rv-tally').addEventListener('input', (e) => { review.tally = e.target.value; updateM2(); });
        updateM2();
    }

    function updateM2() {
        const reviewDone = review.paused && review.steady && review.varied && review.tally !== '';
        $('#m2-continue').disabled = !(recordedBlob && reviewDone);
    }
    $('#m2-continue').addEventListener('click', () => {
        feedback('#m2-feedback', true, '✅ Self-review complete. Ready to send this to a reviewer.');
        markModuleDone(2);
        shell.goToModule(3);
        renderSubmitArea();
    });

    // ============================================================
    //  STEP 3 — Submit for feedback
    // ============================================================
    let mine = [];
    function latestStatus() { return mine.length ? mine[0].submission.status : null; }

    function renderSubmitArea() {
        if (!session || !backendUid) { $('#submitArea').innerHTML = `<div class="instruction-card">Sign in from the home page first — a reviewer needs to know whose work this is.</div>`; return; }
        const status = latestStatus();
        if (status === 'pending') { $('#submitArea').innerHTML = `<div class="instruction-card">⏳ Your recording is already in the review queue. Check below once it's reviewed.</div>`; return; }
        if (!recordedBlob) { $('#submitArea').innerHTML = `<div class="instruction-card">Go back to Step 2 and record your sample first.</div>`; return; }

        $('#submitArea').innerHTML = `
            <div class="file-chip">🎙️ Your recorded sample (${(recordedBlob.size / 1024 / 1024).toFixed(1)}MB)</div>
            <div class="check-panel">
                <div style="display:flex;justify-content:flex-end;">
                    <button class="btn btn-primary btn-sm" id="submitRecBtn">Submit for feedback</button>
                </div>
                <div class="feedback" id="submitFeedback"></div>
            </div>
        `;
        $('#submitRecBtn').addEventListener('click', async () => {
            $('#submitRecBtn').disabled = true;
            try {
                await PS.submissionStore.createSubmission({
                    lessonId: LESSON_ID,
                    submissionType: 'recording',
                    recording: recordedBlob,
                    recordingName: recordedFromUpload ? 'upload' : 'delivery-sample.webm',
                    resubmissionOf: status === 'reviewed' ? mine[0].submission.id : null,
                    backendUid,
                    onRetry: (n, total) => feedback('#submitFeedback', true, `⏳ Connection dropped — retrying (${n}/${total})…`)
                });
                feedback('#submitFeedback', true, '✅ Submitted — you\'ll see feedback here once it\'s reviewed.');
                showToast('Recording submitted for feedback!', 'success');
                markModuleDone(3);
                await refresh();
            } catch (err) {
                feedback('#submitFeedback', false, err.message || 'Something went wrong submitting your recording. Try again.');
                $('#submitRecBtn').disabled = false;
            }
        });
    }

    function renderStatusArea() {
        if (!mine.length) { $('#statusArea').innerHTML = ''; return; }
        $('#statusArea').innerHTML = `
            <div class="ledger-title" style="color:rgba(255,255,255,0.4);margin-bottom:10px;">Your submissions</div>
            ${mine.map(({ submission, feedback: fb }) => `
                <div class="submission-card">
                    <div class="sub-head">
                        <span class="sub-file">🎙️ Delivery recording</span>
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
        const positives = tags.filter(t => t.sentiment === 'positive');
        const constructive = tags.filter(t => t.sentiment === 'constructive');
        return `<div style="margin-top:10px;">
            ${positives.map(t => `<span class="tag-chip positive">✅ ${escapeHtml(t.label)}</span>`).join('')}
            ${constructive.map(t => `<span class="tag-chip constructive">💡 ${escapeHtml(t.label)}</span>`).join('')}
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
        renderRecorderBox();
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
        if (mine.length) { markModuleDone(1); markModuleDone(2); markModuleDone(3); }
        shell.goToModule(1);
    }
    init();
})();

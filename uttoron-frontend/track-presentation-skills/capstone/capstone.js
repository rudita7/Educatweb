(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-capstone',
        trackKey: 'presentation-skills-v2',
        modules: [
            { n: 1, label: 'Finalize' },
            { n: 2, label: 'Q&A Prep' },
            { n: 3, label: 'Real Thing' },
            { n: 4, label: 'Reflect' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, markModuleDone, session, Storage } = shell;

    let _deck = PS.deckStore.getDeck(session); // cached — mutated in place, never re-fetched mid-session
    function deck() { return _deck; }
    function renderDeckStatus() { $('#deckStatus').innerHTML = PS.deckStore.deckStatusHtml(deck()); }

    const LESSON_IDS = [
        'ps-lesson1-getting-started', 'ps-lesson2-slides-layouts', 'ps-lesson3-content',
        'ps-lesson4-enhance', 'ps-lesson5-polish', 'ps-lesson6-delivery'
    ];
    function getProgress() {
        if (!session) return {};
        return Storage.get('progress:' + session.num) || {};
    }

    // ============================================================
    //  STEP 1 — Finalize
    // ============================================================
    function finalizeChecks() {
        const d = deck();
        const progress = getProgress();
        const deckExists = !!(d && d.slides.length);
        const slideRulesOk = deckExists && d.slides.every(s => PS.slideRuleEngine.summarize(PS.slideRuleEngine.evaluateSlide(s)).failed.length === 0);
        const deckRulesOk = deckExists && PS.slideRuleEngine.summarize(PS.slideRuleEngine.evaluateDeck(d)).failed.length === 0;
        const lessonsOk = LESSON_IDS.every(id => !!progress[id]);
        return [
            { id: 'deckExists', label: 'You have a deck with slides', done: deckExists },
            { id: 'slideRulesOk', label: 'Every slide passes its quality checks', done: slideRulesOk },
            { id: 'deckRulesOk', label: 'Your deck is internally consistent', done: deckRulesOk },
            { id: 'lessonsOk', label: 'Lessons 1–6 are all complete', done: lessonsOk }
        ];
    }
    function renderFinalize() {
        const checks = finalizeChecks();
        $('#finalize-checklist').innerHTML = checks.map(c => `
            <li class="${c.done ? 'done' : 'pending'}"><span class="tick">${c.done ? '✓' : ''}</span>${escapeHtml(c.label)}</li>
        `).join('');
        return checks.every(c => c.done);
    }
    $('#m1-continue').addEventListener('click', () => {
        const allOk = renderFinalize();
        if (!allOk) { feedback('#m1-feedback', false, 'Finish the items above first — go back to whichever lesson is incomplete.'); return; }
        feedback('#m1-feedback', true, '✅ Your deck and practice are ready.');
        markModuleDone(1);
        shell.goToModule(2);
    });

    // ============================================================
    //  STEP 2 — Prepare for Questions (Q&A FSM drill)
    // ============================================================
    let qaQuestions = [];
    let qaIdx = 0;
    let qaFsm = null;
    let qaCompleted = false;

    function initQA() {
        const d = deck();
        qaQuestions = PS.qaBank.pickQuestions(d ? d.title : '', 3);
        qaIdx = 0;
        qaFsm = new PS.QAFSM();
        qaCompleted = false;
        renderQA();
    }

    function renderQA() {
        if (qaCompleted) {
            $('#qa-drill').innerHTML = `
                <div class="feedback show ok">✅ Q&amp;A readiness drill complete — ${qaQuestions.length} of ${qaQuestions.length} questions answered.</div>
                <button class="btn btn-primary btn-sm" id="qa-continue" style="margin-top:12px;">Continue →</button>
            `;
            $('#qa-continue').addEventListener('click', () => { markModuleDone(2); shell.goToModule(3); });
            return;
        }
        const q = qaQuestions[qaIdx];
        const state = qaFsm.state;
        $('#qa-drill').innerHTML = `
            <div class="qa-card">
                <div class="task-line">Question ${qaIdx + 1} of ${qaQuestions.length} · state: ${escapeHtml(state)}</div>
                <div class="qa-question">${escapeHtml(q.text)}</div>
                <textarea id="qa-response" rows="3" placeholder="Answer as you actually would, out loud" ${state !== 'Question' && state !== 'FollowUp' ? 'disabled' : ''}></textarea>
                <div style="margin-top:10px;display:flex;gap:10px;" id="qa-actions"></div>
                <div id="qa-score" style="margin-top:10px;"></div>
            </div>
        `;
        const actions = $('#qa-actions');
        if (state === 'Question' || state === 'FollowUp') {
            actions.innerHTML = '<button class="btn btn-primary btn-sm" id="qa-submit" type="button">Submit answer</button>';
            $('#qa-submit').addEventListener('click', () => {
                const text = $('#qa-response').value;
                if (state === 'Question') qaFsm.transition('Response');
                qaFsm.transition('Scored');
                const result = PS.qaBank.scoreResponse(q, text);
                $('#qa-score').innerHTML = `
                    <div class="feedback show ${result.passed ? 'ok' : 'error'}">
                        ${result.passed ? '✅ Solid answer.' : '❌ Try to be more specific.'}
                        ${result.hits.length ? ` Touched on: ${result.hits.map(escapeHtml).join(', ')}.` : ' No rubric keywords found.'}
                        (${result.wordCount} words)
                    </div>
                `;
                if (result.passed) {
                    if (qaIdx < qaQuestions.length - 1) qaFsm.transition('NextQuestion');
                    else qaFsm.transition('Closing');
                } else {
                    qaFsm.transition('FollowUp');
                }
                renderQAActionsAfterScore(result.passed);
            });
        }
    }
    function renderQAActionsAfterScore(passed) {
        const actions = $('#qa-actions');
        if (passed) {
            if (qaFsm.state === 'Closing') {
                actions.innerHTML += '<button class="btn btn-secondary btn-sm" id="qa-finish" type="button">Finish drill →</button>';
                $('#qa-finish').addEventListener('click', () => { qaCompleted = true; renderQA(); });
            } else {
                actions.innerHTML += '<button class="btn btn-secondary btn-sm" id="qa-next" type="button">Next question →</button>';
                $('#qa-next').addEventListener('click', () => { qaIdx++; qaFsm = new PS.QAFSM(); renderQA(); });
            }
        } else {
            actions.innerHTML += '<button class="btn btn-secondary btn-sm" id="qa-retry" type="button">Try again</button>';
            $('#qa-retry').addEventListener('click', () => { $('#qa-response').value = ''; renderQA(); });
        }
    }

    // ============================================================
    //  STEP 3 — The Real Thing
    // ============================================================
    $('#m3-continue').addEventListener('click', () => {
        if (!$('#m3-delivered').checked) {
            feedback('#m3-feedback', false, 'Check the box once you\'ve actually delivered your presentation to a real audience.');
            return;
        }
        feedback('#m3-feedback', true, '✅ Recorded. Continue to the reflection.');
        markModuleDone(3);
        shell.goToModule(4);
    });

    // ============================================================
    //  STEP 4 — Reflect
    // ============================================================
    const rubricValues = { clarity: 0, pacing: 0, engagement: 0 };
    function renderRubrics() {
        $$('.rubric-scale').forEach(scale => {
            const key = scale.dataset.rubric;
            scale.innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" data-val="${n}" class="${rubricValues[key] === n ? 'active' : ''}">${n}</button>`).join('');
            $$('button', scale).forEach(btn => btn.addEventListener('click', () => { rubricValues[key] = Number(btn.dataset.val); renderRubrics(); }));
        });
    }
    $('#m4-submit').addEventListener('click', () => {
        const wentWell = $('#r-went-well').value.trim();
        const change = $('#r-change').value.trim();
        if (wentWell.length < 8 || change.length < 8) {
            feedback('#m4-feedback', false, 'Write at least a sentence for each reflection question.');
            return;
        }
        if (!rubricValues.clarity || !rubricValues.pacing || !rubricValues.engagement) {
            feedback('#m4-feedback', false, 'Rate all three (clarity, pacing, audience engagement) before submitting.');
            return;
        }
        if (session) {
            Storage.set('ps:reflection:' + session.num, {
                wentWell, change, rubric: { ...rubricValues }, submittedAt: Date.now()
            });
        }
        feedback('#m4-feedback', true, '✅ Reflection submitted. This stamp reflects that you completed the full process — including delivering to a real audience — not an automatic grade of how the delivery went. Only you know how it actually went; that\'s what the reflection above is for.');
        markModuleDone(4);
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        shell.renderRail();
        renderDeckStatus();
        renderFinalize();
        initQA();
        renderRubrics();
        shell.goToModule(1);
        if (!session) showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
        if (!deck()) showToast('No deck found — complete Lesson 1 first.', 'error');
    }

    init();
})();

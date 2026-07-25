(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-lesson6-motion',
        trackKey: 'presentation-skills',
        modules: [
            { n: 1, label: 'Practice' },
            { n: 2, label: 'Checkpoint' },
            { n: 3, label: 'Do It For Real' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, markModuleDone, session } = shell;

    // ============================================================
    //  STEP 1 — Practice: one transition, one animation
    // ============================================================
    let activeTab = 'Home';
    let transition = null;
    let animation = null;
    let previewKey = 0;

    const TRANSITIONS = [
        { id: 'fade', label: 'Fade' },
        { id: 'push', label: 'Push' },
        { id: 'wipe', label: 'Wipe' }
    ];
    const ANIMATIONS = [
        { id: 'appear', label: 'Appear' },
        { id: 'flyIn', label: 'Fly In' },
        { id: 'zoom', label: 'Zoom' }
    ];

    function renderAnim() {
        const chrome = PS_PPT.chrome({
            tabs: ['File', 'Home', 'Transitions', 'Animations'],
            activeTab, hotspotTab: null,
            filename: 'My First Deck — PowerPoint'
        });

        let body;
        if (activeTab === 'Transitions') {
            body = PS_PPT.ribbon(PS_PPT.group('Transition to This Slide', TRANSITIONS.map(t => ({ key: t.id, icon: '🔀', label: t.label }))));
        } else if (activeTab === 'Animations') {
            body = PS_PPT.ribbon(PS_PPT.group('Animation', ANIMATIONS.map(a => ({ key: a.id, icon: '⭐', label: a.label }))));
        } else {
            body = PS_PPT.ribbon(PS_PPT.group('Slides', [{ icon: '➕', label: 'New Slide' }]));
        }

        const animClass = animation ? 'demo-' + animation : '';
        body += `<div class="ppt-canvas-wrap"><div class="ppt-canvas" data-key="${previewKey}">
            <div class="slide-title ${animClass}">Weekly Visits</div>
            ${transition ? `<span class="anim-badge-demo">transition: ${escapeHtml(transition)}</span>` : ''}
        </div></div>`;

        $('#animWindow').innerHTML = chrome + body;
        $$('#animWindow .ppt-tab').forEach(tab => tab.addEventListener('click', () => { activeTab = tab.dataset.tab; renderAnim(); }));
        $$('#animWindow [data-btn]').forEach(btn => btn.addEventListener('click', () => {
            if (activeTab === 'Transitions') { transition = btn.dataset.btn; feedback('#m1-feedback', true, `✅ Transition set to <strong>${escapeHtml(btn.dataset.btn)}</strong>. Now try Animations.`); }
            if (activeTab === 'Animations') { animation = btn.dataset.btn; previewKey++; feedback('#m1-feedback', true, `✅ Title will now <strong>${escapeHtml(btn.dataset.btn)}</strong> in.`); }
            renderAnim();
            updateM1();
        }));
    }
    function updateM1() {
        const n = (transition ? 1 : 0) + (animation ? 1 : 0);
        $('#m1-status').textContent = n === 0 ? 'Pick a transition and an animation' : (n + ' of 2 chosen — transition: ' + (transition || '—') + ', animation: ' + (animation || '—'));
        $('#m1-continue').disabled = n < 2;
    }
    $('#m1-continue').addEventListener('click', () => { markModuleDone(1); shell.goToModule(2); });

    // ============================================================
    //  STEP 2 — Checkpoint: rate 3 slides
    // ============================================================
    const RATE_SLIDES = [
        { id: 'a', desc: 'Every bullet flies in from a different direction, one at a time, with a "whoosh" sound on each.', correct: 'too-much' },
        { id: 'b', desc: 'The slide fades in cleanly, and the title has one gentle "appear" — nothing else moves.', correct: 'just-right' },
        { id: 'c', desc: 'Six different animation effects are used across one slide, each with its own timing.', correct: 'too-much' }
    ];
    const rateAnswers = {};

    function renderRateCards() {
        $('#rateCards').innerHTML = RATE_SLIDES.map(s => `
            <div class="rate-card" data-id="${s.id}">
                <p style="color:var(--ink);font-size:0.9rem;">${escapeHtml(s.desc)}</p>
                <div class="rate-buttons">
                    <button type="button" data-choice="just-right">✅ Just right</button>
                    <button type="button" data-choice="too-much">🚫 Too much</button>
                </div>
            </div>
        `).join('');
        $$('.rate-card').forEach(card => {
            const s = RATE_SLIDES.find(x => x.id === card.dataset.id);
            $$('button', card).forEach(btn => btn.addEventListener('click', () => {
                const ok = btn.dataset.choice === s.correct;
                $$('button', card).forEach(b => b.classList.remove('chosen', 'correct', 'wrong'));
                btn.classList.add('chosen', ok ? 'correct' : 'wrong');
                rateAnswers[s.id] = ok;
                updateM2();
            }));
        });
    }
    function updateM2() {
        const n = Object.values(rateAnswers).filter(Boolean).length;
        $('#m2-progress').textContent = n + ' of ' + RATE_SLIDES.length + ' rated correctly';
        $('#m2-continue').disabled = n < RATE_SLIDES.length;
    }
    $('#m2-continue').addEventListener('click', () => { markModuleDone(2); shell.goToModule(3); });

    // ============================================================
    //  STEP 3 — Do It For Real
    // ============================================================
    $('#m3-finish').addEventListener('click', () => {
        if (!$('#m3-done').checked) { feedback('#m3-feedback', false, 'Check the box once you\'ve added one transition and one animation — and stopped there.'); return; }
        feedback('#m3-feedback', true, '✅ Restraint is the actual skill here. Well capped.');
        markModuleDone(3);
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        shell.renderRail();
        renderAnim();
        updateM1();
        renderRateCards();
        updateM2();
        shell.goToModule(1);
        if (!session) showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
    }
    init();
})();

(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-lesson7-notes',
        trackKey: 'presentation-skills',
        modules: [
            { n: 1, label: 'Practice' },
            { n: 2, label: 'Checkpoint' },
            { n: 3, label: 'Do It For Real' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, markModuleDone, session } = shell;

    // ============================================================
    //  STEP 1 — Practice: write a cue per slide
    // ============================================================
    const SLIDES = [
        { title: 'Welcome' },
        { title: 'The Problem' },
        { title: 'Our Solution' },
        { title: 'Thank You' }
    ];
    const notes = ['', '', '', ''];
    const MAX_CUE_WORDS = 12;
    let activeSlide = 0;

    function wordCount(s) { return s.trim().split(/\s+/).filter(Boolean).length; }

    function renderNotes() {
        const chrome = PS_PPT.chrome({ tabs: ['File', 'Home', 'Insert', 'View'], activeTab: 'View', filename: 'My First Deck — PowerPoint' });
        const thumbs = SLIDES.map((s, i) => `
            <div class="ppt-thumb ${i === activeSlide ? 'active' : ''}" data-slide="${i}">
                <span class="thumb-num">${i + 1}</span>
                <div class="thumb-title">${escapeHtml(s.title)}</div>
                ${notes[i].trim() ? '<span style="position:absolute;bottom:4px;right:4px;font-size:0.6rem;">📝</span>' : ''}
            </div>
        `).join('');
        const body = `
            <div class="ppt-body" style="grid-template-rows:1fr auto;">
                <div style="grid-column:1/-1;display:grid;grid-template-columns:150px 1fr;">
                    <div class="ppt-slide-panel">${thumbs}</div>
                    ${PS_PPT.canvas({ title: SLIDES[activeSlide].title })}
                </div>
                <div class="ppt-notes-pane" style="grid-column:1/-1;">
                    <div class="ppt-notes-label">Click to add notes — Slide ${activeSlide + 1}</div>
                    <textarea id="noteInput" rows="2" placeholder="A short cue, not a script…">${escapeHtml(notes[activeSlide])}</textarea>
                </div>
            </div>
        `;
        $('#notesWindow').innerHTML = chrome + body;
        $$('#notesWindow .ppt-thumb').forEach(t => t.addEventListener('click', () => { activeSlide = Number(t.dataset.slide); renderNotes(); }));
        $('#noteInput').addEventListener('input', (e) => { notes[activeSlide] = e.target.value; updateM1(); syncThumbBadge(); });
    }
    function syncThumbBadge() {
        const thumb = $$('#notesWindow .ppt-thumb')[activeSlide];
        if (!thumb) return;
        let badge = thumb.querySelector('span[style*="position:absolute"]');
        if (notes[activeSlide].trim() && !badge) {
            thumb.insertAdjacentHTML('beforeend', '<span style="position:absolute;bottom:4px;right:4px;font-size:0.6rem;">📝</span>');
        } else if (!notes[activeSlide].trim() && badge) {
            badge.remove();
        }
    }
    function updateM1() {
        const withNotes = notes.filter(n => n.trim()).length;
        $('#m1-status').textContent = withNotes + ' of ' + SLIDES.length + ' slides have notes';
        $('#m1-continue').disabled = withNotes < SLIDES.length;
    }
    $('#m1-continue').addEventListener('click', () => {
        const tooLong = notes.some(n => wordCount(n) > MAX_CUE_WORDS);
        if (tooLong) {
            feedback('#m1-feedback', false, `Keep each note to about ${MAX_CUE_WORDS} words or fewer — a cue, not a paragraph.`);
            return;
        }
        feedback('#m1-feedback', true, '✅ Short cues for every slide — exactly what Presenter View is for.');
        markModuleDone(1);
        shell.goToModule(2);
    });

    // ============================================================
    //  STEP 2 — Checkpoint: cue vs. script
    // ============================================================
    const SAMPLES = [
        { id: 'a', text: 'Mention the 20% growth number here.', correct: 'cue' },
        { id: 'b', text: 'Good afternoon everyone, thank you so much for being here today. I want to walk you through our quarterly results, which showed a remarkable twenty percent increase driven mainly by our new mobile payment rollout across three districts...', correct: 'script' },
        { id: 'c', text: 'Pause. Take questions.', correct: 'cue' }
    ];
    const sampleAnswers = {};

    function renderCueCards() {
        $('#cueCards').innerHTML = SAMPLES.map(s => `
            <div class="rate-card" data-id="${s.id}">
                <p style="color:var(--ink);font-size:0.88rem;font-style:italic;">"${escapeHtml(s.text)}"</p>
                <div class="rate-buttons">
                    <button type="button" data-choice="cue">✅ Usable cue</button>
                    <button type="button" data-choice="script">📜 Full script</button>
                </div>
            </div>
        `).join('');
        $$('.rate-card').forEach(card => {
            const s = SAMPLES.find(x => x.id === card.dataset.id);
            $$('button', card).forEach(btn => btn.addEventListener('click', () => {
                const ok = btn.dataset.choice === s.correct;
                $$('button', card).forEach(b => b.classList.remove('chosen', 'correct', 'wrong'));
                btn.classList.add('chosen', ok ? 'correct' : 'wrong');
                sampleAnswers[s.id] = ok;
                updateM2();
            }));
        });
    }
    function updateM2() {
        const n = Object.values(sampleAnswers).filter(Boolean).length;
        $('#m2-progress').textContent = n + ' of ' + SAMPLES.length + ' correct';
        $('#m2-continue').disabled = n < SAMPLES.length;
    }
    $('#m2-continue').addEventListener('click', () => { markModuleDone(2); shell.goToModule(3); });

    // ============================================================
    //  STEP 3 — Do It For Real
    // ============================================================
    $('#m3-finish').addEventListener('click', () => {
        if (!$('#m3-done').checked) { feedback('#m3-feedback', false, 'Check the box once you\'ve added short speaker-note cues to your real slides.'); return; }
        feedback('#m3-feedback', true, '✅ Notes in place. Next you\'ll proofread the whole deck.');
        markModuleDone(3);
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        shell.renderRail();
        renderNotes();
        updateM1();
        renderCueCards();
        updateM2();
        shell.goToModule(1);
        if (!session) showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
    }
    init();
})();

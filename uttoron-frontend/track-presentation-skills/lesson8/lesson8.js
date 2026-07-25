(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-lesson8-proofread',
        trackKey: 'presentation-skills',
        modules: [
            { n: 1, label: 'Practice' },
            { n: 2, label: 'Do It For Real' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, markModuleDone, session } = shell;

    // ============================================================
    //  STEP 1 — Practice: find 6 planted errors across 3 slides
    // ============================================================
    const PROOF_SLIDES = [
        { title: 'Order Process', text: 'We recieve orders every day and seperate them by region before packing.', errors: ['recieve', 'seperate'] },
        { title: 'System Update', text: 'This occured because the system definately needed an update before launch.', errors: ['occured', 'definately'] },
        { title: 'Team Planning', text: 'Wich plan can accomodate the whole team during the busy season?', errors: ['wich', 'accomodate'] }
    ];
    const TOTAL_ERRORS = PROOF_SLIDES.reduce((n, s) => n + s.errors.length, 0);
    const found = new Set(); // keys "slideIdx-wordIdx"

    function cleanWord(w) { return w.toLowerCase().replace(/[^a-z']/g, ''); }

    function renderProofSlides() {
        $('#proofSlides').innerHTML = PROOF_SLIDES.map((slide, si) => {
            const tokens = slide.text.split(/(\s+)/);
            let wi = 0;
            const html = tokens.map(tok => {
                if (/^\s+$/.test(tok) || tok === '') return escapeHtml(tok);
                const idx = wi++;
                const key = si + '-' + idx;
                const isError = slide.errors.includes(cleanWord(tok));
                let cls = 'proof-word';
                if (found.has(key)) cls += isError ? ' found' : '';
                return `<span class="${cls}" data-key="${key}" data-slide="${si}">${escapeHtml(tok)}</span>`;
            }).join('');
            return `
                <div class="proof-slide">
                    <div class="proof-title">${escapeHtml(slide.title)}</div>
                    <p>${html}</p>
                </div>
            `;
        }).join('');
        $$('.proof-word').forEach(span => {
            span.addEventListener('click', () => {
                const key = span.dataset.key;
                const si = Number(span.dataset.slide);
                const clean = cleanWord(span.textContent);
                if (!PROOF_SLIDES[si].errors.includes(clean)) {
                    showToast('That word looks fine — keep looking.', '');
                    return;
                }
                found.add(key);
                renderProofSlides();
                updateM1();
            });
        });
    }
    function updateM1() {
        $('#m1-status').textContent = found.size + ' of ' + TOTAL_ERRORS + ' found';
        $('#m1-continue').disabled = found.size < TOTAL_ERRORS;
    }
    $('#m1-continue').addEventListener('click', () => {
        feedback('#m1-feedback', true, '✅ All 6 caught. That\'s exactly what a proofreading pass is for — a fresh, deliberate read, not a skim.');
        markModuleDone(1);
        shell.goToModule(2);
    });

    // ============================================================
    //  STEP 2 — Do It For Real
    // ============================================================
    $('#m2-finish').addEventListener('click', () => {
        if (!$('#m2-done').checked) { feedback('#m2-feedback', false, 'Check the box once you\'ve run a real spelling check and fixed anything real.'); return; }
        feedback('#m2-feedback', true, '✅ Your deck is polished. Next: your first real feedback checkpoint.');
        markModuleDone(2);
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        shell.renderRail();
        renderProofSlides();
        updateM1();
        shell.goToModule(1);
        if (!session) showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
    }
    init();
})();

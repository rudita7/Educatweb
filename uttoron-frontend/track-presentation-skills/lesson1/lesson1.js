(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-lesson1-getting-started',
        trackKey: 'presentation-skills',
        modules: [
            { n: 1, label: 'Explore' },
            { n: 2, label: 'Checkpoint' },
            { n: 3, label: 'Do It For Real' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, markModuleDone, session } = shell;

    // ============================================================
    //  STEP 1 — Explore the start screen (two hotspot clicks)
    // ============================================================
    const explored = { blank: false, template: false };

    function renderStart() {
        const templates = [
            { name: 'Berlin', bar: '#C43E1C' },
            { name: 'Ion', bar: '#2E7D5B' },
            { name: 'Facet', bar: '#3a6ea5' },
            { name: 'Wisp', bar: '#8e7cc3' }
        ];
        const templateTiles = templates.map((t, i) => `
            <div class="ppt-start-tile ${(!explored.blank ? '' : (!explored.template ? (i === 0 ? 'hotspot' : '') : ''))} ${explored.template && i === 0 ? 'selected' : ''}" data-start="template" data-name="${t.name}">
                <div class="ppt-start-preview" style="background:${t.bar};color:#fff;">▦</div>
                <div class="ppt-start-name">${t.name}</div>
            </div>
        `).join('');

        $('#startWindow').innerHTML = `
            ${PS_PPT.chrome({ tabs: ['File', 'Home', 'Insert', 'Design'], activeTab: 'File', filename: 'PowerPoint — Start' })}
            <div class="ppt-start">
                <h4>New</h4>
                <div class="ppt-start-grid">
                    <div class="ppt-start-tile ppt-start-blank ${!explored.blank ? 'hotspot' : 'selected'}" data-start="blank">
                        <div class="ppt-start-preview">＋</div>
                        <div class="ppt-start-name">Blank Presentation</div>
                    </div>
                </div>
                <h4 style="margin-top:20px;">New from Template</h4>
                <div class="ppt-start-grid">${templateTiles}</div>
            </div>
        `;

        $$('#startWindow .ppt-start-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                const kind = tile.dataset.start;
                if (kind === 'blank') {
                    if (!explored.blank) {
                        explored.blank = true;
                        feedback('#m1-feedback', true, '✅ <strong>Blank Presentation</strong> — you start with nothing and build everything yourself. Total control, but more work. Now look at <strong>New from Template</strong> below.');
                    }
                } else if (kind === 'template') {
                    if (!explored.blank) {
                        feedback('#m1-feedback', false, 'Start with <strong>Blank Presentation</strong> first (the glowing tile at the top).');
                        return;
                    }
                    if (!explored.template) {
                        explored.template = true;
                        feedback('#m1-feedback', true, `✅ <strong>${escapeHtml(tile.dataset.name)}</strong> template — a coordinated design (fonts, colors, layouts) is done for you. Faster, and consistent. You just add content.`);
                    }
                }
                renderStart();
                updateM1();
            });
        });
    }

    function updateM1() {
        const n = (explored.blank ? 1 : 0) + (explored.template ? 1 : 0);
        $('#m1-progress').textContent = n + ' of 2 explored';
        $('#m1-continue').disabled = n < 2;
    }
    $('#m1-continue').addEventListener('click', () => { markModuleDone(1); shell.goToModule(2); });

    // ============================================================
    //  STEP 2 — Checkpoint (2 MCQ)
    // ============================================================
    const MCQ = [
        {
            q: "You need a plain, simple deck fast and you don't care about a fancy design. What do you pick?",
            options: ['A blank presentation', 'A design template', 'You can\'t make a deck without a template'],
            correct: 0,
            explain: 'A blank presentation is the quickest way to a plain deck — no design to strip away.'
        },
        {
            q: 'You want a polished, coordinated look (matching fonts and colors) without designing it yourself. What do you pick?',
            options: ['A blank presentation', 'A design template', 'It doesn\'t matter, they\'re identical'],
            correct: 1,
            explain: 'A template gives you a professional, consistent design instantly — you just drop in your content.'
        }
    ];
    const mcqAnswered = {};

    function renderMCQ() {
        $('#mcqContainer').innerHTML = MCQ.map((item, qi) => `
            <div class="mcq-block">
                <div class="mcq-q">${qi + 1}. ${escapeHtml(item.q)}</div>
                <div class="mcq-options" data-q="${qi}">
                    ${item.options.map((o, oi) => `<button class="mcq-opt" data-opt="${oi}">${escapeHtml(o)}</button>`).join('')}
                </div>
                <div class="mcq-explain" id="mcq-explain-${qi}"></div>
            </div>
        `).join('');
        $$('#mcqContainer .mcq-options').forEach(group => {
            const qi = Number(group.dataset.q);
            $$('.mcq-opt', group).forEach(btn => {
                btn.addEventListener('click', () => {
                    if (mcqAnswered[qi] === 'correct') return; // lock after correct
                    const oi = Number(btn.dataset.opt);
                    const item = MCQ[qi];
                    $$('.mcq-opt', group).forEach(b => b.classList.remove('chosen'));
                    btn.classList.add('chosen');
                    const explain = $('#mcq-explain-' + qi);
                    if (oi === item.correct) {
                        btn.classList.add('correct');
                        mcqAnswered[qi] = 'correct';
                        explain.className = 'mcq-explain show';
                        explain.innerHTML = '✅ ' + escapeHtml(item.explain);
                    } else {
                        btn.classList.add('wrong');
                        mcqAnswered[qi] = 'wrong';
                        explain.className = 'mcq-explain show';
                        explain.textContent = 'Not quite — try again.';
                    }
                    updateM2();
                });
            });
        });
    }
    function updateM2() {
        const n = Object.values(mcqAnswered).filter(v => v === 'correct').length;
        $('#m2-progress').textContent = n + ' of ' + MCQ.length + ' correct';
        $('#m2-continue').disabled = n < MCQ.length;
    }
    $('#m2-continue').addEventListener('click', () => { markModuleDone(2); shell.goToModule(3); });

    // ============================================================
    //  STEP 3 — Do It For Real
    // ============================================================
    $('#m3-finish').addEventListener('click', () => {
        if (!$('#m3-done').checked) {
            feedback('#m3-feedback', false, 'Check the box once you\'ve opened PowerPoint and saved a blank presentation.');
            return;
        }
        feedback('#m3-feedback', true, '✅ Nice — you\'ve got a real file to build on in the next lessons.');
        markModuleDone(3);
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        shell.renderRail();
        renderStart();
        updateM1();
        renderMCQ();
        updateM2();
        shell.goToModule(1);
        if (!session) showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
    }
    init();
})();

(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-lesson10-saving',
        trackKey: 'presentation-skills',
        modules: [
            { n: 1, label: 'Practice' },
            { n: 2, label: 'Do It For Real' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, resetFeedback, markModuleDone, session } = shell;

    // ============================================================
    //  STEP 1 — Decision tree: format + sharing method
    // ============================================================
    const FORMATS = [
        { id: 'pptx', label: '.pptx (editable)' },
        { id: 'pdf', label: 'PDF (locked/view-only)' }
    ];
    const METHODS = [
        { id: 'email', label: 'Email attachment' },
        { id: 'link', label: 'Cloud link' },
        { id: 'inperson', label: 'Hand over in person / USB' }
    ];
    const SCENARIOS = [
        {
            id: 'no-ppt',
            text: 'A community leader without PowerPoint needs to just look at your slides.',
            correctFormat: 'pdf', correctMethod: 'email',
            explain: 'PDF opens on any device without PowerPoint installed — perfect for something small sent straight to their inbox.'
        },
        {
            id: 'coeditor',
            text: 'A teammate needs to keep editing your deck with you before the real presentation.',
            correctFormat: 'pptx', correctMethod: 'link',
            explain: 'They need the editable .pptx, and a cloud link avoids emailing a large file back and forth every time it changes.'
        },
        {
            id: 'offline-class',
            text: 'You need to present at a community center with no reliable internet.',
            correctFormat: 'pptx', correctMethod: 'inperson',
            explain: 'No internet means no cloud link or email — bring the editable file on a USB drive or your own device.'
        }
    ];
    const answers = {};

    function renderTree() {
        $('#decisionTree').innerHTML = SCENARIOS.map(s => `
            <div class="ledger" data-scn="${s.id}" style="margin-bottom:14px;">
                <div class="ledger-title" style="color:#7a6a4a;">Situation</div>
                <p style="color:var(--ink);margin-bottom:12px;">${escapeHtml(s.text)}</p>
                <div class="match-grid">
                    <div class="match-row">
                        <div class="scenario">Format</div>
                        <select data-scn="${s.id}" data-field="format">
                            <option value="">Choose…</option>
                            ${FORMATS.map(f => `<option value="${f.id}" ${answers[s.id + '-format'] === f.id ? 'selected' : ''}>${escapeHtml(f.label)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="match-row">
                        <div class="scenario">Sharing method</div>
                        <select data-scn="${s.id}" data-field="method">
                            <option value="">Choose…</option>
                            ${METHODS.map(m => `<option value="${m.id}" ${answers[s.id + '-method'] === m.id ? 'selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="mcq-explain" id="explain-${s.id}"></div>
            </div>
        `).join('');
        $$('#decisionTree select').forEach(sel => sel.addEventListener('change', () => {
            answers[sel.dataset.scn + '-' + sel.dataset.field] = sel.value;
        }));
    }

    function updateM1() {
        let correct = 0;
        SCENARIOS.forEach(s => { if (answers[s.id + '-format'] === s.correctFormat && answers[s.id + '-method'] === s.correctMethod) correct++; });
        $('#m1-progress').textContent = correct + ' of ' + SCENARIOS.length + ' correct';
        $('#m1-continue').disabled = correct < SCENARIOS.length;
        return correct;
    }
    $('#decisionTree').addEventListener('change', () => {
        // live-check whichever scenario just changed, without requiring a separate "check" click
        SCENARIOS.forEach(s => {
            const explainEl = $('#explain-' + s.id);
            const gotFormat = answers[s.id + '-format'], gotMethod = answers[s.id + '-method'];
            if (gotFormat && gotMethod) {
                const ok = gotFormat === s.correctFormat && gotMethod === s.correctMethod;
                explainEl.className = 'mcq-explain show';
                explainEl.innerHTML = ok ? '✅ ' + escapeHtml(s.explain) : '❌ Not quite — think about who\'s receiving it and what they need to do with it.';
            } else {
                explainEl.className = 'mcq-explain';
            }
        });
        updateM1();
    });
    $('#m1-continue').addEventListener('click', () => { markModuleDone(1); shell.goToModule(2); });

    // ============================================================
    //  STEP 2 — Do It For Real
    // ============================================================
    $('#m2-finish').addEventListener('click', () => {
        if (!$('#m2-done').checked) { feedback('#m2-feedback', false, 'Check the box once you\'ve saved both formats and shared one.'); return; }
        feedback('#m2-feedback', true, '✅ Your deck is portable and shareable now, in whichever form the recipient actually needs.');
        markModuleDone(2);
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        shell.renderRail();
        renderTree();
        updateM1();
        shell.goToModule(1);
        if (!session) showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
    }
    init();
})();

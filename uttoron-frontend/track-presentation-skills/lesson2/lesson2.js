(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-lesson2-template',
        trackKey: 'presentation-skills',
        modules: [
            { n: 1, label: 'Explore' },
            { n: 2, label: 'Practice' },
            { n: 3, label: 'Do It For Real' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, resetFeedback, markModuleDone, session } = shell;

    // ============================================================
    //  STEP 1 — Explore the Design tab + 6 template thumbnails
    // ============================================================
    const TEMPLATES = [
        { name: 'Corporate Clean', bar: '#2b3a67', vibe: 'Minimal and professional — good for business and formal pitches.' },
        { name: 'Bright Spark', bar: '#E8A33D', vibe: 'Warm and friendly — good for community and classroom talks.' },
        { name: 'Bold Pop', bar: '#E2593B', vibe: 'Loud and playful — grabs attention for events and recruitment.' },
        { name: 'Fresh Mint', bar: '#2E7D5B', vibe: 'Calm and clear — good for reports and step-by-step explanations.' },
        { name: 'Deep Focus', bar: '#4b3f72', vibe: 'Serious and elegant — good for research and data-heavy topics.' },
        { name: 'Sky Line', bar: '#3a6ea5', vibe: 'Cool and modern — a safe, versatile all-rounder.' }
    ];
    let designTabOpen = false;
    const viewedTemplates = new Set();
    let activeTemplate = null;

    function renderDesign() {
        const chrome = PS_PPT.chrome({
            tabs: ['File', 'Home', 'Insert', 'Design', 'Transitions', 'Animations'],
            activeTab: designTabOpen ? 'Design' : 'Home',
            hotspotTab: designTabOpen ? null : 'Design',
            filename: 'My First Deck — PowerPoint'
        });

        let ribbonOrGallery;
        if (!designTabOpen) {
            ribbonOrGallery = PS_PPT.ribbon(
                PS_PPT.group('Slides', [
                    { icon: '➕', label: 'New Slide' },
                    { icon: '▤', label: 'Layout' }
                ]) +
                PS_PPT.group('Font', [
                    { icon: '𝗕', label: 'Bold' },
                    { icon: '𝘐', label: 'Italic' }
                ])
            );
        } else {
            const gallery = TEMPLATES.map((t, i) => `
                <div class="template-swatch ${activeTemplate === i ? 'active' : ''}" data-tpl="${i}">
                    <div class="template-preview" style="background:${t.bar}12;">
                        <div class="tp-bar" style="background:${t.bar};width:60%;"></div>
                        <div class="tp-line"></div><div class="tp-line" style="width:55%;"></div>
                    </div>
                    <div class="template-name">${escapeHtml(t.name)}</div>
                </div>
            `).join('');
            ribbonOrGallery = `<div class="template-gallery">${gallery}</div>`;
        }

        $('#designWindow').innerHTML = chrome + ribbonOrGallery +
            (designTabOpen && activeTemplate !== null
                ? `<div style="padding:0 16px 16px;background:#faf9f8;">${PS_PPT.canvas({ title: TEMPLATES[activeTemplate].name, subtitle: TEMPLATES[activeTemplate].vibe })}</div>`
                : '');

        // tab clicks
        $$('#designWindow .ppt-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.dataset.tab === 'Design') {
                    designTabOpen = true;
                    feedback('#m1-feedback', true, '✅ This is the <strong>Design</strong> tab — where all the templates (called "themes" in newer versions) live. Click each thumbnail to preview it.');
                    renderDesign();
                    updateM1();
                } else if (!designTabOpen) {
                    feedback('#m1-feedback', false, 'Click the glowing <strong>Design</strong> tab to find the templates.');
                }
            });
        });
        // template clicks
        $$('#designWindow .template-swatch').forEach(sw => {
            sw.addEventListener('click', () => {
                const i = Number(sw.dataset.tpl);
                activeTemplate = i;
                viewedTemplates.add(i);
                renderDesign();
                updateM1();
            });
        });
    }

    function updateM1() {
        if (!designTabOpen) { $('#m1-progress').textContent = 'Open the Design tab to begin'; $('#m1-continue').disabled = true; return; }
        $('#m1-progress').textContent = viewedTemplates.size + ' of ' + TEMPLATES.length + ' templates viewed';
        $('#m1-continue').disabled = viewedTemplates.size < TEMPLATES.length;
    }
    $('#m1-continue').addEventListener('click', () => { markModuleDone(1); shell.goToModule(2); });

    // ============================================================
    //  STEP 2 — Practice: match scenarios to styles
    // ============================================================
    const STYLES = [
        { id: 'corporate', label: 'Clean & professional' },
        { id: 'playful', label: 'Bold & playful' },
        { id: 'structured', label: 'Clear & structured for data' }
    ];
    const SCENARIOS = [
        { id: 'pitch', text: 'A pitch to a serious business client', correct: 'corporate' },
        { id: 'club', text: 'A poster-style talk to recruit students into a club', correct: 'playful' },
        { id: 'science', text: 'A science-fair presentation full of charts and results', correct: 'structured' }
    ];
    const matchChoice = {};

    function renderMatch() {
        $('#matchGrid').innerHTML = SCENARIOS.map(s => `
            <div class="match-row" data-scn="${s.id}">
                <div class="scenario">${escapeHtml(s.text)}</div>
                <select data-scn="${s.id}">
                    <option value="">Choose a style…</option>
                    ${STYLES.map(st => `<option value="${st.id}" ${matchChoice[s.id] === st.id ? 'selected' : ''}>${escapeHtml(st.label)}</option>`).join('')}
                </select>
            </div>
        `).join('');
        $$('#matchGrid select').forEach(sel => {
            sel.addEventListener('change', () => { matchChoice[sel.dataset.scn] = sel.value; });
        });
    }
    $('#m2-reset').addEventListener('click', () => {
        SCENARIOS.forEach(s => delete matchChoice[s.id]);
        renderMatch();
        resetFeedback('#m2-feedback');
    });
    $('#m2-check').addEventListener('click', () => {
        if (SCENARIOS.some(s => !matchChoice[s.id])) {
            feedback('#m2-feedback', false, 'Pick a style for all three situations first.');
            return;
        }
        let correct = 0;
        SCENARIOS.forEach(s => {
            const row = $('#matchGrid .match-row[data-scn="' + s.id + '"]');
            const ok = matchChoice[s.id] === s.correct;
            row.classList.toggle('correct', ok);
            row.classList.toggle('wrong', !ok);
            if (ok) correct++;
        });
        if (correct === SCENARIOS.length) {
            feedback('#m2-feedback', true, '✅ All three matched — you\'re choosing for the audience, not just for looks.');
            markModuleDone(2);
            shell.goToModule(3);
        } else {
            feedback('#m2-feedback', false, `${correct} of ${SCENARIOS.length} right. A formal client wants clean & professional; recruitment wants bold & playful; data wants clear & structured.`);
        }
    });

    // ============================================================
    //  STEP 3 — Do It For Real
    // ============================================================
    $('#m3-finish').addEventListener('click', () => {
        if (!$('#m3-done').checked) {
            feedback('#m3-feedback', false, 'Check the box once you\'ve applied a template to your real file.');
            return;
        }
        feedback('#m3-feedback', true, '✅ Your deck has a coordinated look now. Structure comes next.');
        markModuleDone(3);
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        shell.renderRail();
        renderDesign();
        updateM1();
        renderMatch();
        shell.goToModule(1);
        if (!session) showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
    }
    init();
})();

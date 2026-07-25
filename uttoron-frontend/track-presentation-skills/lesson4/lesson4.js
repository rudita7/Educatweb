(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-lesson4-text',
        trackKey: 'presentation-skills',
        modules: [
            { n: 1, label: 'Practice' },
            { n: 2, label: 'Do It For Real' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, markModuleDone, session } = shell;

    const MAX_WORDS = 8;
    const NUM_BULLETS = 3;
    const PARAGRAPH = "Our new mobile-payment system lets customers pay directly from their phones, which means they no longer need to carry exact cash, checkout lines move much faster during busy hours, and the shop keeps an automatic digital record of every single sale for the day.";

    const bullets = ['', '', ''];

    function wordCount(s) { return s.trim().split(/\s+/).filter(Boolean).length; }

    function renderParagraph() { $('#paraSource').textContent = PARAGRAPH; }

    function renderBulletInputs() {
        $('#bulletInputs').innerHTML = bullets.map((b, i) => {
            const wc = wordCount(b);
            const over = wc > MAX_WORDS;
            return `
                <div class="bullet-input-row">
                    <span class="bullet-dot">•</span>
                    <input type="text" data-idx="${i}" value="${escapeHtml(b).replace(/"/g, '&quot;')}" placeholder="Bullet ${i + 1} (max ${MAX_WORDS} words)" class="${over ? 'over' : ''}" />
                    <span class="bullet-count ${over ? 'over' : ''}">${wc}/${MAX_WORDS}</span>
                </div>`;
        }).join('');
        $$('#bulletInputs input').forEach(inp => {
            inp.addEventListener('input', () => {
                bullets[Number(inp.dataset.idx)] = inp.value;
                // update just the count + preview without stealing focus
                const row = inp.closest('.bullet-input-row');
                const wc = wordCount(inp.value);
                const over = wc > MAX_WORDS;
                inp.classList.toggle('over', over);
                const counter = row.querySelector('.bullet-count');
                counter.textContent = wc + '/' + MAX_WORDS;
                counter.classList.toggle('over', over);
                renderPreview();
                renderRules();
            });
        });
    }

    function renderPreview() {
        const shown = bullets.map(b => b.trim()).filter(Boolean);
        $('#previewWindow').innerHTML =
            PS_PPT.chrome({ tabs: ['File', 'Home', 'Insert', 'Design'], activeTab: 'Home', filename: 'My First Deck — PowerPoint' }) +
            PS_PPT.ribbon(
                PS_PPT.group('Font', [{ icon: '𝗕', label: 'Bold' }, { icon: '𝘈', label: 'Size' }]) +
                PS_PPT.group('Paragraph', [{ icon: '•', label: 'Bullets' }, { icon: '≣', label: 'Align' }])
            ) +
            PS_PPT.canvas({ title: 'Why Mobile Payments', bullets: shown.length ? shown : [] });
    }

    function renderRules() {
        const nonEmpty = bullets.map(b => b.trim()).filter(Boolean);
        const allWithin = nonEmpty.every(b => wordCount(b) <= MAX_WORDS);
        const rules = [
            { ok: nonEmpty.length === NUM_BULLETS, text: `Exactly ${NUM_BULLETS} bullets (you have ${nonEmpty.length})` },
            { ok: nonEmpty.length > 0 && allWithin, text: `Every bullet is ${MAX_WORDS} words or fewer` }
        ];
        $('#m1-rules').innerHTML = rules.map(r => `<li class="${r.ok ? 'pass' : 'fail'}">${r.ok ? '✅' : '⬜'} ${escapeHtml(r.text)}</li>`).join('');
        return rules.every(r => r.ok);
    }

    $('#m1-check').addEventListener('click', () => {
        const ok = renderRules();
        const nonEmpty = bullets.map(b => b.trim()).filter(Boolean);
        if (!ok) {
            if (nonEmpty.length !== NUM_BULLETS) {
                feedback('#m1-feedback', false, `Write exactly ${NUM_BULLETS} bullets — one per key idea in the paragraph.`);
            } else {
                const over = nonEmpty.filter(b => wordCount(b) > MAX_WORDS).length;
                feedback('#m1-feedback', false, `${over} bullet(s) are too long. Cut each to ${MAX_WORDS} words or fewer — keep only the core idea.`);
            }
            return;
        }
        feedback('#m1-feedback', true, '✅ That\'s bullet discipline — short lines the audience reads in a glance while they listen to you.');
        markModuleDone(1);
        shell.goToModule(2);
    });

    // ============================================================
    //  STEP 2 — Do It For Real
    // ============================================================
    $('#m2-finish').addEventListener('click', () => {
        if (!$('#m2-done').checked) {
            feedback('#m2-feedback', false, 'Check the box once you\'ve added short bullet text to your real slides.');
            return;
        }
        feedback('#m2-feedback', true, '✅ Great work — your deck now has structure and clear, readable text.');
        markModuleDone(2);
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        shell.renderRail();
        renderParagraph();
        renderBulletInputs();
        renderPreview();
        renderRules();
        shell.goToModule(1);
        if (!session) showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
    }
    init();
})();

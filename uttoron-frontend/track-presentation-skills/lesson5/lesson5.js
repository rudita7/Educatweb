(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-lesson5-visuals',
        trackKey: 'presentation-skills',
        modules: [
            { n: 1, label: 'Explore & Practice' },
            { n: 2, label: 'Checkpoint' },
            { n: 3, label: 'Do It For Real' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, resetFeedback, markModuleDone, session } = shell;

    // ============================================================
    //  STEP 1 — Explore Insert tab, add image + chart
    // ============================================================
    let insertTabOpen = false;
    let imageInserted = false;
    let chartType = 'bar';
    let chartInserted = false;
    const chartData = [{ label: 'Mon', value: 12 }, { label: 'Wed', value: 28 }, { label: 'Fri', value: 19 }];

    function renderInsert() {
        const chrome = PS_PPT.chrome({
            tabs: ['File', 'Home', 'Insert', 'Design'],
            activeTab: insertTabOpen ? 'Insert' : 'Home',
            hotspotTab: insertTabOpen ? null : 'Insert',
            filename: 'My First Deck — PowerPoint'
        });

        let body;
        if (!insertTabOpen) {
            body = PS_PPT.ribbon(PS_PPT.group('Slides', [{ icon: '➕', label: 'New Slide' }]));
        } else {
            const ribbon = PS_PPT.ribbon(
                PS_PPT.group('Images', [
                    { key: 'pictures', icon: '🖼️', label: 'Pictures', hotspot: !imageInserted, id: 'btnPictures' },
                    { key: 'online', icon: '🌐', label: 'Online Pictures' }
                ]) +
                PS_PPT.group('Charts', [
                    { key: 'chart', icon: '📊', label: 'Chart', hotspot: imageInserted && !chartInserted, id: 'btnChart' }
                ])
            );
            let canvasBody = '<div class="ppt-canvas-wrap"><div class="ppt-canvas">';
            canvasBody += '<div class="slide-title">Weekly Visits</div>';
            canvasBody += '<div style="display:flex;gap:14px;flex:1;">';
            canvasBody += imageInserted
                ? '<div class="ppt-img-placeholder"><span class="icon">🖼️</span>Picture inserted</div>'
                : '<div class="ppt-img-placeholder"><span class="icon">＋</span>No picture yet</div>';
            canvasBody += '<div class="ppt-chart-canvas" id="chartCanvas">' + (chartInserted ? PS_PPT.chartSVG(chartType, chartData) : '<span style="color:#a19f9d;font-size:0.8rem;">No chart yet</span>') + '</div>';
            canvasBody += '</div></div></div>';
            body = ribbon + canvasBody;
        }

        $('#insertWindow').innerHTML = chrome + body;

        $$('#insertWindow .ppt-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.dataset.tab === 'Insert') {
                    insertTabOpen = true;
                    feedback('#m1-feedback', true, '✅ This is the <strong>Insert</strong> tab — pictures, charts, tables, and more all live here.');
                    renderInsert();
                }
            });
        });
        const picBtn = $('#btnPictures');
        if (picBtn) picBtn.addEventListener('click', () => {
            imageInserted = true;
            feedback('#m1-feedback', true, '✅ A picture placeholder is on the slide. Now click <strong>Chart</strong>.');
            renderInsert();
            updateM1();
        });
        const chartBtn = $('#btnChart');
        if (chartBtn) chartBtn.addEventListener('click', () => {
            if (!imageInserted) { feedback('#m1-feedback', false, 'Insert a picture first.'); return; }
            openChartBuilder();
        });
    }

    function openChartBuilder() {
        $('#insertWindow').insertAdjacentHTML('beforeend', `
            <div id="chartBuilder" style="padding:16px;background:#faf9f8;border-top:1px solid var(--ppt-gray-line);">
                <div class="chart-type-picker" id="chartTypePicker"></div>
                <div class="chart-data-rows" id="chartRows"></div>
                <button class="btn btn-primary btn-sm" id="chartInsertBtn" type="button">Insert Chart</button>
            </div>
        `);
        renderChartTypePicker();
        renderChartRows();
        $('#chartInsertBtn').addEventListener('click', () => {
            chartInserted = true;
            $('#chartBuilder').remove();
            feedback('#m1-feedback', true, '✅ Chart inserted — built from your 3 data points.');
            renderInsert();
            updateM1();
        });
    }
    function renderChartTypePicker() {
        $('#chartTypePicker').innerHTML = ['bar', 'line', 'pie'].map(t =>
            `<button type="button" data-type="${t}" class="${chartType === t ? 'active' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`
        ).join('');
        $$('#chartTypePicker button').forEach(b => b.addEventListener('click', () => { chartType = b.dataset.type; renderChartTypePicker(); }));
    }
    function renderChartRows() {
        $('#chartRows').innerHTML = chartData.map((d, i) => `
            <div class="chart-data-row">
                <input type="text" data-i="${i}" data-f="label" value="${escapeHtml(d.label)}" />
                <input type="number" data-i="${i}" data-f="value" value="${d.value}" min="0" />
            </div>
        `).join('');
        $$('#chartRows input').forEach(inp => inp.addEventListener('input', () => {
            const i = Number(inp.dataset.i), f = inp.dataset.f;
            chartData[i][f] = f === 'value' ? (Number(inp.value) || 0) : inp.value;
        }));
    }

    function updateM1() {
        const n = (imageInserted ? 1 : 0) + (chartInserted ? 1 : 0);
        $('#m1-progress').textContent = insertTabOpen ? (n + ' of 2 inserted') : 'Open the Insert tab to begin';
        $('#m1-continue').disabled = n < 2;
    }
    $('#m1-continue').addEventListener('click', () => { markModuleDone(1); shell.goToModule(2); });

    // ============================================================
    //  STEP 2 — Checkpoint: match chart type to data
    // ============================================================
    const CHART_TYPES = [
        { id: 'line', label: 'Line chart' },
        { id: 'bar', label: 'Bar chart' },
        { id: 'pie', label: 'Pie chart' }
    ];
    const SCENARIOS = [
        { id: 'trend', text: 'Daily sales over the last 30 days', correct: 'line' },
        { id: 'compare', text: 'Comparing sales across 5 different products', correct: 'bar' },
        { id: 'share', text: 'What share of customers pay by cash vs. mobile vs. card', correct: 'pie' }
    ];
    const chartChoice = {};

    function renderChartMatch() {
        $('#chartMatch').innerHTML = SCENARIOS.map(s => `
            <div class="match-row" data-scn="${s.id}">
                <div class="scenario">${escapeHtml(s.text)}</div>
                <select data-scn="${s.id}">
                    <option value="">Choose a chart…</option>
                    ${CHART_TYPES.map(t => `<option value="${t.id}" ${chartChoice[s.id] === t.id ? 'selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}
                </select>
            </div>
        `).join('');
        $$('#chartMatch select').forEach(sel => sel.addEventListener('change', () => { chartChoice[sel.dataset.scn] = sel.value; }));
    }
    $('#m2-reset').addEventListener('click', () => { SCENARIOS.forEach(s => delete chartChoice[s.id]); renderChartMatch(); resetFeedback('#m2-feedback'); });
    $('#m2-check').addEventListener('click', () => {
        if (SCENARIOS.some(s => !chartChoice[s.id])) { feedback('#m2-feedback', false, 'Pick a chart type for all three scenarios first.'); return; }
        let correct = 0;
        SCENARIOS.forEach(s => {
            const row = $('#chartMatch .match-row[data-scn="' + s.id + '"]');
            const ok = chartChoice[s.id] === s.correct;
            row.classList.toggle('correct', ok);
            row.classList.toggle('wrong', !ok);
            if (ok) correct++;
        });
        if (correct === SCENARIOS.length) {
            feedback('#m2-feedback', true, '✅ Line for trends over time, bar for comparing categories, pie for parts of a whole.');
            markModuleDone(2);
            shell.goToModule(3);
        } else {
            feedback('#m2-feedback', false, `${correct} of ${SCENARIOS.length} right. Think: is it changing over time (line), comparing separate things (bar), or showing a share of a total (pie)?`);
        }
    });

    // ============================================================
    //  STEP 3 — Do It For Real
    // ============================================================
    $('#m3-finish').addEventListener('click', () => {
        if (!$('#m3-done').checked) { feedback('#m3-feedback', false, 'Check the box once you\'ve inserted a real image and a real chart.'); return; }
        feedback('#m3-feedback', true, '✅ Your deck now has visuals doing real work, not just decoration.');
        markModuleDone(3);
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        shell.renderRail();
        renderInsert();
        updateM1();
        renderChartMatch();
        shell.goToModule(1);
        if (!session) showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
    }
    init();
})();

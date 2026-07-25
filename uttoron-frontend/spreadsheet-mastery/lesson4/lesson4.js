(function () {
    "use strict";

    const cellModel = window.SM.cellModel;
    const formulaEngine = window.SM.formulaEngine;
    const conditionalFormatEngine = window.SM.conditionalFormatEngine;
    const chartRenderer = window.SM.chartRenderer;
    const kit = window.SM.lessonKit;

    const { $, $$, showToast, feedback, renderGrid, renderDataTable, focusCell, bindGridEvents, guardedRender, escapeHtml } = kit;

    const LESSON_ID = 'spreadsheet-mastery-lesson4';
    const MODULE_NUMBERS = [1, 2, 3, 4];
    const progress = kit.createProgress(LESSON_ID, MODULE_NUMBERS);
    const session = progress.session;

    // ============================================================
    //  MODULE RAIL
    // ============================================================
    const MODULES = [
        { n: 1, label: 'Formatting' },
        { n: 2, label: 'Cond. Format' },
        { n: 3, label: 'Chart' },
        { n: 4, label: 'Together' }
    ];
    let activeModule = 1;

    function renderRail() {
        $('#moduleRail').innerHTML = MODULES.map(m => {
            const unlocked = progress.isUnlocked(m.n);
            return `<button class="module-dot ${m.n === activeModule ? 'active' : ''} ${progress.moduleDone[m.n] ? 'done' : ''} ${!unlocked ? 'locked' : ''}"
                data-goto="${m.n}" ${unlocked ? '' : 'disabled'} title="${unlocked ? '' : 'Finish the module before this one first'}">
                <span class="num">${m.n}</span> ${m.label}
            </button>`;
        }).join('');
        $$('#moduleRail .module-dot').forEach(btn => {
            if (!btn.disabled) btn.addEventListener('click', () => goToModule(Number(btn.dataset.goto)));
        });
    }

    function goToModule(n) {
        if (!progress.isUnlocked(n)) return;
        activeModule = n;
        $$('.module-panel').forEach(p => p.classList.toggle('active', Number(p.dataset.module) === n));
        renderRail();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function markModuleDone(n) {
        if (!progress.markModuleDone(n)) return;
        renderRail();
        showToast('Module ' + n + ' complete!', 'success');
        if (progress.awardStampIfComplete()) $('#lessonStampBanner').classList.add('show');
    }

    function rectRange(idA, idB, cols, rows) {
        const pa = /^([A-Za-z]+)([0-9]+)$/.exec(idA);
        const pb = /^([A-Za-z]+)([0-9]+)$/.exec(idB);
        const ca = cols.indexOf(pa[1]), ra = rows.indexOf(parseInt(pa[2], 10));
        const cb = cols.indexOf(pb[1]), rb = rows.indexOf(parseInt(pb[2], 10));
        const c0 = Math.min(ca, cb), c1 = Math.max(ca, cb), r0 = Math.min(ra, rb), r1 = Math.max(ra, rb);
        const set = new Set();
        for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) set.add(cols[c] + rows[r]);
        return set;
    }

    // ============================================================
    //  MODULE 1 — Cell Formatting
    // ============================================================
    (function Module1() {
        const cols = ['A', 'B', 'C', 'D'];
        const rows = [1, 2, 3, 4];
        const readonly = new Set(['A1', 'B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'D2', 'A3', 'B3', 'C3', 'D3', 'A4']);
        const grid = cellModel.createGrid(cols, rows);
        const seed = {
            A1: 'Item', B1: 'Qty', C1: 'Unit Price', D1: 'Total',
            A2: 'Cotton fabric roll', B2: '12', C2: '850', D2: '10200',
            A3: 'Delivery', B3: '1', C3: '500', D3: '500',
            A4: 'Tax Rate'
        };
        Object.keys(seed).forEach(id => cellModel.setRaw(grid, id, seed[id]));
        cellModel.setRaw(grid, 'B4', '0.05');
        let computed = {};
        let selected = 'A1';
        let selectAnchor = 'A1';
        let selectedRange = new Set(['A1']);

        const ctx = {
            setSelected(id) { selected = id; },
            onCellMouseDown(id, shift) {
                if (shift && selectAnchor) selectedRange = rectRange(selectAnchor, id, cols, rows);
                else { selectAnchor = id; selectedRange = new Set([id]); }
                selected = id;
                render();
            },
            getRaw(id) { return cellModel.getRaw(grid, id); },
            commit(id, val) {
                if (cellModel.getRaw(grid, id) === val) { render(); return; }
                cellModel.setRaw(grid, id, val);
                render();
            },
            onNavigate() {}
        };

        const render = guardedRender(function () {
            computed = cellModel.recomputeGrid(grid, formulaEngine);
            renderGrid('m1-grid', grid, computed, cols, rows, {
                readonly, selected, selectedRange,
                styleFor: id => cellModel.getStyle(grid, id),
                formatter: (id, v) => cellModel.formatValue(v, cellModel.getStyle(grid, id).numberFormat)
            });
            bindGridEvents('m1-grid', cols, rows, ctx);
            focusCell('m1-grid', selected);
            updateProgress();
        });

        function applyFormat(patch) {
            const targets = selectedRange.size ? selectedRange : new Set([selected]);
            targets.forEach(id => cellModel.setStyle(grid, id, patch));
            render();
        }
        $('#m1-bold').addEventListener('click', () => applyFormat({ bold: true }));
        $('#m1-currency').addEventListener('click', () => applyFormat({ numberFormat: 'currency' }));
        $('#m1-percentage').addEventListener('click', () => applyFormat({ numberFormat: 'percentage' }));
        $('#m1-general').addEventListener('click', () => applyFormat({ bold: false, numberFormat: 'general' }));

        function checks() {
            const headerBold = ['A1', 'B1', 'C1', 'D1'].every(id => cellModel.getStyle(grid, id).bold);
            const totalsCurrency = ['D2', 'D3'].every(id => cellModel.getStyle(grid, id).numberFormat === 'currency');
            const taxPercentage = cellModel.getStyle(grid, 'B4').numberFormat === 'percentage';
            return [headerBold, totalsCurrency, taxPercentage];
        }
        function updateProgress() {
            const c = checks();
            $('#m1-progress-text').textContent = c.filter(Boolean).length + ' of 3 formats applied.';
        }

        $('#m1-check').addEventListener('click', () => {
            const c = checks();
            if (c.every(Boolean)) {
                feedback('#m1-feedback', true, '✅ Bold header, currency totals, percentage tax rate — the sheet reads like a real invoice now.');
                markModuleDone(1);
            } else {
                feedback('#m1-feedback', false, `${c.filter(Boolean).length} of 3 applied so far.`);
            }
        });

        render();
    })();

    // ============================================================
    //  MODULE 2 — Conditional Formatting
    // ============================================================
    (function Module2() {
        const INVOICES = [
            { id: 1, invoice: 'INV-401', status: 'Paid' },
            { id: 2, invoice: 'INV-402', status: 'Overdue' },
            { id: 3, invoice: 'INV-403', status: 'Pending' },
            { id: 4, invoice: 'INV-404', status: 'Overdue' },
            { id: 5, invoice: 'INV-405', status: 'Paid' }
        ];
        const INVENTORY = [
            { id: 1, item: 'A4 Paper Ream', qty: 48 },
            { id: 2, item: 'Stapler', qty: 15 },
            { id: 3, item: 'Marker Set', qty: 30 },
            { id: 4, item: 'Envelope Box', qty: 60 },
            { id: 5, item: 'Whiteboard Marker', qty: 8 }
        ];
        const TARGET_LOW_STOCK_IDS = [2, 5];

        const RULES_INVOICE = [
            { id: 'flag-overdue-invoice', condition: r => r.status === 'Overdue', style: { fill: 'coral-soft' } }
        ];

        function renderInvoices() {
            renderDataTable('m2a-table', INVOICES, [
                { key: 'invoice', label: 'Invoice', mono: true },
                { key: 'status', label: 'Status', render: r => `<span class="badge badge-${r.status.toLowerCase()}">${escapeHtml(r.status)}</span>` }
            ], {
                rowClass: r => {
                    const fill = conditionalFormatEngine.resolveFill(r, RULES_INVOICE);
                    return fill ? 'fill-' + fill : '';
                }
            });
        }
        renderInvoices();

        function renderInventory() {
            const threshold = Number($('#m2b-threshold').value) || 0;
            const rules = [{ id: 'flag-low-stock', condition: r => r.qty < threshold, style: { fill: 'coral-soft' } }];
            renderDataTable('m2b-table', INVENTORY, [
                { key: 'item', label: 'Item' },
                { key: 'qty', label: 'Qty' }
            ], {
                rowClass: r => {
                    const fill = conditionalFormatEngine.resolveFill(r, rules);
                    return fill ? 'fill-' + fill : '';
                }
            });
            return rules;
        }
        let currentInventoryRules = renderInventory();
        $('#m2b-threshold').addEventListener('input', () => { currentInventoryRules = renderInventory(); });

        $('#m2-check').addEventListener('click', () => {
            const overdueCount = INVOICES.filter(r => r.status === 'Overdue').length;
            const countOk = Number($('#m2a-count').value) === overdueCount;

            const flaggedIds = INVENTORY.filter(r => conditionalFormatEngine.resolveFill(r, currentInventoryRules)).map(r => r.id).sort();
            const target = TARGET_LOW_STOCK_IDS.slice().sort();
            const thresholdOk = JSON.stringify(flaggedIds) === JSON.stringify(target);

            if (countOk && thresholdOk) {
                feedback('#m2-feedback', true, '✅ Correct invoice count, and the threshold flags exactly the right two low-stock items.');
                markModuleDone(2);
            } else {
                const msgs = [];
                if (!countOk) msgs.push(`the highlighted-invoice count isn't right yet (look at the table above).`);
                if (!thresholdOk) msgs.push(`the threshold flags the wrong set of items -- adjust it so only Stapler and Whiteboard Marker are highlighted.`);
                feedback('#m2-feedback', false, msgs.join(' '));
            }
        });
    })();

    // ============================================================
    //  MODULE 3 — Creating a Chart
    // ============================================================
    (function Module3() {
        const cols = ['A', 'B'];
        const rows = [1, 2, 3, 4, 5, 6];
        const readonly = new Set(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5', 'B5', 'A6', 'B6']);
        const grid = cellModel.createGrid(cols, rows);
        const items = [
            { name: 'A4 Paper Ream', qty: 48 },
            { name: 'Stapler', qty: 15 },
            { name: 'Marker Set', qty: 30 },
            { name: 'Envelope Box', qty: 60 },
            { name: 'Whiteboard Marker', qty: 8 }
        ];
        const seed = { A1: 'Item', B1: 'Qty' };
        items.forEach((it, i) => { seed['A' + (i + 2)] = it.name; seed['B' + (i + 2)] = String(it.qty); });
        Object.keys(seed).forEach(id => cellModel.setRaw(grid, id, seed[id]));
        let computed = {};
        let selected = 'B2';
        let chartGenerated = false;

        const ctx = {
            setSelected(id) { selected = id; $$('#m3-grid td').forEach(td => td.classList.toggle('selected-cell', td.dataset.cell === id)); },
            getRaw(id) { return cellModel.getRaw(grid, id); },
            commit(id, val) {
                if (cellModel.getRaw(grid, id) === val) { render(); return; }
                cellModel.setRaw(grid, id, val);
                render();
            },
            onNavigate() {}
        };
        const render = guardedRender(function () {
            computed = cellModel.recomputeGrid(grid, formulaEngine);
            renderGrid('m3-grid', grid, computed, cols, rows, { readonly, selected });
            bindGridEvents('m3-grid', cols, rows, ctx);
            focusCell('m3-grid', selected);
        });
        render();

        $('#m3-answer').innerHTML += items.map(it => `<option value="${escapeHtml(it.name)}">${escapeHtml(it.name)}</option>`).join('');

        $('#m3-generate').addEventListener('click', () => {
            const categories = items.map(it => it.name);
            const values = items.map(it => it.qty);
            $('#m3-chart').innerHTML = chartRenderer.renderBarChart(categories, values, { title: 'Inventory Quantity by Item' });
            chartGenerated = true;
            showToast('Chart generated.', 'success');
        });

        $('#m3-check').addEventListener('click', () => {
            const highest = items.slice().sort((a, b) => b.qty - a.qty)[0].name;
            const answerOk = $('#m3-answer').value === highest;
            if (chartGenerated && answerOk) {
                feedback('#m3-feedback', true, `✅ Correct — ${highest} has the highest quantity, and the chart made that obvious at a glance.`);
                markModuleDone(3);
            } else if (!chartGenerated) {
                feedback('#m3-feedback', false, 'Generate the chart first.');
            } else {
                feedback('#m3-feedback', false, 'Take another look at the chart — which bar is tallest?');
            }
        });
    })();

    // ============================================================
    //  MODULE 4 — Putting It Together
    // ============================================================
    (function Module4() {
        const cols = ['A', 'B', 'C', 'D'];
        const rows = [1, 2, 3, 4, 5];
        const readonly = new Set(['A1', 'B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'D2', 'A3', 'B3', 'C3', 'D3', 'A4', 'B4', 'C4', 'D4', 'A5', 'B5', 'C5', 'D5']);
        const grid = cellModel.createGrid(cols, rows);
        const items = [
            { name: 'A4 Paper Ream', qty: 48, price: 25, value: 1200 },
            { name: 'Stapler', qty: 15, price: 60, value: 900 },
            { name: 'Marker Set', qty: 30, price: 45, value: 1350 },
            { name: 'Envelope Box', qty: 60, price: 10, value: 600 }
        ];
        const seed = { A1: 'Item', B1: 'Qty', C1: 'Unit Price (৳)', D1: 'Value (৳)' };
        items.forEach((it, i) => {
            const r = i + 2;
            seed['A' + r] = it.name; seed['B' + r] = String(it.qty); seed['C' + r] = String(it.price); seed['D' + r] = String(it.value);
        });
        Object.keys(seed).forEach(id => cellModel.setRaw(grid, id, seed[id]));
        let computed = {};
        let selected = 'A1';
        let selectAnchor = 'A1';
        let selectedRange = new Set(['A1']);
        let chartGenerated = false;

        const ctx = {
            setSelected(id) { selected = id; },
            onCellMouseDown(id, shift) {
                if (shift && selectAnchor) selectedRange = rectRange(selectAnchor, id, cols, rows);
                else { selectAnchor = id; selectedRange = new Set([id]); }
                selected = id;
                render();
            },
            getRaw(id) { return cellModel.getRaw(grid, id); },
            commit(id, val) {
                if (cellModel.getRaw(grid, id) === val) { render(); return; }
                cellModel.setRaw(grid, id, val);
                render();
            },
            onNavigate() {}
        };

        const render = guardedRender(function () {
            computed = cellModel.recomputeGrid(grid, formulaEngine);
            renderGrid('m4-grid', grid, computed, cols, rows, {
                readonly, selected, selectedRange,
                styleFor: id => cellModel.getStyle(grid, id),
                formatter: (id, v) => cellModel.formatValue(v, cellModel.getStyle(grid, id).numberFormat)
            });
            bindGridEvents('m4-grid', cols, rows, ctx);
            focusCell('m4-grid', selected);
            updateProgress();
        });

        function applyFormat(patch) {
            const targets = selectedRange.size ? selectedRange : new Set([selected]);
            targets.forEach(id => cellModel.setStyle(grid, id, patch));
            render();
        }
        $('#m4-bold').addEventListener('click', () => applyFormat({ bold: true }));
        $('#m4-currency').addEventListener('click', () => applyFormat({ numberFormat: 'currency' }));
        $('#m4-general').addEventListener('click', () => applyFormat({ bold: false, numberFormat: 'general' }));

        $('#m4-generate').addEventListener('click', () => {
            const categories = items.map(it => it.name);
            const values = items.map(it => it.qty);
            $('#m4-chart').innerHTML = chartRenderer.renderBarChart(categories, values, { title: 'Quantity by Item' });
            chartGenerated = true;
            updateProgress();
            showToast('Chart generated.', 'success');
        });

        function checks() {
            const headerBold = ['A1', 'B1', 'C1', 'D1'].every(id => cellModel.getStyle(grid, id).bold);
            const valueCurrency = ['D2', 'D3', 'D4', 'D5'].every(id => cellModel.getStyle(grid, id).numberFormat === 'currency');
            return [headerBold, valueCurrency, chartGenerated];
        }
        function updateProgress() {
            const c = checks();
            const labels = ['Header bold', 'Values as currency', 'Chart generated'];
            $('#m4-progress-text').textContent = labels.filter((l, i) => c[i]).join(' · ') || 'Nothing done yet.';
        }

        $('#m4-check').addEventListener('click', () => {
            const c = checks();
            if (c.every(Boolean)) {
                feedback('#m4-feedback', true, '✅ Formatted and charted — a complete, presentable sheet, start to finish.');
                markModuleDone(4);
            } else {
                feedback('#m4-feedback', false, `${c.filter(Boolean).length} of 3 steps done.`);
            }
        });

        render();
    })();

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        renderRail();
        const firstIncomplete = MODULES.find(m => !progress.moduleDone[m.n]);
        goToModule(firstIncomplete ? firstIncomplete.n : 4);
        if (progress.allDone()) $('#lessonStampBanner').classList.add('show');

        if (!session) {
            showToast('You’re not signed in — progress here won’t be saved to a passport. Sign in from the home page first.', 'error');
        } else if (!progress.isLessonComplete('spreadsheet-mastery-lesson3')) {
            showToast('Tip: this lesson is presentation only — no new formulas, just formatting what you already know how to build.', '');
        } else if (firstIncomplete && firstIncomplete.n > 1) {
            showToast('Welcome back — resuming at Module ' + firstIncomplete.n + '.', 'success');
        }
    }

    init();
})();

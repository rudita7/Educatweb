(function () {
    "use strict";

    const cellModel = window.SM.cellModel;
    const formulaEngine = window.SM.formulaEngine;
    const sortFilterEngine = window.SM.sortFilterEngine;
    const validationEngine = window.SM.validationEngine;
    const chartRenderer = window.SM.chartRenderer;
    const inject = window.SM.errorInjectionEngine;
    const kit = window.SM.lessonKit;

    const { $, $$, showToast, feedback, renderGrid, renderDataTable, focusCell, bindGridEvents, guardedRender, escapeHtml, Storage } = kit;

    const CAPSTONE_ID = 'spreadsheet-mastery-capstone';
    const PASS_THRESHOLD = 80;
    const session = kit.loadSession();

    function isLessonComplete(lessonId) {
        if (!session) return false;
        const progress = Storage.get('progress:' + session.num) || {};
        return !!progress[lessonId];
    }

    function awardCapstoneStamp() {
        if (!session) return;
        const progress = Storage.get('progress:' + session.num) || {};
        progress[CAPSTONE_ID] = true;
        progress['spreadsheet-basics'] = true; // marks the whole track complete on the homepage tile (webapp/index1.html TRACKS id)
        Storage.set('progress:' + session.num, progress);
    }

    // Deterministic "messy dataset" generation (spec §7): same seed every
    // load so the challenge and its ground-truth answers stay consistent
    // for grading, while still genuinely running through the injection
    // engine rather than a hand-typed corrupted string.
    const rand = inject.mulberry32(2026071501);
    const CUSTOMER_CLEAN = { name: 'Dhanmondi Hardware' };
    const CUSTOMER_CORRUPTED = inject.injectExtraWhitespace(CUSTOMER_CLEAN, 'name').corruptedRecord.name;

    // ============================================================
    //  PART 1 — Fix the invoice (data entry + formula repair)
    // ============================================================
    let p1Score = 0, p1Total = 3;
    (function Part1() {
        $('#p1-customer').value = CUSTOMER_CORRUPTED;
        function checkCustomer() {
            const ok = $('#p1-customer').value.trim() === CUSTOMER_CLEAN.name;
            $('#p1-customer-hint').textContent = ok ? '✅ Cleaned.' : `Currently: "${$('#p1-customer').value}" (raw, with the extra whitespace still in it).`;
            $('#p1-customer-hint').classList.toggle('error', !ok);
            return ok;
        }
        checkCustomer();
        $('#p1-customer').addEventListener('input', () => { checkCustomer(); updateAll(); });

        const cols = ['A', 'B', 'C', 'D'];
        const rows = [1, 2, 3];
        const readonly = new Set(['A1', 'B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3']);
        window.__p1Grid = cellModel.createGrid(cols, rows);
        const grid = window.__p1Grid;
        const seed = {
            A1: 'Item', B1: 'Qty', C1: 'Unit Price', D1: 'Line Total',
            A2: 'Steel Shelving Unit', B2: '4', C2: '1200',
            A3: 'Filing Cabinet', B3: '6', C3: '350', D3: '=B3*C3)'
        };
        Object.keys(seed).forEach(id => cellModel.setRaw(grid, id, seed[id]));
        let computed = {};
        let selected = 'D2';

        const ctx = {
            setSelected(id) { selected = id; $$('#p1-grid td').forEach(td => td.classList.toggle('selected-cell', td.dataset.cell === id)); },
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
            renderGrid('p1-grid', grid, computed, cols, rows, { readonly, selected });
            bindGridEvents('p1-grid', cols, rows, ctx);
            focusCell('p1-grid', selected);
            updateAll();
        });
        render();

        window.__p1Checks = function () {
            const d2ok = cellModel.getRaw(grid, 'D2').charAt(0) === '=' && typeof computed.D2 === 'number' && Math.abs(computed.D2 - 4800) < 0.01;
            const d3ok = cellModel.getRaw(grid, 'D3').charAt(0) === '=' && typeof computed.D3 === 'number' && Math.abs(computed.D3 - 2100) < 0.01;
            const custOk = $('#p1-customer').value.trim() === CUSTOMER_CLEAN.name;
            return [custOk, d2ok, d3ok];
        };
    })();

    // ============================================================
    //  PART 2 — Sort + LOOKUP
    // ============================================================
    (function Part2() {
        const INVENTORY = [
            { id: 1, item: 'A4 Paper Ream', qty: 48 },
            { id: 2, item: 'Stapler', qty: 15 },
            { id: 3, item: 'Marker Set', qty: 30 },
            { id: 4, item: 'Envelope Box', qty: 60 },
            { id: 5, item: 'Whiteboard Marker', qty: 8 }
        ];
        window.__p2Inventory = INVENTORY;
        let sortKeys = [];
        function renderTable() {
            const displayRows = sortFilterEngine.sortRows(INVENTORY, sortKeys);
            renderDataTable('p2-table', displayRows, [
                { key: 'item', label: 'Item' },
                { key: 'qty', label: 'Qty' }
            ], {
                sortKeys,
                onHeaderClick(key) {
                    const existing = sortKeys.find(k => k.key === key);
                    if (existing) existing.dir = existing.dir === 'asc' ? 'desc' : 'asc';
                    else sortKeys = [{ key, dir: 'asc' }];
                    renderTable();
                }
            });
        }
        renderTable();
        $('#p2-answer').innerHTML += INVENTORY.map(it => `<option value="${escapeHtml(it.item)}">${escapeHtml(it.item)}</option>`).join('');
        $('#p2-answer').addEventListener('change', updateAll);

        const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
        const rows = [1, 2, 3, 4, 5];
        const readonly = new Set(['A1', 'B1', 'D1', 'E1', 'F1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5', 'B5', 'D2', 'E2']);
        const grid = cellModel.createGrid(cols, rows);
        const seed = {
            A1: 'Customer ID', B1: 'Name', D1: 'Invoice', E1: 'Customer ID', F1: 'Customer Name',
            A2: 'CUS-301', B2: 'Green Valley Traders',
            A3: 'CUS-302', B3: 'Bay Textiles Ltd.',
            A4: 'CUS-303', B4: 'Dhanmondi Hardware',
            A5: 'CUS-304', B5: 'Sundarban Foods',
            D2: 'INV-601', E2: 'CUS-303'
        };
        Object.keys(seed).forEach(id => cellModel.setRaw(grid, id, seed[id]));
        let computed = {};
        let selected = 'F2';

        const ctx = {
            setSelected(id) { selected = id; $$('#p2-grid td').forEach(td => td.classList.toggle('selected-cell', td.dataset.cell === id)); },
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
            renderGrid('p2-grid', grid, computed, cols, rows, { readonly, selected });
            bindGridEvents('p2-grid', cols, rows, ctx);
            focusCell('p2-grid', selected);
            updateAll();
        });
        render();

        window.__p2Checks = function () {
            const lowest = INVENTORY.slice().sort((a, b) => a.qty - b.qty)[0].item;
            const answerOk = $('#p2-answer').value === lowest;
            const raw = cellModel.getRaw(grid, 'F2');
            const lookupOk = raw.charAt(0) === '=' && String(computed.F2).trim().toLowerCase() === 'dhanmondi hardware';
            return [answerOk, lookupOk];
        };
    })();

    // ============================================================
    //  PART 3 — Data Validation fixes
    // ============================================================
    (function Part3() {
        const RECORDS = [
            { id: 1, label: 'Nusrat Jahan — Attendance Status', field: 'status', value: 'On Leave', type: 'list', options: ['Present', 'Absent', 'Late'] },
            { id: 2, label: 'A4 Paper Ream — Quantity', field: 'quantity', value: 750, type: 'range', min: 0, max: 500 }
        ];
        function ruleFor(rec) {
            return rec.type === 'list' ? { field: rec.field, type: 'list', options: rec.options } : { field: rec.field, type: 'range', min: rec.min, max: rec.max };
        }
        function render() {
            $('#p3-records').innerHTML = RECORDS.map(rec => {
                const result = validationEngine.validateField(rec.value, ruleFor(rec));
                const control = rec.type === 'list'
                    ? `<select class="field-select" data-id="${rec.id}" style="width:100%;">${rec.options.map(o => `<option value="${o}" ${o === rec.value ? 'selected' : ''}>${o}</option>`).join('')}</select>`
                    : `<input type="number" class="field-select" data-id="${rec.id}" style="width:100%;" value="${escapeHtml(rec.value)}" />`;
                return `<div class="check-panel" style="margin-top:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
                        <strong style="font-size:0.88rem;">${escapeHtml(rec.label)}</strong>
                        <span class="badge ${result.valid ? 'badge-ok' : 'badge-late'}">${result.valid ? 'Valid' : 'Invalid'}</span>
                    </div>
                    <div style="margin-top:8px;max-width:220px;">${control}</div>
                    <div class="field-hint ${result.valid ? '' : 'error'}">${result.valid ? '' : result.message}</div>
                </div>`;
            }).join('');
            $$('#p3-records [data-id]').forEach(el => {
                el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
                    const rec = RECORDS.find(r => r.id === Number(el.dataset.id));
                    rec.value = el.value;
                    render();
                    const refocus = $('#p3-records [data-id="' + rec.id + '"]');
                    if (refocus) refocus.focus();
                    updateAll();
                });
            });
        }
        render();

        window.__p3Checks = function () {
            return RECORDS.map(rec => validationEngine.validateField(rec.value, ruleFor(rec)).valid);
        };
    })();

    // ============================================================
    //  PART 4 — Format + Chart
    // ============================================================
    let p4ChartGenerated = false;
    (function Part4() {
        function syncPreview() {
            const grid = window.__p1Grid;
            const computed = cellModel.recomputeGrid(grid, formulaEngine);
            renderGrid('p4-grid-preview', grid, computed, ['A', 'B', 'C', 'D'], [1, 2, 3], {
                readonly: new Set(['A1', 'B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'D2', 'A3', 'B3', 'C3', 'D3']),
                styleFor: id => cellModel.getStyle(grid, id),
                formatter: (id, v) => cellModel.formatValue(v, cellModel.getStyle(grid, id).numberFormat)
            });
        }
        syncPreview();

        $('#p4-bold').addEventListener('click', () => {
            const grid = window.__p1Grid;
            ['A1', 'B1', 'C1', 'D1'].forEach(id => cellModel.setStyle(grid, id, { bold: true }));
            syncPreview();
            updateAll();
        });
        $('#p4-currency').addEventListener('click', () => {
            const grid = window.__p1Grid;
            ['D2', 'D3'].forEach(id => cellModel.setStyle(grid, id, { numberFormat: 'currency' }));
            syncPreview();
            updateAll();
        });
        $('#p4-generate').addEventListener('click', () => {
            const items = window.__p2Inventory;
            $('#p4-chart').innerHTML = chartRenderer.renderBarChart(items.map(i => i.item), items.map(i => i.qty), { title: 'Inventory Quantity by Item' });
            p4ChartGenerated = true;
            updateAll();
            showToast('Chart generated.', 'success');
        });

        window.__p4Checks = function () {
            const grid = window.__p1Grid;
            const headerBold = ['A1', 'B1', 'C1', 'D1'].every(id => cellModel.getStyle(grid, id).bold);
            const totalsCurrency = ['D2', 'D3'].every(id => cellModel.getStyle(grid, id).numberFormat === 'currency');
            return [headerBold, totalsCurrency, p4ChartGenerated];
        };
    })();

    // ============================================================
    //  SCORING
    // ============================================================
    function scorePart(checks) {
        const correct = checks.filter(Boolean).length;
        return { correct, total: checks.length, points: (correct / checks.length) * 25 };
    }

    function computeScores() {
        const p1 = scorePart(window.__p1Checks ? window.__p1Checks() : [false, false, false]);
        const p2 = scorePart(window.__p2Checks ? window.__p2Checks() : [false, false]);
        const p3 = scorePart(window.__p3Checks ? window.__p3Checks() : [false, false]);
        const p4 = scorePart(window.__p4Checks ? window.__p4Checks() : [false, false, false]);
        const total = p1.points + p2.points + p3.points + p4.points;
        return { p1, p2, p3, p4, total: Math.round(total) };
    }

    function updateAll() {
        const s = computeScores();
        $('#scoreBoard').innerHTML = [
            ['Part 1 · Data Entry', s.p1], ['Part 2 · Sort/Lookup', s.p2],
            ['Part 3 · Validation', s.p3], ['Part 4 · Presentation', s.p4]
        ].map(([label, part]) => `
            <div class="score-pill ${part.correct === part.total ? 'pass' : ''}">
                <div class="label">${label}</div>
                <div class="value">${part.correct}/${part.total}</div>
            </div>
        `).join('');
        $('#p1-status').textContent = `${s.p1.correct} of ${s.p1.total} correct.`;
        $('#p2-status').textContent = `${s.p2.correct} of ${s.p2.total} correct.`;
        $('#p3-status').textContent = `${s.p3.correct} of ${s.p3.total} valid.`;
        $('#p4-status').textContent = `${s.p4.correct} of ${s.p4.total} steps done.`;
        $('#finalScoreNumber').textContent = s.total + ' / 100';
        $('#finalScoreNumber').style.color = s.total >= PASS_THRESHOLD ? 'var(--teal)' : 'var(--ink)';
        return s;
    }

    $('#finalCheckBtn').addEventListener('click', () => {
        const s = updateAll();
        if (s.total >= PASS_THRESHOLD) {
            awardCapstoneStamp();
            feedback('#finalFeedback', true, `✅ ${s.total}/100 — you passed the capstone! Spreadsheet Mastery stamp awarded. Head back to your passport to see it.`);
            showToast('🏆 Capstone complete!', 'success');
        } else {
            feedback('#finalFeedback', false, `${s.total}/100 — below the ${PASS_THRESHOLD}/100 passing score. Check the part scores above and fix what's still wrong, then submit again.`);
        }
    });

    // ============================================================
    //  GATING — capstone requires all 4 lessons complete
    // ============================================================
    function init() {
        const lessonsDone = [1, 2, 3, 4].every(n => isLessonComplete('spreadsheet-mastery-lesson' + n));
        if (!lessonsDone && session) {
            $('#lockedNotice').style.display = 'block';
            $('#capstoneBody').style.display = 'none';
            return;
        }
        if (!session) {
            showToast('You’re not signed in — progress here won’t be saved to a passport. Sign in from the home page first.', 'error');
        }
        updateAll();
    }

    init();
})();

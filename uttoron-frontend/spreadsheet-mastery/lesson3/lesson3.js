(function () {
    "use strict";

    const cellModel = window.SM.cellModel;
    const formulaEngine = window.SM.formulaEngine;
    const sortFilterEngine = window.SM.sortFilterEngine;
    const validationEngine = window.SM.validationEngine;
    const kit = window.SM.lessonKit;

    const { $, $$, showToast, feedback, renderGrid, renderDataTable, focusCell, bindGridEvents, guardedRender, escapeHtml } = kit;

    const LESSON_ID = 'spreadsheet-mastery-lesson3';
    const MODULE_NUMBERS = [1, 2, 3, 4, 5];
    const progress = kit.createProgress(LESSON_ID, MODULE_NUMBERS);
    const session = progress.session;

    // ============================================================
    //  MODULE RAIL
    // ============================================================
    const MODULES = [
        { n: 1, label: 'Sorting' },
        { n: 2, label: 'Filtering' },
        { n: 3, label: 'LOOKUP' },
        { n: 4, label: 'Validation' },
        { n: 5, label: 'Fix Invalid' }
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

    // ============================================================
    //  MODULE 1 — Sorting
    // ============================================================
    (function Module1() {
        const ORIGINAL = [
            { id: 1, item: 'A4 Paper Ream', qty: 48, location: 'Shelf A2' },
            { id: 2, item: 'Stapler', qty: 15, location: 'Shelf B3' },
            { id: 3, item: 'Marker Set', qty: 30, location: 'Shelf C1' },
            { id: 4, item: 'Envelope Box', qty: 30, location: 'Shelf A2' },
            { id: 5, item: 'Whiteboard Marker', qty: 8, location: 'Shelf B3' },
            { id: 6, item: 'Binder Clips', qty: 15, location: 'Shelf A2' }
        ];
        const TARGET_ORDER = [5, 6, 2, 4, 3, 1]; // qty asc, location asc tie-break
        const COLUMNS = [
            { key: 'item', label: 'Item' },
            { key: 'qty', label: 'Qty' },
            { key: 'location', label: 'Location' }
        ];
        let sortKeys = [];

        function render() {
            const displayRows = sortFilterEngine.sortRows(ORIGINAL, sortKeys);
            renderDataTable('m1-table', displayRows, COLUMNS, {
                sortKeys,
                onHeaderClick(key, shift) {
                    const existingIdx = sortKeys.findIndex(k => k.key === key);
                    if (shift) {
                        if (existingIdx === -1) sortKeys.push({ key, dir: 'asc' });
                        else sortKeys[existingIdx].dir = sortKeys[existingIdx].dir === 'asc' ? 'desc' : 'asc';
                    } else {
                        if (existingIdx === 0 && sortKeys.length === 1) sortKeys[0].dir = sortKeys[0].dir === 'asc' ? 'desc' : 'asc';
                        else sortKeys = [{ key, dir: 'asc' }];
                    }
                    render();
                }
            });
        }
        render();

        $('#m1-reset').addEventListener('click', () => { sortKeys = []; render(); });

        $('#m1-check').addEventListener('click', () => {
            const displayRows = sortFilterEngine.sortRows(ORIGINAL, sortKeys);
            const actualOrder = displayRows.map(r => r.id);
            const correct = JSON.stringify(actualOrder) === JSON.stringify(TARGET_ORDER);
            if (correct) {
                feedback('#m1-feedback', true, '✅ Sorted by Quantity, with Location correctly breaking every tie.');
                markModuleDone(1);
            } else {
                feedback('#m1-feedback', false, 'Not quite the right order yet. Click Quantity first, then Shift-click Location to add it as a tie-breaker.');
            }
        });
    })();

    // ============================================================
    //  MODULE 2 — Filtering
    // ============================================================
    (function Module2() {
        const ORIGINAL = [
            { id: 1, name: 'Farhana Akter', status: 'Present' },
            { id: 2, name: 'Shakil Rahman', status: 'Late' },
            { id: 3, name: 'Nusrat Jahan', status: 'Absent' },
            { id: 4, name: 'Imran Kabir', status: 'Present' },
            { id: 5, name: 'Tania Sultana', status: 'Late' },
            { id: 6, name: 'Rafiq Islam', status: 'Absent' }
        ];
        const TARGET_IDS = [2, 3, 5, 6]; // Late or Absent
        const COLUMNS = [
            { key: 'name', label: 'Employee' },
            { key: 'status', label: 'Status', render: r => `<span class="badge badge-${r.status.toLowerCase()}">${escapeHtml(r.status)}</span>` }
        ];
        const STATUSES = ['Present', 'Late', 'Absent'];
        let checked = new Set(STATUSES);
        let applied = false;
        let currentIds = ORIGINAL.map(r => r.id);

        function renderChecks() {
            $('#m2-status-checks').innerHTML = STATUSES.map(s => `
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                    <input type="checkbox" data-status="${s}" ${checked.has(s) ? 'checked' : ''} /> ${s}
                </label>`).join('');
            $$('#m2-status-checks input').forEach(cb => {
                cb.addEventListener('change', () => {
                    if (cb.checked) checked.add(cb.dataset.status); else checked.delete(cb.dataset.status);
                });
            });
        }
        renderChecks();

        function renderTable() {
            const rows = ORIGINAL.filter(r => currentIds.includes(r.id));
            renderDataTable('m2-table', rows, COLUMNS, {});
            $('#m2-status-text').textContent = applied
                ? `Showing ${rows.length} of ${ORIGINAL.length} records (filtered).`
                : `Showing all ${ORIGINAL.length} records.`;
        }
        renderTable();

        $('#m2-apply').addEventListener('click', () => {
            let matched = [];
            checked.forEach(status => {
                sortFilterEngine.filterRows(ORIGINAL, [{ key: 'status', op: 'equals', value: status }]).forEach(r => {
                    if (!matched.includes(r.id)) matched.push(r.id);
                });
            });
            currentIds = matched;
            applied = true;
            renderTable();
        });
        $('#m2-clear').addEventListener('click', () => {
            currentIds = ORIGINAL.map(r => r.id);
            applied = false;
            checked = new Set(STATUSES);
            renderChecks();
            renderTable();
        });

        $('#m2-check').addEventListener('click', () => {
            const shown = currentIds.slice().sort((a, b) => a - b);
            const target = TARGET_IDS.slice().sort((a, b) => a - b);
            const correct = applied && JSON.stringify(shown) === JSON.stringify(target);
            if (correct) {
                feedback('#m2-feedback', true, '✅ Exactly the Late and Absent records — nothing more, nothing less.');
                markModuleDone(2);
            } else if (!applied) {
                feedback('#m2-feedback', false, 'Tick Late and Absent, then click "Apply filter" before checking.');
            } else {
                feedback('#m2-feedback', false, `Showing ${shown.length} records, but that's not exactly Late + Absent. Check your ticked boxes.`);
            }
        });
    })();

    // ============================================================
    //  MODULE 3 — LOOKUP (customer master list + invoices, one sheet)
    // ============================================================
    (function Module3() {
        const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
        const rows = [1, 2, 3, 4, 5];
        const readonly = new Set(['A1', 'B1', 'D1', 'E1', 'F1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5', 'B5', 'D2', 'E2', 'D3', 'E3', 'D4', 'E4']);
        const grid = cellModel.createGrid(cols, rows);
        const seed = {
            A1: 'Customer ID', B1: 'Name', D1: 'Invoice', E1: 'Customer ID', F1: 'Customer Name',
            A2: 'CUS-301', B2: 'Green Valley Traders',
            A3: 'CUS-302', B3: 'Bay Textiles Ltd.',
            A4: 'CUS-303', B4: 'Dhanmondi Hardware',
            A5: 'CUS-304', B5: 'Sundarban Foods',
            D2: 'INV-501', E2: 'CUS-303',
            D3: 'INV-502', E3: 'CUS-301',
            D4: 'INV-503', E4: 'CUS-304'
        };
        Object.keys(seed).forEach(id => cellModel.setRaw(grid, id, seed[id]));
        let computed = {};
        let selected = 'F2';

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
            const correct = ['F2', 'F3', 'F4'].filter(id => {
                const raw = cellModel.getRaw(grid, id);
                return raw && raw.charAt(0) === '=' && typeof computed[id] === 'string' && computed[id].charAt(0) !== '#';
            });
            $('#m3-progress-text').textContent = correct.length + ' of 3 correct.';
        });
        render();

        const EXPECTED = { F2: 'Dhanmondi Hardware', F3: 'Green Valley Traders', F4: 'Sundarban Foods' };

        $('#m3-check').addEventListener('click', () => {
            const results = ['F2', 'F3', 'F4'].map(id => {
                const raw = cellModel.getRaw(grid, id);
                const isFormula = raw && raw.charAt(0) === '=';
                const v = computed[id];
                return isFormula && String(v).trim().toLowerCase() === EXPECTED[id].toLowerCase();
            });
            const correct = results.filter(Boolean).length;
            $('#m3-progress-text').textContent = correct + ' of 3 correct.';
            if (correct === 3) {
                feedback('#m3-feedback', true, '✅ Every invoice correctly matched to its customer name via LOOKUP.');
                markModuleDone(3);
            } else {
                feedback('#m3-feedback', false, `${correct} of 3 correct so far. Try =LOOKUP(E2,A2:A5,B2:B5) in F2, and the same pattern for F3/F4.`);
            }
        });
    })();

    // ============================================================
    //  MODULE 4 — Data Validation: Restricting Entry
    // ============================================================
    (function Module4() {
        const STATUS_OPTIONS = ['Present', 'Absent', 'Late'];
        const QTY_RULE = { field: 'quantity', type: 'range', min: 0, max: 500 };

        $('#m4-status').innerHTML = STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('');

        const qtyInput = $('#m4-qty');
        function renderQtyHint() {
            const result = validationEngine.validateField(qtyInput.value, QTY_RULE);
            qtyInput.classList.toggle('cell-error', !result.valid);
            $('#m4-qty-hint').textContent = result.valid ? '✅ Valid quantity.' : result.message;
            $('#m4-qty-hint').classList.toggle('error', !result.valid);
            return result.valid;
        }
        renderQtyHint();
        qtyInput.addEventListener('input', renderQtyHint);

        $('#m4-check').addEventListener('click', () => {
            const qtyValid = renderQtyHint();
            const statusValid = STATUS_OPTIONS.includes($('#m4-status').value);
            if (qtyValid && statusValid) {
                feedback('#m4-feedback', true, '✅ The dropdown only ever offers a valid status, and the quantity now passes its range restriction — that\'s data validation actually preventing bad entries.');
                markModuleDone(4);
            } else {
                feedback('#m4-feedback', false, 'The quantity still needs to be between 0 and 500.');
            }
        });
    })();

    // ============================================================
    //  MODULE 5 — Data Validation: Practice (fix a batch)
    // ============================================================
    (function Module5() {
        const RECORDS = [
            { id: 1, label: 'Farhana Akter — Status', field: 'status', value: 'On Leave', type: 'list', options: ['Present', 'Absent', 'Late'] },
            { id: 2, label: 'Shakil Rahman — Status', field: 'status', value: 'Late', type: 'list', options: ['Present', 'Absent', 'Late'] },
            { id: 3, label: 'A4 Paper Ream — Quantity', field: 'quantity', value: 9999, type: 'range', min: 0, max: 500 },
            { id: 4, label: 'Stapler — Quantity', field: 'quantity', value: -5, type: 'range', min: 0, max: 500 }
        ];

        function ruleFor(rec) {
            return rec.type === 'list'
                ? { field: rec.field, type: 'list', options: rec.options }
                : { field: rec.field, type: 'range', min: rec.min, max: rec.max };
        }

        function render() {
            $('#m5-records').innerHTML = RECORDS.map(rec => {
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

            $$('#m5-records [data-id]').forEach(el => {
                el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
                    const rec = RECORDS.find(r => r.id === Number(el.dataset.id));
                    rec.value = el.value;
                    render();
                    focusAfterRerender(rec.id);
                });
            });
            updateProgress();
        }
        function focusAfterRerender(id) {
            const el = $('#m5-records [data-id="' + id + '"]');
            if (el) el.focus();
        }

        function updateProgress() {
            const validCount = RECORDS.filter(rec => validationEngine.validateField(rec.value, ruleFor(rec)).valid).length;
            $('#m5-progress-text').textContent = validCount + ' of 4 valid.';
        }

        render();

        $('#m5-check').addEventListener('click', () => {
            const validCount = RECORDS.filter(rec => validationEngine.validateField(rec.value, ruleFor(rec)).valid).length;
            if (validCount === 4) {
                feedback('#m5-feedback', true, '✅ Every record now passes its validation rule.');
                markModuleDone(5);
            } else {
                feedback('#m5-feedback', false, `${validCount} of 4 valid. Fix the ones flagged Invalid.`);
            }
        });
    })();

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        renderRail();
        const firstIncomplete = MODULES.find(m => !progress.moduleDone[m.n]);
        goToModule(firstIncomplete ? firstIncomplete.n : 5);
        if (progress.allDone()) $('#lessonStampBanner').classList.add('show');

        if (!session) {
            showToast('You’re not signed in — progress here won’t be saved to a passport. Sign in from the home page first.', 'error');
        } else if (!progress.isLessonComplete('spreadsheet-mastery-lesson2')) {
            showToast('Tip: Lesson 2\'s formulas (IF, COUNTIF, LOOKUP\'s cousin SUMIF) feed directly into this lesson.', '');
        } else if (firstIncomplete && firstIncomplete.n > 1) {
            showToast('Welcome back — resuming at Module ' + firstIncomplete.n + '.', 'success');
        }
    }

    init();
})();

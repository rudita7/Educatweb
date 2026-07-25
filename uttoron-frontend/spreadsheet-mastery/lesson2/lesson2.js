(function () {
    "use strict";

    const cellModel = window.SM.cellModel;
    const formulaEngine = window.SM.formulaEngine;
    const kit = window.SM.lessonKit;

    const { $, $$, showToast, feedback, renderGrid, focusCell, bindGridEvents, guardedRender } = kit;

    const LESSON_ID = 'spreadsheet-mastery-lesson2';
    const MODULE_NUMBERS = [1, 2, 3, 4, 5, 6];
    const progress = kit.createProgress(LESSON_ID, MODULE_NUMBERS);
    const session = progress.session;

    // ============================================================
    //  MODULE RAIL
    // ============================================================
    const MODULES = [
        { n: 1, label: 'SUM/AVERAGE' },
        { n: 2, label: 'MIN/MAX/COUNT' },
        { n: 3, label: 'IF' },
        { n: 4, label: 'Nested Logic' },
        { n: 5, label: 'COUNTIF/SUMIF' },
        { n: 6, label: 'Fix Errors' }
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
    //  SHARED GRID CONTROLLER FACTORY -- every module below is a set
    //  of small, independent grids (one per record domain being
    //  practiced), each wired the same way: create + seed a grid,
    //  render/rebind on every commit, let the caller read computed
    //  values back for grading. Grading logic stays local to each
    //  module; this factory only owns rendering/editing mechanics.
    // ============================================================
    function makeGridController(containerId, cols, rows, readonlySet, seed) {
        const grid = cellModel.createGrid(cols, rows);
        Object.keys(seed).forEach(id => cellModel.setRaw(grid, id, seed[id]));
        let computed = {};
        let selected = cols[0] + rows[0];

        const ctx = {
            setSelected(id) {
                selected = id;
                $$('#' + containerId + ' td').forEach(td => td.classList.toggle('selected-cell', td.dataset.cell === id));
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
            renderGrid(containerId, grid, computed, cols, rows, { readonly: readonlySet, selected });
            bindGridEvents(containerId, cols, rows, ctx);
            focusCell(containerId, selected);
        });

        render();
        return {
            grid,
            getComputed(id) { return computed[id]; },
            getRaw(id) { return cellModel.getRaw(grid, id); }
        };
    }

    function isCorrectFormula(ctrl, id, expected, epsilon) {
        const raw = ctrl.getRaw(id);
        if (!raw || raw.charAt(0) !== '=') return false;
        const v = ctrl.getComputed(id);
        if (typeof expected === 'number') return typeof v === 'number' && Math.abs(v - expected) < (epsilon || 0.01);
        return String(v).trim().toLowerCase() === String(expected).trim().toLowerCase();
    }

    // ============================================================
    //  MODULE 1 — SUM & AVERAGE (invoice + attendance)
    // ============================================================
    (function Module1() {
        const a = makeGridController('m1a-grid', ['A', 'B'], [1, 2, 3, 4, 5, 6],
            new Set(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5', 'A6']),
            { A1: 'Item', B1: 'Line Total (৳)', A2: 'Cotton fabric roll', B2: '10200', A3: 'Delivery charge', B3: '500', A4: 'Packaging', B4: '300', A5: 'Grand Total', A6: 'Average per item' });
        const b = makeGridController('m1b-grid', ['A', 'B'], [1, 2, 3, 4, 5, 6, 7, 8],
            new Set(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5', 'B5', 'A6', 'B6', 'A7', 'A8']),
            { A1: 'Day', B1: 'Hours', A2: 'Mon', B2: '8', A3: 'Tue', B3: '7.5', A4: 'Wed', B4: '8', A5: 'Thu', B5: '8', A6: 'Fri', B6: '6.5', A7: 'Total Hours', A8: 'Average Hours/Day' });

        $('#m1-check').addEventListener('click', () => {
            const checks = [
                isCorrectFormula(a, 'B5', 11000),
                isCorrectFormula(a, 'B6', 11000 / 3),
                isCorrectFormula(b, 'B7', 38),
                isCorrectFormula(b, 'B8', 38 / 5)
            ];
            const correct = checks.filter(Boolean).length;
            $('#m1-progress-text').textContent = correct + ' of 4 correct.';
            if (correct === 4) {
                feedback('#m1-feedback', true, '✅ SUM and AVERAGE both correct on the invoice and the attendance sheet.');
                markModuleDone(1);
            } else {
                feedback('#m1-feedback', false, `${correct} of 4 correct so far. Grand Total/Total Hours need SUM; the averages need AVERAGE.`);
            }
        });
    })();

    // ============================================================
    //  MODULE 2 — MIN, MAX, COUNT, COUNTA (inventory + attendance)
    // ============================================================
    (function Module2() {
        const a = makeGridController('m2a-grid', ['A', 'B'], [1, 2, 3, 4, 5, 6, 7, 8, 9],
            new Set(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5', 'B5', 'A6', 'B6', 'A7', 'A8', 'A9']),
            { A1: 'Item', B1: 'Qty', A2: 'A4 Paper Ream', B2: '48', A3: 'Stapler', B3: '15', A4: 'Marker Set', B4: '30', A5: 'Envelope Box', B5: '60', A6: 'Whiteboard Marker', B6: '8', A7: 'Highest Qty (MAX)', A8: 'Lowest Qty (MIN)', A9: 'Items Counted (COUNT)' });
        const b = makeGridController('m2b-grid', ['A', 'B'], [1, 2, 3, 4, 5, 6, 7, 8],
            new Set(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5', 'B5', 'A6', 'B6', 'A7', 'A8']),
            { A1: 'Employee', B1: 'Days Late', A2: 'Farhana Akter', B2: '2', A3: 'Shakil Rahman', B3: '0', A4: 'Nusrat Jahan', B4: 'N/A', A5: 'Imran Kabir', B5: '5', A6: 'Tania Sultana', B6: '1', A7: 'Employees Tracked (COUNTA)', A8: 'Numeric Entries Only (COUNT)' });

        $('#m2-check').addEventListener('click', () => {
            const checks = [
                isCorrectFormula(a, 'B7', 60),
                isCorrectFormula(a, 'B8', 8),
                isCorrectFormula(a, 'B9', 5),
                isCorrectFormula(b, 'B7', 5),
                isCorrectFormula(b, 'B8', 4)
            ];
            const correct = checks.filter(Boolean).length;
            $('#m2-progress-text').textContent = correct + ' of 5 correct.';
            if (correct === 5) {
                feedback('#m2-feedback', true, '✅ MAX, MIN, COUNT, and COUNTA are all correct — including telling COUNT and COUNTA apart on the "N/A" row.');
                markModuleDone(2);
            } else {
                feedback('#m2-feedback', false, `${correct} of 5 correct so far.`);
            }
        });
    })();

    // ============================================================
    //  MODULE 3 — IF (attendance "Late" + inventory "Reorder")
    // ============================================================
    (function Module3() {
        const a = makeGridController('m3a-grid', ['A', 'B', 'C'], [1, 2, 3, 4],
            new Set(['A1', 'B1', 'C1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4']),
            { A1: 'Employee', B1: 'Check-in', C1: 'Status', A2: 'Farhana Akter', B2: '09:15', A3: 'Shakil Rahman', B3: '08:50', A4: 'Nusrat Jahan', B4: '09:05' });
        const b = makeGridController('m3b-grid', ['A', 'B', 'C'], [1, 2, 3, 4],
            new Set(['A1', 'B1', 'C1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4']),
            { A1: 'Item', B1: 'Qty', C1: 'Status', A2: 'A4 Paper Ream', B2: '48', A3: 'Stapler', B3: '15', A4: 'Whiteboard Marker', B4: '8' });

        $('#m3-check').addEventListener('click', () => {
            const checks = [
                isCorrectFormula(a, 'C2', 'Late'),
                isCorrectFormula(a, 'C3', 'On time'),
                isCorrectFormula(a, 'C4', 'Late'),
                isCorrectFormula(b, 'C2', 'OK'),
                isCorrectFormula(b, 'C3', 'Reorder'),
                isCorrectFormula(b, 'C4', 'Reorder')
            ];
            const correct = checks.filter(Boolean).length;
            $('#m3-progress-text').textContent = correct + ' of 6 correct.';
            if (correct === 6) {
                feedback('#m3-feedback', true, '✅ Every IF correctly flagged late check-ins and low-stock items.');
                markModuleDone(3);
            } else {
                feedback('#m3-feedback', false, `${correct} of 6 correct so far. Remember each branch can be text in quotes, like "Late".`);
            }
        });
    })();

    // ============================================================
    //  MODULE 4 — Nested Logic: AND/OR/nested IF
    // ============================================================
    (function Module4() {
        const a = makeGridController('m4a-grid', ['A', 'B', 'C', 'D'], [1, 2, 3, 4],
            new Set(['A1', 'B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3', 'A4', 'B4', 'C4']),
            { A1: 'Invoice', B1: 'Status', C1: 'Days Past Due', D1: 'Flag', A2: 'INV-101', B2: 'Pending', C2: '5', A3: 'INV-102', B3: 'Paid', C3: '3', A4: 'INV-103', B4: 'Pending', C4: '0' });
        const b = makeGridController('m4b-grid', ['A', 'B', 'C'], [1, 2, 3, 4],
            new Set(['A1', 'B1', 'C1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4']),
            { A1: 'Employee', B1: 'Hours', C1: 'Day Type', A2: 'Farhana Akter', B2: '8', A3: 'Shakil Rahman', B3: '3', A4: 'Nusrat Jahan', B4: '6' });

        $('#m4-check').addEventListener('click', () => {
            const checks = [
                isCorrectFormula(a, 'D2', 'Overdue'),
                isCorrectFormula(a, 'D3', 'OK'),
                isCorrectFormula(a, 'D4', 'OK'),
                isCorrectFormula(b, 'C2', 'Full Day'),
                isCorrectFormula(b, 'C3', 'Half Day'),
                isCorrectFormula(b, 'C4', 'Partial')
            ];
            const correct = checks.filter(Boolean).length;
            $('#m4-progress-text').textContent = correct + ' of 6 correct.';
            if (correct === 6) {
                feedback('#m4-feedback', true, '✅ AND, and nested IF, both correctly combined conditions.');
                markModuleDone(4);
            } else {
                feedback('#m4-feedback', false, `${correct} of 6 correct so far. INV-102 is Paid, so it can't be Overdue no matter how many days past due.`);
            }
        });
    })();

    // ============================================================
    //  MODULE 5 — COUNTIF & SUMIF (attendance + invoice)
    // ============================================================
    (function Module5() {
        const a = makeGridController('m5a-grid', ['A', 'B'], [1, 2, 3, 4, 5, 6, 7],
            new Set(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5', 'B5', 'A6', 'B6', 'A7']),
            { A1: 'Employee', B1: 'Status', A2: 'Farhana Akter', B2: 'Present', A3: 'Shakil Rahman', B3: 'Late', A4: 'Nusrat Jahan', B4: 'Late', A5: 'Imran Kabir', B5: 'Absent', A6: 'Tania Sultana', B6: 'Present', A7: 'Late Count' });
        const b = makeGridController('m5b-grid', ['A', 'B', 'C'], [1, 2, 3, 4, 5, 6, 7],
            new Set(['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3', 'A4', 'B4', 'C4', 'A5', 'B5', 'C5', 'A6', 'A7']),
            { A1: 'Invoice', B1: 'Status', C1: 'Total (৳)', A2: 'INV-201', B2: 'Paid', C2: '10200', A3: 'INV-202', B3: 'Pending', C3: '7200', A4: 'INV-203', B4: 'Paid', C4: '5400', A5: 'INV-204', B5: 'Paid', C5: '15300', A6: 'Total Paid (SUMIF)', A7: 'Invoices Over ৳10,000 (COUNTIF)' });

        $('#m5-check').addEventListener('click', () => {
            const checks = [
                isCorrectFormula(a, 'B7', 2),
                isCorrectFormula(b, 'C6', 30900),
                isCorrectFormula(b, 'C7', 2)
            ];
            const correct = checks.filter(Boolean).length;
            $('#m5-progress-text').textContent = correct + ' of 3 correct.';
            if (correct === 3) {
                feedback('#m5-feedback', true, '✅ COUNTIF and SUMIF both correct — matching by text and by a numeric comparison.');
                markModuleDone(5);
            } else {
                feedback('#m5-feedback', false, `${correct} of 3 correct so far.`);
            }
        });
    })();

    // ============================================================
    //  MODULE 6 — Reading & Fixing Formula Errors
    // ============================================================
    (function Module6() {
        const a = makeGridController('m6a-grid', ['A', 'B'], [1, 2, 3, 4, 5],
            new Set(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5']),
            { A1: 'Line Item', B1: 'Amount (৳)', A2: 'Cotton fabric roll', B2: '2000', A3: 'Delivery', B3: '3000', A4: 'Packaging', B4: '1500', A5: 'Subtotal', B5: '=SUM(B2:B4' });
        const b = makeGridController('m6b-grid', ['A', 'B'], [1, 2, 3, 4],
            new Set(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4']),
            { A1: 'Day', B1: 'Hours', A2: 'Mon', B2: '8', A3: 'Tue', B3: '7.5', A4: 'Total Hours', B4: '=SUM(B10:B12)' });
        const c = makeGridController('m6c-grid', ['A', 'B'], [1, 2, 3, 4, 5],
            new Set(['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5']),
            { A1: 'Item', B1: 'Qty/Status', A2: 'A4 Paper Ream', B2: '48', A3: 'Stapler', B3: 'Discontinued', A4: 'Marker Set', B4: '30', A5: 'Combined Quantity', B5: '=B2+B3' });

        $('#m6-check').addEventListener('click', () => {
            const checks = [
                isCorrectFormula(a, 'B5', 6500),
                isCorrectFormula(b, 'B4', 15.5),
                isCorrectFormula(c, 'B5', 78)
            ];
            const correct = checks.filter(Boolean).length;
            $('#m6-progress-text').textContent = correct + ' of 3 fixed.';
            if (correct === 3) {
                feedback('#m6-feedback', true, '✅ All three fixed — a missing parenthesis, a reference pointing outside the data, and a reference pointing at the wrong cell.');
                markModuleDone(6);
            } else {
                const hints = [];
                if (!checks[0]) hints.push('Invoice Subtotal has a missing closing parenthesis.');
                if (!checks[1]) hints.push('Attendance Total Hours references rows that don\'t exist in this sheet (#REF!).');
                if (!checks[2]) hints.push('Inventory Combined Quantity adds a text status cell instead of a quantity (#VALUE!).');
                feedback('#m6-feedback', false, `${correct} of 3 fixed. ` + hints.join(' '));
            }
        });
    })();

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        renderRail();
        const firstIncomplete = MODULES.find(m => !progress.moduleDone[m.n]);
        goToModule(firstIncomplete ? firstIncomplete.n : 6);
        if (progress.allDone()) $('#lessonStampBanner').classList.add('show');

        if (!session) {
            showToast('You’re not signed in — progress here won’t be saved to a passport. Sign in from the home page first.', 'error');
        } else if (!progress.isLessonComplete('spreadsheet-mastery-lesson1')) {
            showToast('Tip: Lesson 1 covers the basics this lesson builds on.', '');
        } else if (firstIncomplete && firstIncomplete.n > 1) {
            showToast('Welcome back — resuming at Module ' + firstIncomplete.n + '.', 'success');
        }
    }

    init();
})();

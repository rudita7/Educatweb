(function () {
    "use strict";

    const cellModel = window.SM.cellModel;
    const formulaEngine = window.SM.formulaEngine;
    const fillEngine = window.SM.fillEngine;
    const kit = window.SM.lessonKit;

    const {
        $, $$, showToast, feedback, resetFeedback, escapeHtml,
        renderGrid, focusCell, bindGridEvents, guardedRender,
        UndoStack
    } = kit;

    const LESSON_ID = 'spreadsheet-mastery-lesson1';
    const MODULE_NUMBERS = [1, 2, 3, 4, 5];
    const progress = kit.createProgress(LESSON_ID, MODULE_NUMBERS);
    const session = progress.session;

    // ============================================================
    //  MODULE RAIL
    // ============================================================
    const MODULES = [
        { n: 1, label: 'Navigate' },
        { n: 2, label: 'Enter Data' },
        { n: 3, label: 'Arithmetic' },
        { n: 4, label: 'References' },
        { n: 5, label: 'Fill Down' }
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
    //  MODULE 1 — Navigating the Grid
    // ============================================================
    (function Module1() {
        const cols = ['A', 'B', 'C', 'D'];
        const rows = [1, 2, 3, 4, 5];
        const readonly = new Set(['A1', 'B1', 'C1', 'D1']);
        const grid = cellModel.createGrid(cols, rows);
        let computed = {};
        let selected = 'A1';

        const seed = {
            A1: 'Item', B1: 'SKU', C1: 'Qty', D1: 'Location',
            A2: 'A4 Paper Ream', B2: 'STA-4402', C2: '48', D2: 'Shelf B3',
            A3: 'Stapler', B3: 'STA-1090', C3: '15', D3: 'Shelf B3',
            A4: 'Marker Set', B4: 'STA-2210', C4: '30', D4: 'Shelf C1',
            A5: 'Envelope Box', B5: 'STA-3305', C5: '60', D5: 'Shelf A2'
        };
        Object.keys(seed).forEach(id => cellModel.setRaw(grid, id, seed[id]));

        const state = { clickedB1: false, arrowReachedD4: false, typedAndEnteredD4: false };

        let rendering = false;
        function recomputeAndRender() {
            // Guards against reentrancy: replacing a focused input's
            // innerHTML makes the browser fire a synchronous native
            // "blur" on it mid-removal, which re-enters this function
            // via commit() before the first call has finished -- without
            // this guard that throws "node is no longer a child of this
            // node" from the browser's own DOM removal.
            if (rendering) return;
            rendering = true;
            try {
                computed = cellModel.recomputeGrid(grid, formulaEngine);
                renderGrid('m1-grid', grid, computed, cols, rows, { readonly, selected });
                bindGridEvents('m1-grid', cols, rows, ctx);
                focusCell('m1-grid', selected);
                updateProgressText();
            } finally { rendering = false; }
        }

        function updateProgressText() {
            const done = (state.clickedB1 && state.arrowReachedD4 ? 1 : 0) + (state.typedAndEnteredD4 ? 1 : 0);
            $('#m1-progress-text').textContent = done + ' of 2 done.';
        }

        const ctx = {
            setSelected(id) {
                if (id === 'B1') state.clickedB1 = true;
                selected = id;
                renderSelectionOnly();
            },
            commit(id, val) {
                if (cellModel.getRaw(grid, id) === val) { recomputeAndRender(); return; }
                cellModel.setRaw(grid, id, val);
                recomputeAndRender();
            },
            onNavigate(fromId, toId, method) {
                if (method === 'arrow' && toId === 'D4' && state.clickedB1) state.arrowReachedD4 = true;
                if (method === 'enter' && fromId === 'D4') {
                    const val = $('#m1-grid input[data-cell="D4"]').value;
                    if (val.trim() === '999') state.typedAndEnteredD4 = true;
                }
            }
        };

        function renderSelectionOnly() {
            $$('#m1-grid td').forEach(td => td.classList.toggle('selected-cell', td.dataset.cell === selected));
            updateProgressText();
        }

        $('#m1-instruction').innerHTML =
            `<strong>Try this:</strong> 1) Click cell <span class="mono">B1</span>. 2) Using only your arrow keys — no mouse — move to cell <span class="mono">D4</span>. 3) Type <span class="mono">999</span> and press <span class="mono">Enter</span> to confirm the entry and move down to <span class="mono">D5</span>.`;

        $('#m1-check').addEventListener('click', () => {
            if (state.clickedB1 && state.arrowReachedD4 && state.typedAndEnteredD4) {
                feedback('#m1-feedback', true, '✅ You navigated the grid with clicks, arrow keys, and Enter-to-confirm — exactly how a real spreadsheet works.');
                markModuleDone(1);
            } else {
                const missing = [];
                if (!(state.clickedB1 && state.arrowReachedD4)) missing.push('reach D4 using the arrow keys after clicking B1');
                if (!state.typedAndEnteredD4) missing.push('type 999 into D4 and press Enter to confirm it');
                feedback('#m1-feedback', false, 'Not yet — still need to: ' + missing.join('; ') + '.');
            }
        });

        $('#m1-reset').addEventListener('click', () => {
            Object.keys(seed).forEach(id => cellModel.setRaw(grid, id, seed[id]));
            state.clickedB1 = false; state.arrowReachedD4 = false; state.typedAndEnteredD4 = false;
            selected = 'A1';
            resetFeedback('#m1-feedback');
            recomputeAndRender();
        });

        window.__sm_initModule1 = recomputeAndRender;
    })();

    // ============================================================
    //  MODULE 2 — Entering & Editing Data
    // ============================================================
    (function Module2() {
        const cols = ['A', 'B', 'C'];
        const rows = [1, 2, 3, 4];
        const readonly = new Set(['A1', 'B1', 'C1', 'A2', 'A3', 'A4']);
        const grid = cellModel.createGrid(cols, rows);
        let computed = {};
        let selected = 'B2';
        const stack = new UndoStack();

        const TODAY = '2026-07-15';
        const EXPECTED = { B2: TODAY, C2: '09:15', B3: TODAY, C3: '08:58', B4: TODAY, C4: '09:30' };
        const seed = {
            A1: 'Name', B1: 'Date', C1: 'Check-in',
            A2: 'Farhana Akter', B2: '', C2: '08:45',
            A3: 'Shakil Rahman', B3: '', C3: '',
            A4: 'Nusrat Jahan', B4: '', C4: ''
        };
        Object.keys(seed).forEach(id => cellModel.setRaw(grid, id, seed[id]));

        const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
        const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
        function validator(id) {
            if (id.charAt(0) === 'B') return { test: v => DATE_RE.test(v.trim()) && !isNaN(Date.parse(v.trim())), hint: 'Use YYYY-MM-DD, e.g. 2026-07-15.' };
            if (id.charAt(0) === 'C') return { test: v => TIME_RE.test(v.trim()), hint: 'Use 24-hour HH:MM, e.g. 09:15.' };
            return null;
        }

        let rendering = false;
        function recomputeAndRender() {
            if (rendering) return;
            rendering = true;
            try {
                computed = cellModel.recomputeGrid(grid, formulaEngine);
                renderGrid('m2-grid', grid, computed, cols, rows, { readonly, selected });
                bindGridEvents('m2-grid', cols, rows, ctx);
                focusCell('m2-grid', selected);
                renderHints();
                $('#m2-undo').disabled = !stack.canUndo();
                $('#m2-redo').disabled = !stack.canRedo();
            } finally { rendering = false; }
        }

        function renderHints() {
            $$('#m2-grid input[data-cell]').forEach(inp => {
                const id = inp.dataset.cell;
                const rule = validator(id);
                if (!rule) return;
                const val = inp.value.trim();
                const valid = val === '' || rule.test(val);
                inp.classList.toggle('cell-error', !valid);
            });
        }

        const ctx = {
            setSelected(id) { selected = id; $$('#m2-grid td').forEach(td => td.classList.toggle('selected-cell', td.dataset.cell === id)); },
            commit(id, val) {
                const prev = cellModel.getRaw(grid, id);
                if (prev === val) { recomputeAndRender(); return; }
                stack.do({
                    label: id,
                    do() { cellModel.setRaw(grid, id, val); },
                    undo() { cellModel.setRaw(grid, id, prev); }
                });
                recomputeAndRender();
            },
            onNavigate() {}
        };

        $('#m2-call').innerHTML =
            `<strong>📞 Front desk says:</strong> "Today is <span class="mono">${TODAY}</span>. Farhana checked in at <span class="mono">09:15</span> — I think I logged the wrong time earlier, please fix it. Shakil checked in at <span class="mono">08:58</span>. Nusrat checked in at <span class="mono">09:30</span>." Fill in every Date cell, and make sure every Check-in time matches exactly.`;

        $('#m2-check').addEventListener('click', () => {
            const cells = Object.keys(EXPECTED);
            const invalid = cells.filter(id => { const rule = validator(id); return rule && !rule.test(String(cellModel.getRaw(grid, id)).trim()); });
            if (invalid.length) {
                feedback('#m2-feedback', false, 'Fix the highlighted field(s) first: ' + invalid.join(', ') + '.');
                return;
            }
            const wrong = cells.filter(id => String(cellModel.getRaw(grid, id)).trim() !== EXPECTED[id]);
            if (wrong.length === 0) {
                feedback('#m2-feedback', true, '✅ Every date and check-in time matches the memo — including the one you had to overwrite.');
                markModuleDone(2);
            } else {
                feedback('#m2-feedback', false, `${cells.length - wrong.length} of ${cells.length} correct — re-check: ${wrong.join(', ')}.`);
            }
        });

        $('#m2-undo').addEventListener('click', () => { stack.undo(); recomputeAndRender(); });
        $('#m2-redo').addEventListener('click', () => { stack.redo(); recomputeAndRender(); });

        window.__sm_initModule2 = recomputeAndRender;
    })();

    // ============================================================
    //  MODULE 3 — Basic Arithmetic Formulas
    // ============================================================
    (function Module3() {
        const cols = ['A', 'B', 'C', 'D', 'E'];
        const rows = [1, 2, 3];
        const readonly = new Set(['A1', 'B1', 'C1', 'D1', 'E1', 'A2', 'B2', 'A3', 'B3']);
        const grid = cellModel.createGrid(cols, rows);
        let computed = {};
        let selected = 'C2';

        const seed = {
            A1: 'Qty', B1: 'Unit Price', C1: 'Subtotal', D1: 'Tax (5%)', E1: 'Total',
            A2: '12', B2: '850', A3: '6', B3: '1200'
        };
        Object.keys(seed).forEach(id => cellModel.setRaw(grid, id, seed[id]));

        const TARGET_CELLS = ['C2', 'D2', 'E2', 'C3', 'D3', 'E3'];
        function expected() {
            const c2 = 12 * 850, c3 = 6 * 1200;
            return { C2: c2, D2: c2 * 0.05, E2: c2 * 1.05, C3: c3, D3: c3 * 0.05, E3: c3 * 1.05 };
        }

        let rendering = false;
        function recomputeAndRender() {
            if (rendering) return;
            rendering = true;
            try {
                computed = cellModel.recomputeGrid(grid, formulaEngine);
                renderGrid('m3-grid', grid, computed, cols, rows, { readonly, selected });
                bindGridEvents('m3-grid', cols, rows, ctx);
                focusCell('m3-grid', selected);
                syncFormulaBar();
                updateProgress();
            } finally { rendering = false; }
        }

        function syncFormulaBar() {
            $('#m3-cell-tag').textContent = selected;
            $('#m3-formula-bar').value = cellModel.getRaw(grid, selected);
        }

        function updateProgress() {
            const exp = expected();
            const correct = TARGET_CELLS.filter(id => {
                const raw = cellModel.getRaw(grid, id);
                if (!raw || raw.charAt(0) !== '=') return false;
                const v = computed[id];
                return typeof v === 'number' && Math.abs(v - exp[id]) < 0.01;
            }).length;
            $('#m3-progress-text').textContent = correct + ' of 6 formulas correct.';
        }

        const ctx = {
            setSelected(id) { selected = id; $$('#m3-grid td').forEach(td => td.classList.toggle('selected-cell', td.dataset.cell === id)); syncFormulaBar(); },
            commit(id, val) {
                if (cellModel.getRaw(grid, id) === val) { recomputeAndRender(); return; }
                cellModel.setRaw(grid, id, val);
                recomputeAndRender();
            },
            onNavigate() {}
        };

        $('#m3-formula-bar').addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            if (readonly.has(selected)) return;
            cellModel.setRaw(grid, selected, e.target.value);
            recomputeAndRender();
        });

        $('#m3-instruction').innerHTML =
            `Fill in <span class="mono">C2:E3</span> using arithmetic formulas — no named functions yet, just <span class="mono">+ − × ÷</span> directly on cell references. <strong>Subtotal</strong> = Qty × Unit Price. <strong>Tax</strong> = Subtotal × 0.05. <strong>Total</strong> = Subtotal + Tax. Try <span class="mono">=A2*B2</span> in C2 to start.`;

        $('#m3-check').addEventListener('click', () => {
            const exp = expected();
            const results = TARGET_CELLS.map(id => {
                const raw = cellModel.getRaw(grid, id);
                const isFormula = raw && raw.charAt(0) === '=';
                const v = computed[id];
                const ok = isFormula && typeof v === 'number' && Math.abs(v - exp[id]) < 0.01;
                return { id, ok, isFormula };
            });
            const wrong = results.filter(r => !r.ok);
            if (wrong.length === 0) {
                feedback('#m3-feedback', true, '✅ All six formulas are correct — you just calculated an invoice by hand, with cell references instead of numbers.');
                markModuleDone(3);
            } else {
                const notFormula = wrong.filter(r => !r.isFormula).map(r => r.id);
                let msg = `${results.length - wrong.length} of ${results.length} correct.`;
                if (notFormula.length) msg += ` ${notFormula.join(', ')} need an actual formula starting with "=", not a typed-in number.`;
                else msg += ` Re-check: ${wrong.map(r => r.id).join(', ')}.`;
                feedback('#m3-feedback', false, msg);
            }
        });

        window.__sm_initModule3 = recomputeAndRender;
    })();

    // ============================================================
    //  MODULE 4 — Relative vs. Absolute References
    // ============================================================
    (function Module4() {
        const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
        const rows = [1, 2, 3];
        const readonly = new Set(['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3']);
        const grid = cellModel.createGrid(cols, rows);
        let computed = {};
        let selected = 'D2';
        let step = 1;

        const seed = {
            A1: 'Qty', B1: 'Unit Price', C1: 'Subtotal', D1: 'Tax', E1: 'Tax Rate:', F1: '0.05',
            A2: '12', B2: '850', C2: '10200',
            A3: '6', B3: '1200', C3: '7200'
        };
        Object.keys(seed).forEach(id => cellModel.setRaw(grid, id, seed[id]));

        let rendering = false;
        function recomputeAndRender() {
            if (rendering) return;
            rendering = true;
            try {
                computed = cellModel.recomputeGrid(grid, formulaEngine);
                renderGrid('m4-grid', grid, computed, cols, rows, { readonly, selected });
                bindGridEvents('m4-grid', cols, rows, ctx);
                focusCell('m4-grid', selected);
                syncFormulaBar();
            } finally { rendering = false; }
        }
        function syncFormulaBar() {
            $('#m4-cell-tag').textContent = selected;
            $('#m4-formula-bar').value = cellModel.getRaw(grid, selected);
        }
        const ctx = {
            setSelected(id) { selected = id; $$('#m4-grid td').forEach(td => td.classList.toggle('selected-cell', td.dataset.cell === id)); syncFormulaBar(); },
            commit(id, val) {
                if (cellModel.getRaw(grid, id) === val) { recomputeAndRender(); return; }
                cellModel.setRaw(grid, id, val);
                recomputeAndRender();
            },
            onNavigate() {}
        };
        $('#m4-formula-bar').addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || readonly.has(selected)) return;
            cellModel.setRaw(grid, selected, e.target.value);
            recomputeAndRender();
        });

        function d2Valid() {
            const raw = (cellModel.getRaw(grid, 'D2') || '').toUpperCase().replace(/\s+/g, '');
            const hasAbsolute = /\$F\$1/.test(raw);
            const hasRelative = /(^|[^$A-Z])C2([^0-9]|$)/.test(raw) && !/\$C\$2/.test(raw);
            const v = computed.D2;
            const valueOk = typeof v === 'number' && Math.abs(v - 510) < 0.01;
            return raw.charAt(0) === '=' && hasAbsolute && hasRelative && valueOk;
        }

        function updateStepUI() {
            $('#m4-progress-text').textContent = 'Step ' + step + ' of 2';
            $('#m4-instruction').innerHTML = step === 1
                ? `<strong>Step 1:</strong> In <span class="mono">D2</span>, write a formula for this line's tax: Subtotal (<span class="mono">C2</span>) × Tax Rate — reference <span class="mono">F1</span>, but lock it with <span class="mono">$</span> so it stays put if the formula is ever copied. Try <span class="mono">=C2*$F$1</span>.`
                : `<strong>Step 2:</strong> If you copied that exact D2 formula down to row 3, what would it become? Don't just calculate the number — type the resulting <em>formula</em> directly into <span class="mono">D3</span> yourself.`;
            $('#m4-why').innerHTML = step === 1
                ? `<strong>Why it matters:</strong> if you'd written <span class="mono">=C2*F1</span> (no $) and later copied it down, row 3's formula would try to read F2 instead of F1 — an empty cell — and the tax would come out wrong or zero.`
                : `<strong>Hint:</strong> the relative part (<span class="mono">C2</span>) should move to match row 3. The absolute part (<span class="mono">$F$1</span>) should not move at all.`;
        }

        $('#m4-check').addEventListener('click', () => {
            if (step === 1) {
                if (d2Valid()) {
                    feedback('#m4-feedback', true, '✅ D2 correctly locks F1 with $ while letting C2 stay relative.');
                    step = 2;
                    updateStepUI();
                    resetFeedback('#m4-feedback');
                    selected = 'D3';
                    recomputeAndRender();
                } else {
                    feedback('#m4-feedback', false, 'Not quite — D2 needs to multiply C2 (relative) by F1 locked with $ signs, and equal 510.');
                }
            } else {
                const d2Raw = cellModel.getRaw(grid, 'D2');
                const expectedD3 = fillEngine.fillRange('D2', d2Raw, ['D3']).D3;
                const norm = s => String(s || '').toUpperCase().replace(/\s+/g, '');
                if (norm(cellModel.getRaw(grid, 'D3')) === norm(expectedD3)) {
                    feedback('#m4-feedback', true, '✅ Exactly right — that\'s precisely what AutoFill does automatically, which is what Module 5 is about.');
                    markModuleDone(4);
                } else {
                    feedback('#m4-feedback', false, `Not quite — the relative reference (C2) should become C3, but $F$1 should stay exactly as it was.`);
                }
            }
        });

        updateStepUI();
        window.__sm_initModule4 = recomputeAndRender;
    })();

    // ============================================================
    //  MODULE 5 — AutoFill / Fill-Down
    // ============================================================
    (function Module5() {
        const cols = ['A', 'B', 'C', 'D', 'E'];
        const rows = [1, 2, 3, 4, 5, 6];
        const readonly = new Set(['A1', 'B1', 'C1', 'D1', 'E1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4', 'A5', 'B5', 'A6', 'B6']);
        const grid = cellModel.createGrid(cols, rows);
        let computed = {};
        let selected = 'C2';
        let fillPreview = new Set();

        const seed = {
            A1: 'Item', B1: 'Qty Received', C1: 'Above Buffer', D1: 'Reorder Buffer:', E1: '10',
            A2: 'A4 Paper Ream', B2: '48',
            A3: 'Stapler', B3: '15',
            A4: 'Marker Set', B4: '30',
            A5: 'Envelope Box', B5: '60',
            A6: 'Whiteboard Marker', B6: '8'
        };
        Object.keys(seed).forEach(id => cellModel.setRaw(grid, id, seed[id]));

        let rendering = false;
        function recomputeAndRender() {
            if (rendering) return;
            rendering = true;
            try {
            computed = cellModel.recomputeGrid(grid, formulaEngine);
            renderGrid('m5-grid', grid, computed, cols, rows, {
                readonly, selected, fillPreview,
                fillHandleCell: (selected === 'C2' && !readonly.has('C2') && (cellModel.getRaw(grid, 'C2') || '').charAt(0) === '=') ? 'C2' : null
            });
            bindGridEvents('m5-grid', cols, rows, ctx);
            focusCell('m5-grid', selected);
            syncFormulaBar();
            bindFillHandle();
            updateFillControls();
            } finally { rendering = false; }
        }
        function syncFormulaBar() {
            $('#m5-cell-tag').textContent = selected;
            $('#m5-formula-bar').value = cellModel.getRaw(grid, selected);
        }
        const ctx = {
            setSelected(id) { selected = id; fillPreview = new Set(); $$('#m5-grid td').forEach(td => td.classList.toggle('selected-cell', td.dataset.cell === id)); syncFormulaBar(); recomputeAndRender(); },
            commit(id, val) {
                if (cellModel.getRaw(grid, id) === val) { recomputeAndRender(); return; }
                cellModel.setRaw(grid, id, val);
                recomputeAndRender();
            },
            onNavigate() {}
        };
        $('#m5-formula-bar').addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || readonly.has(selected)) return;
            cellModel.setRaw(grid, selected, e.target.value);
            recomputeAndRender();
        });

        function updateFillControls() {
            const select = $('#m5-fill-target');
            if (!select.options.length) {
                ['3', '4', '5', '6'].forEach(r => { const o = document.createElement('option'); o.value = 'C' + r; o.textContent = 'row ' + r; select.appendChild(o); });
                select.value = 'C6';
            }
            const c2Raw = cellModel.getRaw(grid, 'C2');
            $('#m5-fill-btn').disabled = !(c2Raw && c2Raw.charAt(0) === '=');
        }

        function applyFill(targetRow) {
            const c2Raw = cellModel.getRaw(grid, 'C2');
            if (!c2Raw || c2Raw.charAt(0) !== '=') { showToast('Write a formula in C2 first.', 'error'); return; }
            const targets = [];
            for (let r = 3; r <= targetRow; r++) targets.push('C' + r);
            const filled = fillEngine.fillRange('C2', c2Raw, targets);
            targets.forEach(id => cellModel.setRaw(grid, id, filled[id]));
            recomputeAndRender();
            showToast('Filled down to row ' + targetRow + '.', 'success');
        }

        $('#m5-fill-btn').addEventListener('click', () => {
            const targetRow = parseInt($('#m5-fill-target').value.replace('C', ''), 10);
            applyFill(targetRow);
        });

        // Draggable fill handle: works with mouse, touch, and pen via
        // Pointer Events. The button above is the fully accessible
        // fallback -- this is a tactile enhancement on top of it.
        function bindFillHandle() {
            const handle = $('#m5-grid [data-handle="C2"]');
            if (!handle) return;
            let dragging = false;
            handle.addEventListener('pointerdown', (e) => {
                dragging = true;
                handle.setPointerCapture(e.pointerId);
                e.preventDefault();
            });
            handle.addEventListener('pointermove', (e) => {
                if (!dragging) return;
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const td = el && el.closest ? el.closest('[data-cell]') : null;
                if (!td) return;
                const m = /^C([3-6])$/.exec(td.dataset.cell);
                if (!m) return;
                const endRow = parseInt(m[1], 10);
                fillPreview = new Set();
                for (let r = 3; r <= endRow; r++) fillPreview.add('C' + r);
                $$('#m5-grid td').forEach(cell => cell.classList.toggle('fill-preview', fillPreview.has(cell.dataset.cell)));
            });
            handle.addEventListener('pointerup', (e) => {
                if (!dragging) return;
                dragging = false;
                if (fillPreview.size) {
                    const endRow = Math.max.apply(null, Array.from(fillPreview).map(id => parseInt(id.slice(1), 10)));
                    fillPreview = new Set();
                    applyFill(endRow);
                } else {
                    fillPreview = new Set();
                    recomputeAndRender();
                }
            });
        }

        $('#m5-instruction').innerHTML =
            `In <span class="mono">C2</span>, write a formula that subtracts the Reorder Buffer (<span class="mono">E1</span>, locked with $) from Qty Received (<span class="mono">B2</span>): <span class="mono">=B2-$E$1</span>. Then fill it down through row 6.`;

        $('#m5-check').addEventListener('click', () => {
            const rowsToCheck = [2, 3, 4, 5, 6];
            const bad = [];
            rowsToCheck.forEach(r => {
                const id = 'C' + r;
                const raw = (cellModel.getRaw(grid, id) || '').toUpperCase().replace(/\s+/g, '');
                const hasAbsolute = /\$E\$1/.test(raw);
                const hasRelative = raw.indexOf('B' + r) !== -1 && raw.indexOf('$B$' + r) === -1;
                const v = computed[id];
                const expectedVal = Number(seed['B' + r]) - Number(seed.E1);
                const valueOk = typeof v === 'number' && Math.abs(v - expectedVal) < 0.01;
                if (!(raw.charAt(0) === '=' && hasAbsolute && hasRelative && valueOk)) bad.push(id);
            });
            if (bad.length === 0) {
                feedback('#m5-feedback', true, '✅ Every row correctly kept $E$1 fixed while the relative reference moved down with it — that\'s AutoFill.');
                markModuleDone(5);
            } else {
                feedback('#m5-feedback', false, `Check these cells: ${bad.join(', ')}. Each should reference its own row's Qty Received and the same locked $E$1.`);
            }
        });

        window.__sm_initModule5 = recomputeAndRender;
    })();

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        renderRail();
        window.__sm_initModule1();
        window.__sm_initModule2();
        window.__sm_initModule3();
        window.__sm_initModule4();
        window.__sm_initModule5();

        const firstIncomplete = MODULES.find(m => !progress.moduleDone[m.n]);
        goToModule(firstIncomplete ? firstIncomplete.n : 5);
        if (progress.allDone()) $('#lessonStampBanner').classList.add('show');

        if (!session) {
            showToast('You’re not signed in — progress here won’t be saved to a passport. Sign in from the home page first.', 'error');
        } else if (firstIncomplete && firstIncomplete.n > 1) {
            showToast('Welcome back — resuming at Module ' + firstIncomplete.n + '.', 'success');
        }
    }

    init();
})();

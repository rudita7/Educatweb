/* Shared lesson kit for the Spreadsheet Mastery track (Lessons 1-4).
   Extracted from Lesson 1 after real interaction bugs were found and
   fixed there (see bindGridEvents' userEdited guard and the render
   reentrancy guard pattern each lesson repeats) -- every lesson reuses
   this exact, already-debugged code instead of re-deriving it and
   risking the same bugs again.
   UMD-wrapped: <script src> global (window.SM.lessonKit) and require()
   in Node (grid-rendering pieces need `document`/`localStorage` and are
   browser-only in practice, but the module loads fine in Node so a
   lesson's own engine-adjacent logic can still be unit tested there). */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SM = root.SM || {};
        root.SM.lessonKit = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    "use strict";

    // ============================================================
    //  STORAGE — same schema as webapp/index1.html, so a stamp earned
    //  in any lesson shows up on the Skills Passport dashboard.
    // ============================================================
    const Storage = {
        get(key) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } },
        set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } }
    };

    function loadSession() {
        const data = Storage.get('uttoron:session');
        if (data && data.num) {
            const user = Storage.get('user:' + data.num);
            if (user) return { num: data.num, nickname: user.nickname };
        }
        return null;
    }

    /* createProgress(lessonId, moduleNumbers) -- per-module completion,
       persisted and gated, fixing the same checkProgress() bug class
       Lesson 1 fixed (build spec: "returning learners actually resume
       correctly"). Module N unlocks once module N-1 is done (or N is
       already done, so completed learners can always revisit). */
    function createProgress(lessonId, moduleNumbers) {
        const session = loadSession();
        const moduleDone = {};
        moduleNumbers.forEach(n => { moduleDone[n] = false; });

        function stateKey() { return 'lessonModuleState:' + lessonId + ':' + (session ? session.num : 'guest'); }
        (function restore() {
            const saved = Storage.get(stateKey());
            if (saved && saved.moduleDone) moduleNumbers.forEach(n => { moduleDone[n] = !!saved.moduleDone[n]; });
        })();
        function persist() { Storage.set(stateKey(), { moduleDone }); }

        function isUnlocked(n) {
            const idx = moduleNumbers.indexOf(n);
            if (idx <= 0) return true;
            return !!moduleDone[moduleNumbers[idx - 1]] || !!moduleDone[n];
        }
        function firstIncomplete() { return moduleNumbers.find(n => !moduleDone[n]); }
        function allDone() { return moduleNumbers.every(n => moduleDone[n]); }

        function markModuleDone(n) {
            if (moduleDone[n]) return false;
            moduleDone[n] = true;
            persist();
            return true;
        }

        // Also records completion on the *previous* lesson's own
        // progress key so Lesson N+1's entry page can check "has the
        // learner finished Lesson N" without re-deriving module state.
        function awardStampIfComplete() {
            if (!allDone()) return false;
            if (session) {
                const progress = Storage.get('progress:' + session.num) || {};
                progress[lessonId] = true;
                Storage.set('progress:' + session.num, progress);
            }
            return true;
        }

        function isLessonComplete(otherLessonId) {
            if (!session) return false;
            const progress = Storage.get('progress:' + session.num) || {};
            return !!progress[otherLessonId];
        }

        return { session, moduleDone, isUnlocked, firstIncomplete, allDone, markModuleDone, awardStampIfComplete, isLessonComplete };
    }

    // ============================================================
    //  RECORD DOMAINS (build spec §2.1) — same field names/shape
    //  across every lesson (and matching Track 3's shared record
    //  factories), so a learner recognizes the same record shapes
    //  deepen in complexity as they progress. Shared once here rather
    //  than duplicated per lesson file, since all four Spreadsheet
    //  Mastery lessons live in this same track and folder.
    // ============================================================
    const Records = {
        attendance(overrides) {
            return Object.assign({
                id: 'ATT-2201', employeeId: 'EMP-108', employeeName: 'Shakil Rahman',
                date: '2026-07-06', checkIn: '09:02', checkOut: '17:10', status: 'Present'
            }, overrides || {});
        },
        invoice(overrides) {
            return Object.assign({
                id: 'INV-5560', customerId: 'CUS-302', customerName: 'Bay Textiles Ltd.',
                invoiceDate: '2026-07-01', lineItems: [{ description: 'Cotton fabric roll', qty: 12, unitPrice: 850 }],
                total: 10200, status: 'Pending'
            }, overrides || {});
        },
        inventory(overrides) {
            return Object.assign({
                id: 'INVT-771', itemName: 'A4 Paper Ream', sku: 'STA-4402',
                quantity: 48, lastUpdated: '2026-07-04', location: 'Shelf B3'
            }, overrides || {});
        },
        CUSTOMERS: [
            { customerId: 'CUS-301', name: 'Green Valley Traders' },
            { customerId: 'CUS-302', name: 'Bay Textiles Ltd.' },
            { customerId: 'CUS-303', name: 'Dhanmondi Hardware' },
            { customerId: 'CUS-304', name: 'Sundarban Foods' }
        ]
    };

    // ============================================================
    //  DOM HELPERS + TOAST + FEEDBACK
    // ============================================================
    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    let toastTimer = null;
    function showToast(msg, type) {
        const el = $('#toast');
        if (!el) return;
        el.textContent = msg;
        el.className = 'toast show ' + (type || '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
    }

    function feedback(sel, ok, html) {
        const el = $(sel);
        el.className = 'feedback show ' + (ok ? 'ok' : 'error');
        el.innerHTML = html;
    }
    function resetFeedback(sel) { $(sel).className = 'feedback'; }

    function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

    // ============================================================
    //  GRID UI — render / navigation / event-binding helpers used by
    //  every module's grid across every lesson. Each module owns its
    //  own grid state (via cellModel) and wires these generically;
    //  grading logic stays local to each module.
    // ============================================================
    function renderGrid(containerId, grid, computed, cols, rows, opts) {
        opts = opts || {};
        const readonly = opts.readonly || new Set();
        const selected = opts.selected;
        const selectedRange = opts.selectedRange || null; // optional Set<cellId>, Lesson 4 multi-cell formatting
        const fillPreview = opts.fillPreview || new Set();
        const fillHandleCell = opts.fillHandleCell;
        const formatter = opts.formatter; // optional (cellId, rawValue) => displayValue, for Lesson 4 formatting
        let html = '<table><tr><th class="row-head"></th>';
        cols.forEach(c => { html += `<th>${c}</th>`; });
        html += '</tr>';
        rows.forEach(r => {
            html += `<tr><th class="row-head mono">${r}</th>`;
            cols.forEach(c => {
                const id = c + r;
                const isRO = readonly.has(id);
                const val = computed[id];
                const isError = typeof val === 'string' && val.charAt(0) === '#';
                let display = (val === undefined || val === '') ? '' : val;
                if (!isError && formatter) display = formatter(id, display);
                const cellStyle = (opts.styleFor && opts.styleFor(id)) || {};
                const classes = [];
                if (selected === id || (selectedRange && selectedRange.has(id))) classes.push('selected-cell');
                if (fillPreview.has(id)) classes.push('fill-preview');
                if (cellStyle.fill) classes.push('fill-' + cellStyle.fill);
                const inputStyle = cellStyle.bold ? 'font-weight:700;' : '';
                html += `<td class="${classes.join(' ')}" data-cell="${id}">`;
                html += `<input type="text" data-cell="${id}" value="${escapeHtml(display)}" ${isRO ? 'readonly' : ''} style="${inputStyle}" class="${isRO ? 'readonly-cell' : ''} ${isError ? 'cell-error' : ''}" autocomplete="off" spellcheck="false" />`;
                if (fillHandleCell === id) html += `<div class="fill-handle" data-handle="${id}" title="Drag down to fill"></div>`;
                html += `</td>`;
            });
            html += '</tr>';
        });
        html += '</table>';
        $('#' + containerId).innerHTML = html;
    }

    /* renderDataTable(containerId, rows, columns, opts) -- for Lesson 3's
       sort/filter modules (spec §2.5: "operate over an array of row
       objects, not raw grid cells") and any later module presenting
       record data rather than A1-style cells.
       columns: [{ key, label, sortable?, render?(row)=>htmlString }]
       opts: { sortKeys: [{key,dir}], onHeaderClick(key), rowClass(row) } */
    function renderDataTable(containerId, rows, columns, opts) {
        opts = opts || {};
        const sortKeys = opts.sortKeys || [];
        const sortIndex = {};
        sortKeys.forEach((sk, i) => { sortIndex[sk.key] = { dir: sk.dir, priority: i + 1 }; });

        let html = '<div class="data-table-wrap"><table class="data-table"><thead><tr>';
        columns.forEach(col => {
            const sortable = col.sortable !== false;
            const info = sortIndex[col.key];
            const arrow = info ? (info.dir === 'desc' ? '▼' : '▲') + (sortKeys.length > 1 ? '<sup>' + info.priority + '</sup>' : '') : '';
            html += `<th class="${sortable ? 'sortable' : ''}" data-sort-key="${col.key}">${escapeHtml(col.label)}${arrow ? ' <span class="sort-arrow">' + arrow + '</span>' : ''}</th>`;
        });
        html += '</tr></thead><tbody>';
        if (!rows.length) {
            html += `<tr><td colspan="${columns.length}" style="text-align:center;color:var(--ink-faint);padding:18px;">No records match.</td></tr>`;
        }
        rows.forEach(row => {
            const rowClass = (opts.rowClass && opts.rowClass(row)) || '';
            html += `<tr class="${rowClass}">`;
            columns.forEach(col => {
                const content = col.render ? col.render(row) : escapeHtml(row[col.key] == null ? '' : row[col.key]);
                html += `<td class="${col.mono ? 'mono' : ''}">${content}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        $('#' + containerId).innerHTML = html;

        if (opts.onHeaderClick) {
            $$('#' + containerId + ' th.sortable').forEach(th => {
                th.addEventListener('click', (e) => opts.onHeaderClick(th.dataset.sortKey, e.shiftKey));
            });
        }
    }

    // Set synchronously around every *programmatic* focusCell() call so
    // the raw-on-focus listener below (bindGridEvents) can tell "render
    // is restoring focus to the still-selected cell" apart from "the
    // user genuinely just clicked/tabbed into this cell". Without this,
    // a render that re-focuses the same cell it already had focus on
    // (e.g. after clicking "Check my work" right after typing a formula,
    // which blurs-and-commits without moving `selected` elsewhere) would
    // immediately swap that cell's display back to its raw formula the
    // instant the render finished -- confusing, though not a data bug,
    // since focus() dispatches its "focus" event synchronously.
    let suppressFocusSwap = false;
    function focusCell(containerId, id) {
        const el = $('#' + containerId + ' input[data-cell="' + id + '"]');
        if (el && !el.disabled) {
            suppressFocusSwap = true;
            el.focus();
            if (el.select) el.select();
            suppressFocusSwap = false;
        }
    }

    function nextCellByArrow(id, key, cols, rows) {
        const m = /^([A-Za-z]+)([0-9]+)$/.exec(id);
        if (!m) return id;
        let ci = cols.indexOf(m[1]), ri = rows.indexOf(parseInt(m[2], 10));
        if (ci === -1 || ri === -1) return id;
        if (key === 'ArrowUp') ri = Math.max(0, ri - 1);
        else if (key === 'ArrowDown') ri = Math.min(rows.length - 1, ri + 1);
        else if (key === 'ArrowLeft') ci = Math.max(0, ci - 1);
        else if (key === 'ArrowRight') ci = Math.min(cols.length - 1, ci + 1);
        return cols[ci] + rows[ri];
    }
    function nextCellByTab(id, cols, rows, shift) {
        const m = /^([A-Za-z]+)([0-9]+)$/.exec(id);
        let ci = cols.indexOf(m[1]), ri = rows.indexOf(parseInt(m[2], 10));
        if (!shift) { ci++; if (ci >= cols.length) { ci = 0; ri = Math.min(rows.length - 1, ri + 1); } }
        else { ci--; if (ci < 0) { ci = cols.length - 1; ri = Math.max(0, ri - 1); } }
        return cols[ci] + rows[ri];
    }
    function nextCellByEnter(id, cols, rows) {
        const m = /^([A-Za-z]+)([0-9]+)$/.exec(id);
        let ci = cols.indexOf(m[1]), ri = rows.indexOf(parseInt(m[2], 10));
        ri = Math.min(rows.length - 1, ri + 1);
        return cols[ci] + rows[ri];
    }

    /* ctx: { setSelected(id), commit(id,val), onNavigate(fromId,toId,method), onInput(id,val) }
       bindGridEvents must be called again after every render (renders
       replace the container's innerHTML, orphaning old listeners). */
    function bindGridEvents(containerId, cols, rows, ctx) {
        const container = $('#' + containerId);
        container.addEventListener('mousedown', (e) => {
            const td = e.target.closest('[data-cell]');
            if (!td) return;
            // Lesson 4's formatting module needs multi-cell range
            // selection (shift-click to bold/format a whole header row at
            // once); ctx.onCellMouseDown is optional so Lessons 1-3, which
            // only ever select one cell, are unaffected.
            if (ctx.onCellMouseDown) ctx.onCellMouseDown(td.dataset.cell, e.shiftKey);
            else ctx.setSelected(td.dataset.cell);
        });
        $$('input[data-cell]', container).forEach(inp => {
            const id = inp.dataset.cell;
            // Tracks whether THIS input instance has actually been typed
            // into since it was rendered. Every render creates a fresh
            // <input> showing the cell's *computed* display value (not its
            // raw formula) and re-focuses the selected cell so keyboard
            // navigation keeps working -- but that means a later, unrelated
            // blur (clicking a button, clicking a different cell) fires on
            // an input nobody actually edited. Committing its .value
            // unconditionally would silently overwrite a correct formula
            // with its own computed display number. Only a genuine edit
            // (a real "input" event on this instance) should ever reach
            // ctx.commit(). (Found as a real bug in Lesson 1 Module 3 --
            // see lesson1.js git history -- fixed here once for every
            // lesson.)
            let userEdited = false;
            // If the caller supplies getRaw, clicking/tabbing into a cell
            // swaps its displayed value from the computed result to the
            // raw formula -- so editing =SUM(A1:A3) shows the formula to
            // edit, not "60", and a broken formula shows the actual
            // broken text to fix, not its error string. Setting .value
            // here is programmatic, not a real keystroke, so it does NOT
            // fire "input" and does not mark the cell as user-edited.
            if (ctx.getRaw) {
                inp.addEventListener('focus', () => {
                    if (suppressFocusSwap) return;
                    inp.value = ctx.getRaw(id);
                });
            }
            inp.addEventListener('input', () => {
                userEdited = true;
                if (ctx.onInput) ctx.onInput(id, inp.value);
            });
            inp.addEventListener('blur', () => {
                if (!userEdited) return;
                userEdited = false;
                ctx.commit(id, inp.value);
            });
            inp.addEventListener('keydown', (e) => {
                let next = null, method = null;
                if (e.key.indexOf('Arrow') === 0) { next = nextCellByArrow(id, e.key, cols, rows); method = 'arrow'; }
                else if (e.key === 'Tab') { next = nextCellByTab(id, cols, rows, e.shiftKey); method = 'tab'; }
                else if (e.key === 'Enter') { next = nextCellByEnter(id, cols, rows); method = 'enter'; }
                if (next) {
                    e.preventDefault();
                    ctx.onNavigate && ctx.onNavigate(id, next, method);
                    ctx.setSelected(next);
                    inp.blur();
                    // If nothing was typed into `inp`, the blur above is a
                    // no-op (see the userEdited guard) and no re-render
                    // happens -- so nothing else would move DOM focus to
                    // `next`. Focus it explicitly; if a render DID already
                    // happen (a real edit was just confirmed) this is a
                    // harmless no-op since it's already focused.
                    focusCell(containerId, next);
                }
            });
        });
    }

    /* guardedRender(fn) -> a wrapped render function that refuses to
       re-enter itself. Replacing a focused input's innerHTML makes the
       browser fire a synchronous native "blur" on it mid-removal, which
       can re-enter the render function via commit() before the first
       call has finished -- without this guard that throws "node is no
       longer a child of this node" from the browser's own DOM removal
       (found as a real bug in Lesson 1; fixed here once for every
       lesson instead of requiring every module to hand-roll the guard). */
    function guardedRender(fn) {
        let rendering = false;
        return function () {
            if (rendering) return;
            rendering = true;
            try { fn.apply(null, arguments); }
            finally { rendering = false; }
        };
    }

    // ============================================================
    //  A SMALL UNDO/REDO COMMAND STACK — same do/undo/redo/canUndo/
    //  canRedo shape as Track 3's shared commandStack.js.
    // ============================================================
    function UndoStack() { this.undoStack = []; this.redoStack = []; }
    UndoStack.prototype.do = function (cmd) { cmd.do(); this.undoStack.push(cmd); this.redoStack = []; };
    UndoStack.prototype.undo = function () { const c = this.undoStack.pop(); if (!c) return; c.undo(); this.redoStack.push(c); };
    UndoStack.prototype.redo = function () { const c = this.redoStack.pop(); if (!c) return; c.do(); this.undoStack.push(c); };
    UndoStack.prototype.canUndo = function () { return this.undoStack.length > 0; };
    UndoStack.prototype.canRedo = function () { return this.redoStack.length > 0; };

    return {
        Storage, loadSession, createProgress, Records,
        $, $$, showToast, feedback, resetFeedback, escapeHtml,
        renderGrid, renderDataTable, focusCell, bindGridEvents, guardedRender,
        nextCellByArrow, nextCellByTab, nextCellByEnter,
        UndoStack
    };
});

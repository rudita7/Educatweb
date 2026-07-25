/* Cell data model (build spec §2.2).
   Every cell is { raw, style } instead of a bare string, so per-cell
   formatting/conditional-formatting (later Spreadsheet Mastery lessons)
   has somewhere to attach without another data-model refactor.
   Also owns whole-grid recomputation: resolving formula cells that
   reference other formula cells, with cycle detection so a circular
   reference can't hang the tab. UMD-wrapped so it works as a plain
   <script src> global (window.SM.cellModel) and via require() in Node
   for the standalone engine tests. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SM = root.SM || {};
        root.SM.cellModel = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    "use strict";

    function colIndexToLetter(index) {
        let n = index + 1;
        let s = '';
        while (n > 0) {
            const rem = (n - 1) % 26;
            s = String.fromCharCode(65 + rem) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
    }

    function colLetterToIndex(letter) {
        let n = 0;
        for (let i = 0; i < letter.length; i++) {
            n = n * 26 + (letter.charCodeAt(i) - 64);
        }
        return n - 1;
    }

    const CELL_ID_RE = /^\$?([A-Za-z]+)\$?([0-9]+)$/;

    function parseCellId(id) {
        const m = CELL_ID_RE.exec(id);
        if (!m) return null;
        const col = m[1].toUpperCase();
        return { col: col, colIndex: colLetterToIndex(col), row: parseInt(m[2], 10) };
    }

    function makeCellId(colIndex, row) {
        return colIndexToLetter(colIndex) + row;
    }

    function makeCell(raw) {
        return {
            raw: raw || '',
            style: { bold: false, numberFormat: 'general', fill: null }
        };
    }

    function createGrid(colLetters, rows) {
        const grid = {};
        colLetters.forEach(col => {
            rows.forEach(row => {
                grid[col + row] = makeCell('');
            });
        });
        return grid;
    }

    function getRaw(grid, id) {
        const cell = grid[id];
        return cell ? cell.raw : '';
    }

    function setRaw(grid, id, raw) {
        if (!grid[id]) grid[id] = makeCell('');
        grid[id].raw = raw;
    }

    /* Recompute every cell's displayed value. Formula cells are resolved
       lazily and recursively (so =SUM(A1:A3) sees an up-to-date A1 even
       when A1 is itself a formula) and memoized per pass. A cell that is
       still "visiting" when re-entered is a circular reference and
       resolves to a visible error rather than an infinite loop. Any
       reference to a cell id outside the grid resolves to #REF! rather
       than silently becoming 0 -- malformed formulas must stay visible
       (build spec §2.3), never blank. */
    function recomputeGrid(grid, formulaEngine) {
        const computed = {};
        const visiting = new Set();

        function resolve(id) {
            if (Object.prototype.hasOwnProperty.call(computed, id)) return computed[id];
            if (visiting.has(id)) {
                computed[id] = '#CIRCULAR!';
                return computed[id];
            }
            const cell = grid[id];
            if (!cell) return '#REF!';
            const raw = (cell.raw || '').toString().trim();
            if (raw === '') { computed[id] = ''; return ''; }
            if (raw.charAt(0) === '=') {
                visiting.add(id);
                try {
                    const result = formulaEngine.evaluateFormula(raw, resolve);
                    computed[id] = result.ok ? result.value : result.error;
                } catch (e) {
                    computed[id] = (e && e.code) || '#ERROR';
                } finally {
                    visiting.delete(id);
                }
                return computed[id];
            }
            const num = Number(raw);
            const val = raw !== '' && !isNaN(num) ? num : raw;
            computed[id] = val;
            return val;
        }

        Object.keys(grid).forEach(id => resolve(id));
        return computed;
    }

    function getStyle(grid, id) {
        const cell = grid[id];
        return cell ? cell.style : makeCell('').style;
    }

    function setStyle(grid, id, patch) {
        if (!grid[id]) grid[id] = makeCell('');
        Object.assign(grid[id].style, patch);
    }

    const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

    /* Presentation formatting (spec §2.2 style model / Lesson 4 Module 1).
       Applies AFTER recomputeGrid has already produced the raw computed
       value -- this never changes what a formula evaluates to, only how
       it's displayed, exactly like real spreadsheet number formats. */
    function formatValue(value, numberFormat) {
        if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
        if (numberFormat === 'currency' && typeof value === 'number') {
            return '৳' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (numberFormat === 'percentage' && typeof value === 'number') {
            return (value * 100).toFixed(1) + '%';
        }
        if (numberFormat === 'date' && typeof value === 'string') {
            const m = ISO_DATE_RE.exec(value.trim());
            if (m) return m[3] + ' ' + MONTH_ABBR[parseInt(m[2], 10) - 1] + ' ' + m[1];
        }
        return value;
    }

    return {
        colIndexToLetter, colLetterToIndex, parseCellId, makeCellId,
        makeCell, createGrid, getRaw, setRaw, recomputeGrid,
        getStyle, setStyle, formatValue
    };
});

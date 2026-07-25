/* AutoFill / fill-down engine (build spec §2.4).
   Given a source cell + its raw formula and a list of target cell ids,
   clone the formula into each target, shifting RELATIVE references by
   the row/column offset while leaving ABSOLUTE ($-prefixed) references
   fixed. Pure function, no DOM/grid coupling, so it's testable on its
   own (see fillEngine.test.js) and reusable by both the drag-handle UI
   and the "Fill Down" button in Lesson 1 Module 5.
   UMD-wrapped like the other engines. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SM = root.SM || {};
        root.SM.fillEngine = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    "use strict";

    function colLetterToIndex(letter) {
        let n = 0;
        for (let i = 0; i < letter.length; i++) n = n * 26 + (letter.charCodeAt(i) - 64);
        return n - 1;
    }
    function colIndexToLetter(index) {
        let n = index + 1, s = '';
        while (n > 0) { const rem = (n - 1) % 26; s = String.fromCharCode(65 + rem) + s; n = Math.floor((n - 1) / 26); }
        return s;
    }
    function parseCell(id) {
        const m = /^([A-Za-z]+)([0-9]+)$/.exec(id);
        if (!m) return null;
        return { colIndex: colLetterToIndex(m[1].toUpperCase()), row: parseInt(m[2], 10) };
    }

    // Matches a cell reference anywhere in a formula body, capturing its
    // optional $ prefixes separately: group1 = "$" or "", group2 = column
    // letters, group3 = "$" or "", group4 = row digits. Formulas in this
    // grammar never contain string literals, so a plain global regex
    // substitution over the whole formula text is safe -- no risk of
    // matching inside a quoted string that doesn't exist. Function names
    // (SUM, AVERAGE, ...) never match because they aren't followed
    // directly by digits.
    const REF_RE = /(\$?)([A-Za-z]+)(\$?)([0-9]+)/g;

    /* fillRange(sourceCellId, sourceRaw, targetCellIds) -> { [targetId]: newRaw }
       Non-formula raw values (plain numbers/text) are copied verbatim to
       every target -- series fill (1,2,3...) is out of scope for Lesson 1. */
    function fillRange(sourceCellId, sourceRaw, targetCellIds) {
        const src = parseCell(sourceCellId);
        if (!src) throw new Error('fillRange: invalid source cell id "' + sourceCellId + '"');
        const isFormula = typeof sourceRaw === 'string' && sourceRaw.trim().charAt(0) === '=';
        const result = {};
        targetCellIds.forEach(targetId => {
            if (!isFormula) { result[targetId] = sourceRaw; return; }
            const tgt = parseCell(targetId);
            if (!tgt) { result[targetId] = sourceRaw; return; }
            const rowOffset = tgt.row - src.row;
            const colOffset = tgt.colIndex - src.colIndex;
            result[targetId] = sourceRaw.replace(REF_RE, (match, colDollar, col, rowDollar, row) => {
                const colIndex = colDollar ? colLetterToIndex(col) : colLetterToIndex(col) + colOffset;
                const rowNum = rowDollar ? parseInt(row, 10) : parseInt(row, 10) + rowOffset;
                return (colDollar ? '$' : '') + colIndexToLetter(colIndex) + (rowDollar ? '$' : '') + rowNum;
            });
        });
        return result;
    }

    return { fillRange, colIndexToLetter, colLetterToIndex };
});

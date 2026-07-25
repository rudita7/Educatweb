/* Sort & filter engine (build spec §2.5). Operates over an array of row
   objects, not raw grid cells, so it plugs cleanly into the record
   domains (invoice/attendance/inventory) rather than spreadsheet
   coordinates. Lesson 3 Modules 1-2.
   UMD-wrapped like the other engines. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SM = root.SM || {};
        root.SM.sortFilterEngine = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    "use strict";

    function isNumeric(v) {
        return v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
    }

    // Numeric values compare numerically; everything else compares as
    // case-insensitive text, so "9" < "10" (numeric) rather than "10" <
    // "9" (lexicographic) while still sorting names/statuses sensibly.
    function compareValues(a, b) {
        if (isNumeric(a) && isNumeric(b)) return Number(a) - Number(b);
        const as = String(a == null ? '' : a).toLowerCase();
        const bs = String(b == null ? '' : b).toLowerCase();
        if (as < bs) return -1;
        if (as > bs) return 1;
        return 0;
    }

    /* sortRows(rows, sortKeys) -> new sorted array (does not mutate input).
       sortKeys: [{ key, dir }] in priority order, dir is 'asc' or 'desc'.
       A second entry is the secondary/tie-break key, and so on. */
    function sortRows(rows, sortKeys) {
        if (!sortKeys || !sortKeys.length) return rows.slice();
        const copy = rows.slice();
        copy.sort((a, b) => {
            for (let i = 0; i < sortKeys.length; i++) {
                const { key, dir } = sortKeys[i];
                const cmp = compareValues(a[key], b[key]);
                if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
            }
            return 0;
        });
        return copy;
    }

    function matchesCriterion(row, criterion) {
        const { key, op, value } = criterion;
        const cell = row[key];
        switch (op) {
            case 'equals': return String(cell == null ? '' : cell).trim().toLowerCase() === String(value).trim().toLowerCase();
            case 'contains': return String(cell == null ? '' : cell).toLowerCase().indexOf(String(value).toLowerCase()) !== -1;
            case 'gt': return isNumeric(cell) && Number(cell) > Number(value);
            case 'lt': return isNumeric(cell) && Number(cell) < Number(value);
            case 'gte': return isNumeric(cell) && Number(cell) >= Number(value);
            case 'lte': return isNumeric(cell) && Number(cell) <= Number(value);
            default: return true;
        }
    }

    /* filterRows(rows, criteria) -> new filtered array. criteria:
       [{ key, op, value }], combined with AND across all criteria. */
    function filterRows(rows, criteria) {
        if (!criteria || !criteria.length) return rows.slice();
        return rows.filter(row => criteria.every(c => matchesCriterion(row, c)));
    }

    return { sortRows, filterRows, compareValues };
});

/* Hash-map lookups for cross-record consistency / referential integrity
   (spec §2.7, Lesson 2 Module 5, Lesson 3 Module 5). A record's editable
   field is checked against the canonical spelling in a master list,
   joined by a stable id -- an O(1) lookup rather than a linear scan. */
(function (global) {
    "use strict";

    function buildIndex(records, keyFn) {
        const map = new Map();
        records.forEach(function (r) { map.set(keyFn(r), r); });
        return map;
    }

    function normalize(str) {
        return String(str == null ? '' : str).trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function checkConsistency(record, index, idField, checkField, masterField) {
        masterField = masterField || checkField;
        const master = index.get(record[idField]);
        if (!master) {
            return { consistent: false, reason: idField + ' "' + record[idField] + '" was not found in the master list.' };
        }
        const same = normalize(record[checkField]) === normalize(master[masterField]);
        return {
            consistent: same,
            expected: master[masterField],
            actual: record[checkField],
            reason: same ? '' : '"' + record[checkField] + '" does not match the master record\'s "' + master[masterField] + '".'
        };
    }

    global.T3 = global.T3 || {};
    global.T3.hashLookup = { buildIndex: buildIndex, checkConsistency: checkConsistency, normalize: normalize };
})(window);

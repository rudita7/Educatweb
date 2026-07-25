/* Error-injection engine for the Capstone (build spec §7: "Reuse the
   Track 3 error-injection engine to generate a messy mixed-domain
   dataset"). This is a local implementation of the same pattern Track 3
   uses (shared/engines/errorInjection.js: seeded PRNG, pure functions
   that never mutate the input, each returning { corruptedRecord,
   groundTruthDiff }) rather than a cross-track file dependency -- kept
   local for the same self-containment reason as this track's record
   domains (spreadsheet-mastery/shared/lessonKit.js): a broken relative
   path to a sibling track shouldn't be able to break the capstone on a
   low-end, offline device.
   UMD-wrapped like the other engines. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SM = root.SM || {};
        root.SM.errorInjectionEngine = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    "use strict";

    // Deterministic PRNG so a given seed always produces the same
    // "messy dataset" -- reproducible for grading and for re-attempts.
    function mulberry32(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function clone(record) { return JSON.parse(JSON.stringify(record)); }
    function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }

    const TYPO_SWAPS = { a: 'q', e: 'w', i: 'o', o: 'p', s: 'a', t: 'y' };
    function injectTypo(record, field, rand) {
        const original = String(record[field]);
        if (!original.length) return { corruptedRecord: clone(record), groundTruthDiff: null };
        const pos = Math.floor(rand() * original.length);
        const ch = original[pos].toLowerCase();
        const replacement = TYPO_SWAPS[ch] || 'x';
        const corrupted = clone(record);
        corrupted[field] = original.slice(0, pos) + replacement + original.slice(pos + 1);
        return {
            corruptedRecord: corrupted,
            groundTruthDiff: { field, errorType: 'typo', original, corrupted: corrupted[field] }
        };
    }

    function injectMissingField(record, field) {
        const original = record[field];
        const corrupted = clone(record);
        corrupted[field] = '';
        return {
            corruptedRecord: corrupted,
            groundTruthDiff: { field, errorType: 'missing-field', original, corrupted: '' }
        };
    }

    function injectExtraWhitespace(record, field) {
        const original = String(record[field]);
        const corrupted = clone(record);
        corrupted[field] = '  ' + original + '   ';
        return {
            corruptedRecord: corrupted,
            groundTruthDiff: { field, errorType: 'extra-whitespace', original, corrupted: corrupted[field] }
        };
    }

    function injectFormatInconsistency(record, field, formatter) {
        const original = record[field];
        const corrupted = clone(record);
        corrupted[field] = formatter(original);
        return {
            corruptedRecord: corrupted,
            groundTruthDiff: { field, errorType: 'format-inconsistency', original, corrupted: corrupted[field] }
        };
    }

    // rule: { field, message, apply(record) } -- apply mutates the clone.
    function injectLogicalViolation(record, rule) {
        const corrupted = clone(record);
        const before = corrupted[rule.field];
        rule.apply(corrupted);
        return {
            corruptedRecord: corrupted,
            groundTruthDiff: { field: rule.field, errorType: 'logical-violation', original: before, corrupted: corrupted[rule.field], message: rule.message }
        };
    }

    return {
        mulberry32, clone, pick,
        injectTypo, injectMissingField, injectExtraWhitespace,
        injectFormatInconsistency, injectLogicalViolation
    };
});

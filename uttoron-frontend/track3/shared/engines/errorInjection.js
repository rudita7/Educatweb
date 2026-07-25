/* Error-injection engine (spec §2.2) -- a library of pure, composable
   corruption strategies. Each takes a clean record and returns
   { corruptedRecord, groundTruthDiff }, so every activity can grade
   against ground truth instead of a hardcoded per-screen answer.
   A tiny seeded PRNG keeps a given exercise reproducible within a
   session (same "random" corruption on repeat attempts / grading). */
(function (global) {
    "use strict";

    function mulberry32(seed) {
        let s = seed >>> 0;
        return function () {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function clone(record) { return JSON.parse(JSON.stringify(record)); }

    function injectTypo(record, field, rand) {
        rand = rand || Math.random;
        const original = String(record[field] == null ? '' : record[field]);
        if (!original.length) return null;
        const letterIdx = [];
        for (let i = 0; i < original.length; i++) if (/[a-zA-Z]/.test(original[i])) letterIdx.push(i);
        if (!letterIdx.length) return null;
        const pos = letterIdx[Math.floor(rand() * letterIdx.length)];
        const chars = original.split('');
        const code = chars[pos].charCodeAt(0);
        chars[pos] = String.fromCharCode(/[a-z]/.test(chars[pos]) ? ((code - 97 + 1) % 26) + 97 : ((code - 65 + 1) % 26) + 65);
        const corrupted = clone(record);
        corrupted[field] = chars.join('');
        return {
            corruptedRecord: corrupted,
            groundTruthDiff: { field: field, errorType: 'typo', original: original, corrupted: corrupted[field] }
        };
    }

    function injectMissingField(record, field) {
        const corrupted = clone(record);
        const original = corrupted[field];
        corrupted[field] = '';
        return { corruptedRecord: corrupted, groundTruthDiff: { field: field, errorType: 'missing-field', original: original, corrupted: '' } };
    }

    function injectFormatInconsistency(record, field, formatter) {
        const corrupted = clone(record);
        const original = corrupted[field];
        corrupted[field] = formatter(original);
        return { corruptedRecord: corrupted, groundTruthDiff: { field: field, errorType: 'format-inconsistency', original: original, corrupted: corrupted[field] } };
    }

    function injectExtraWhitespace(record, field) {
        const corrupted = clone(record);
        const original = corrupted[field];
        corrupted[field] = '  ' + String(original).replace(/ /g, '  ') + ' ';
        return { corruptedRecord: corrupted, groundTruthDiff: { field: field, errorType: 'extra-whitespace', original: original, corrupted: corrupted[field] } };
    }

    // rule: { field, message, apply(record) } -- apply() mutates the clone in place
    function injectLogicalViolation(record, rule) {
        const corrupted = clone(record);
        const originalValue = record[rule.field];
        rule.apply(corrupted);
        return {
            corruptedRecord: corrupted,
            groundTruthDiff: { field: rule.field, errorType: 'logical-violation', original: originalValue, corrupted: corrupted[rule.field], message: rule.message }
        };
    }

    function injectCrossReferenceMismatch(record, refField, badRef) {
        const corrupted = clone(record);
        const original = corrupted[refField];
        corrupted[refField] = badRef;
        return { corruptedRecord: corrupted, groundTruthDiff: { field: refField, errorType: 'cross-reference-mismatch', original: original, corrupted: badRef } };
    }

    // Clones a record into a near-identical duplicate rather than corrupting
    // the record in place -- feeds the duplicate/fuzzy-match engine (§2.4)
    // instead of a "spot the error" check. mutation: { field, transform(value) }
    // tweaks one field on the clone (default: pad it with whitespace) so the
    // duplicate is a near-match, not byte-identical -- exercising the fuzzy
    // side of clusterDuplicates(), not just exact-match hashing.
    function injectDuplicate(record, mutation) {
        mutation = mutation || {};
        const field = mutation.field || null;
        const transform = mutation.transform || (v => '  ' + String(v) + '  ');
        const duplicate = clone(record);
        if (duplicate.id) duplicate.id = duplicate.id + '-DUP';
        if (field && duplicate[field] != null) {
            duplicate[field] = transform(duplicate[field]);
        }
        return {
            corruptedRecord: duplicate,
            groundTruthDiff: { field: field || 'id', errorType: 'duplicate', original: record.id, corrupted: duplicate.id, message: 'Near-duplicate of record ' + record.id + '.' }
        };
    }

    global.T3 = global.T3 || {};
    global.T3.inject = {
        mulberry32: mulberry32,
        injectTypo: injectTypo,
        injectMissingField: injectMissingField,
        injectFormatInconsistency: injectFormatInconsistency,
        injectExtraWhitespace: injectExtraWhitespace,
        injectLogicalViolation: injectLogicalViolation,
        injectCrossReferenceMismatch: injectCrossReferenceMismatch,
        injectDuplicate: injectDuplicate
    };
})(window);

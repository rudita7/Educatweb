/* Standalone unit tests for errorInjectionEngine.js -- run with:
     node engines/errorInjectionEngine.test.js */
"use strict";
const assert = require('assert');
const inject = require('./errorInjectionEngine.js');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok - ' + name); }
    catch (e) { failed++; console.error('  FAIL - ' + name + '\n    ' + e.message); }
}

console.log('errorInjectionEngine.test.js');

test('mulberry32 is deterministic for a given seed', () => {
    const a = inject.mulberry32(42);
    const b = inject.mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    assert.deepStrictEqual(seqA, seqB);
});

test('mulberry32 produces different sequences for different seeds', () => {
    const a = inject.mulberry32(1);
    const b = inject.mulberry32(2);
    assert.notStrictEqual(a(), b());
});

test('injectTypo never mutates the original record', () => {
    const record = { name: 'Rahman' };
    inject.injectTypo(record, 'name', inject.mulberry32(1));
    assert.strictEqual(record.name, 'Rahman');
});

test('injectTypo changes exactly one character and reports groundTruthDiff', () => {
    const record = { name: 'Rahman' };
    const result = inject.injectTypo(record, 'name', inject.mulberry32(7));
    assert.notStrictEqual(result.corruptedRecord.name, 'Rahman');
    assert.strictEqual(result.corruptedRecord.name.length, 'Rahman'.length);
    assert.strictEqual(result.groundTruthDiff.field, 'name');
    assert.strictEqual(result.groundTruthDiff.errorType, 'typo');
    assert.strictEqual(result.groundTruthDiff.original, 'Rahman');
});

test('injectMissingField blanks the field without mutating the original', () => {
    const record = { quantity: 48 };
    const result = inject.injectMissingField(record, 'quantity');
    assert.strictEqual(record.quantity, 48);
    assert.strictEqual(result.corruptedRecord.quantity, '');
    assert.strictEqual(result.groundTruthDiff.original, 48);
});

test('injectExtraWhitespace pads the field', () => {
    const record = { status: 'Late' };
    const result = inject.injectExtraWhitespace(record, 'status');
    assert.strictEqual(result.corruptedRecord.status.trim(), 'Late');
    assert.notStrictEqual(result.corruptedRecord.status, 'Late');
});

test('injectFormatInconsistency applies the given formatter', () => {
    const record = { date: '2026-07-15' };
    const result = inject.injectFormatInconsistency(record, 'date', v => v.split('-').reverse().join('/'));
    assert.strictEqual(result.corruptedRecord.date, '15/07/2026');
    assert.strictEqual(record.date, '2026-07-15');
});

test('injectLogicalViolation applies a rule and reports the message', () => {
    const record = { total: 10200 };
    const result = inject.injectLogicalViolation(record, { field: 'total', message: 'Total does not match line items.', apply: r => { r.total = 999; } });
    assert.strictEqual(result.corruptedRecord.total, 999);
    assert.strictEqual(record.total, 10200);
    assert.strictEqual(result.groundTruthDiff.message, 'Total does not match line items.');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

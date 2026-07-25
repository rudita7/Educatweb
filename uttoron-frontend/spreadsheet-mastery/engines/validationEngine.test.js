/* Standalone unit tests for validationEngine.js -- run with:
     node engines/validationEngine.test.js */
"use strict";
const assert = require('assert');
const ve = require('./validationEngine.js');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok - ' + name); }
    catch (e) { failed++; console.error('  FAIL - ' + name + '\n    ' + e.message); }
}

console.log('validationEngine.test.js');

const RULES = [
    { field: 'status', type: 'list', options: ['Present', 'Absent', 'Late'] },
    { field: 'quantity', type: 'range', min: 0, max: 500 }
];

test('list rule accepts an allowed value (case-insensitive)', () => {
    const r = ve.validateField('present', RULES[0]);
    assert.strictEqual(r.valid, true);
});

test('list rule rejects a value outside the allowed set', () => {
    const r = ve.validateField('On Leave', RULES[0]);
    assert.strictEqual(r.valid, false);
    assert.ok(r.message.length > 0);
});

test('range rule accepts a value inside the range', () => {
    const r = ve.validateField(250, RULES[1]);
    assert.strictEqual(r.valid, true);
});

test('range rule rejects a value outside the range', () => {
    assert.strictEqual(ve.validateField(-5, RULES[1]).valid, false);
    assert.strictEqual(ve.validateField(999, RULES[1]).valid, false);
});

test('range rule rejects non-numeric input', () => {
    assert.strictEqual(ve.validateField('abc', RULES[1]).valid, false);
    assert.strictEqual(ve.validateField('', RULES[1]).valid, false);
});

test('validateRecord checks every rule and reports per-field results', () => {
    const results = ve.validateRecord({ status: 'Late', quantity: 42 }, RULES);
    assert.strictEqual(results.length, 2);
    assert.ok(results.every(r => r.valid));
});

test('isRecordValid is true only when every rule passes', () => {
    assert.strictEqual(ve.isRecordValid({ status: 'Late', quantity: 42 }, RULES), true);
    assert.strictEqual(ve.isRecordValid({ status: 'On Leave', quantity: 42 }, RULES), false);
    assert.strictEqual(ve.isRecordValid({ status: 'Late', quantity: 9999 }, RULES), false);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

/* Standalone unit tests for fillEngine.js -- run with:
     node engines/fillEngine.test.js */
"use strict";
const assert = require('assert');
const fillEngine = require('./fillEngine.js');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok - ' + name); }
    catch (e) { failed++; console.error('  FAIL - ' + name + '\n    ' + e.message); }
}

console.log('fillEngine.test.js');

test('relative reference shifts down a column', () => {
    const out = fillEngine.fillRange('C2', '=B2-10', ['C3', 'C4', 'C5']);
    assert.strictEqual(out.C3, '=B3-10');
    assert.strictEqual(out.C4, '=B4-10');
    assert.strictEqual(out.C5, '=B5-10');
});

test('absolute reference ($A$1) never moves', () => {
    const out = fillEngine.fillRange('D2', '=C2*$G$1', ['D3', 'D4']);
    assert.strictEqual(out.D3, '=C3*$G$1');
    assert.strictEqual(out.D4, '=C4*$G$1');
});

test('mixed absolute forms: $A1 keeps column fixed, A$1 keeps row fixed', () => {
    // Fill from B2 to C3 so both a row AND column offset are exercised.
    const out = fillEngine.fillRange('B2', '=$A2+A$1', ['C3']);
    // $A2 -> $A3 (col locked, row moves); A$1 -> B$1 (row locked, col moves)
    assert.strictEqual(out.C3, '=$A3+B$1');
});

test('fill-down of the classic SUM(A1:A3) example moves the whole range', () => {
    const out = fillEngine.fillRange('A4', '=SUM(A1:A3)', ['B4']);
    assert.strictEqual(out.B4, '=SUM(B1:B3)');
});

test('column offset shifts letters, not just row offset', () => {
    const out = fillEngine.fillRange('A1', '=A2*2', ['C1']);
    assert.strictEqual(out.C1, '=C2*2');
});

test('non-formula raw values are copied verbatim (no series fill)', () => {
    const out = fillEngine.fillRange('A2', '42', ['A3', 'A4']);
    assert.strictEqual(out.A3, '42');
    assert.strictEqual(out.A4, '42');
});

test('reorder-buffer style formula (relative + absolute mix) fills correctly', () => {
    const out = fillEngine.fillRange('F2', '=E2+$G$1', ['F3']);
    assert.strictEqual(out.F3, '=E3+$G$1');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

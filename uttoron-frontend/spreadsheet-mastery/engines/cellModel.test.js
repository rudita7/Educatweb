/* Standalone unit tests for cellModel.js -- run with:
     node engines/cellModel.test.js */
"use strict";
const assert = require('assert');
const cellModel = require('./cellModel.js');
const formulaEngine = require('./formulaEngine.js');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok - ' + name); }
    catch (e) { failed++; console.error('  FAIL - ' + name + '\n    ' + e.message); }
}

console.log('cellModel.test.js');

test('colIndexToLetter / colLetterToIndex round-trip', () => {
    assert.strictEqual(cellModel.colIndexToLetter(0), 'A');
    assert.strictEqual(cellModel.colIndexToLetter(5), 'F');
    assert.strictEqual(cellModel.colLetterToIndex('A'), 0);
    assert.strictEqual(cellModel.colLetterToIndex('F'), 5);
});

test('createGrid produces a { raw, style } cell for every id, not a bare string', () => {
    const grid = cellModel.createGrid(['A', 'B'], [1, 2]);
    assert.strictEqual(Object.keys(grid).length, 4);
    assert.deepStrictEqual(grid.A1, { raw: '', style: { bold: false, numberFormat: 'general', fill: null } });
});

test('recomputeGrid resolves a plain value cell', () => {
    const grid = cellModel.createGrid(['A'], [1]);
    cellModel.setRaw(grid, 'A1', '42');
    const computed = cellModel.recomputeGrid(grid, formulaEngine);
    assert.strictEqual(computed.A1, 42);
});

test('recomputeGrid resolves a formula chain across cells (A2 depends on A1)', () => {
    const grid = cellModel.createGrid(['A'], [1, 2, 3]);
    cellModel.setRaw(grid, 'A1', '10');
    cellModel.setRaw(grid, 'A2', '=A1*2');
    cellModel.setRaw(grid, 'A3', '=A2+A1');
    const computed = cellModel.recomputeGrid(grid, formulaEngine);
    assert.strictEqual(computed.A1, 10);
    assert.strictEqual(computed.A2, 20);
    assert.strictEqual(computed.A3, 30);
});

test('recomputeGrid detects a circular reference instead of hanging', () => {
    const grid = cellModel.createGrid(['A'], [1, 2]);
    cellModel.setRaw(grid, 'A1', '=A2+1');
    cellModel.setRaw(grid, 'A2', '=A1+1');
    const computed = cellModel.recomputeGrid(grid, formulaEngine);
    assert.strictEqual(computed.A1, '#CIRCULAR!');
    assert.strictEqual(computed.A2, '#CIRCULAR!');
});

test('a reference to a cell outside the grid resolves to #REF!, not silently 0', () => {
    const grid = cellModel.createGrid(['A'], [1]);
    cellModel.setRaw(grid, 'A1', '=Z99+1');
    const computed = cellModel.recomputeGrid(grid, formulaEngine);
    assert.strictEqual(computed.A1, '#REF!');
});

test('recomputeGrid can resolve a formula to text (IF branch) or boolean (comparison)', () => {
    const grid = cellModel.createGrid(['A', 'B'], [1]);
    cellModel.setRaw(grid, 'A1', '9.5');
    cellModel.setRaw(grid, 'B1', '=IF(A1>9,"Late","On time")');
    const computed = cellModel.recomputeGrid(grid, formulaEngine);
    assert.strictEqual(computed.B1, 'Late');
});

test('setStyle / getStyle mutate and read a cell\'s style object', () => {
    const grid = cellModel.createGrid(['A'], [1]);
    cellModel.setStyle(grid, 'A1', { bold: true, numberFormat: 'currency' });
    const style = cellModel.getStyle(grid, 'A1');
    assert.strictEqual(style.bold, true);
    assert.strictEqual(style.numberFormat, 'currency');
    assert.strictEqual(style.fill, null); // untouched fields preserved
});

test('formatValue: currency', () => {
    assert.strictEqual(cellModel.formatValue(10200, 'currency'), '৳10,200.00');
});

test('formatValue: percentage', () => {
    assert.strictEqual(cellModel.formatValue(0.05, 'percentage'), '5.0%');
});

test('formatValue: date reformats an ISO date to "DD Mon YYYY"', () => {
    assert.strictEqual(cellModel.formatValue('2026-07-15', 'date'), '15 Jul 2026');
});

test('formatValue: booleans always render as TRUE/FALSE regardless of numberFormat', () => {
    assert.strictEqual(cellModel.formatValue(true, 'general'), 'TRUE');
    assert.strictEqual(cellModel.formatValue(false, 'currency'), 'FALSE');
});

test('formatValue: non-numeric value with currency/percentage format passes through unchanged', () => {
    assert.strictEqual(cellModel.formatValue('Rahman', 'currency'), 'Rahman');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

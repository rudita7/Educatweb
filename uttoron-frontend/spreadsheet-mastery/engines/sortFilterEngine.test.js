/* Standalone unit tests for sortFilterEngine.js -- run with:
     node engines/sortFilterEngine.test.js */
"use strict";
const assert = require('assert');
const sf = require('./sortFilterEngine.js');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok - ' + name); }
    catch (e) { failed++; console.error('  FAIL - ' + name + '\n    ' + e.message); }
}

console.log('sortFilterEngine.test.js');

const inventory = [
    { item: 'Stapler', qty: 15, location: 'Shelf B3' },
    { item: 'A4 Paper', qty: 48, location: 'Shelf A2' },
    { item: 'Marker Set', qty: 30, location: 'Shelf B3' },
    { item: 'Envelope Box', qty: 30, location: 'Shelf A2' }
];

test('sortRows ascending by a numeric column', () => {
    const sorted = sf.sortRows(inventory, [{ key: 'qty', dir: 'asc' }]);
    assert.deepStrictEqual(sorted.map(r => r.qty), [15, 30, 30, 48]);
});

test('sortRows descending', () => {
    const sorted = sf.sortRows(inventory, [{ key: 'qty', dir: 'desc' }]);
    assert.deepStrictEqual(sorted.map(r => r.qty), [48, 30, 30, 15]);
});

test('sortRows does not mutate the original array', () => {
    const original = inventory.map(r => r.item);
    sf.sortRows(inventory, [{ key: 'qty', dir: 'desc' }]);
    assert.deepStrictEqual(inventory.map(r => r.item), original);
});

test('sortRows with a secondary tie-break key', () => {
    const sorted = sf.sortRows(inventory, [{ key: 'qty', dir: 'asc' }, { key: 'location', dir: 'asc' }]);
    // qty=30 ties between Marker Set (Shelf B3) and Envelope Box (Shelf A2) -- Shelf A2 sorts first
    const tiedQty30 = sorted.filter(r => r.qty === 30).map(r => r.item);
    assert.deepStrictEqual(tiedQty30, ['Envelope Box', 'Marker Set']);
});

test('numeric sort treats "9" as less than "10", not lexicographically', () => {
    const rows = [{ n: '10' }, { n: '9' }, { n: '2' }];
    const sorted = sf.sortRows(rows, [{ key: 'n', dir: 'asc' }]);
    assert.deepStrictEqual(sorted.map(r => r.n), ['2', '9', '10']);
});

test('filterRows equals (case-insensitive)', () => {
    const attendance = [{ name: 'A', status: 'Late' }, { name: 'B', status: 'Present' }, { name: 'C', status: 'late' }];
    const late = sf.filterRows(attendance, [{ key: 'status', op: 'equals', value: 'Late' }]);
    assert.strictEqual(late.length, 2);
});

test('filterRows contains', () => {
    const rows = [{ item: 'A4 Paper Ream' }, { item: 'Stapler' }, { item: 'Paper Clips' }];
    const paper = sf.filterRows(rows, [{ key: 'item', op: 'contains', value: 'paper' }]);
    assert.strictEqual(paper.length, 2);
});

test('filterRows gt/lt', () => {
    const overThreshold = sf.filterRows(inventory, [{ key: 'qty', op: 'gt', value: 20 }]);
    assert.strictEqual(overThreshold.length, 3);
    const underThreshold = sf.filterRows(inventory, [{ key: 'qty', op: 'lt', value: 20 }]);
    assert.strictEqual(underThreshold.length, 1);
});

test('filterRows combines multiple criteria with AND', () => {
    const rows = sf.filterRows(inventory, [{ key: 'location', op: 'equals', value: 'Shelf B3' }, { key: 'qty', op: 'gt', value: 20 }]);
    assert.deepStrictEqual(rows.map(r => r.item), ['Marker Set']);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

/* Standalone unit tests for conditionalFormatEngine.js -- run with:
     node engines/conditionalFormatEngine.test.js */
"use strict";
const assert = require('assert');
const cf = require('./conditionalFormatEngine.js');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok - ' + name); }
    catch (e) { failed++; console.error('  FAIL - ' + name + '\n    ' + e.message); }
}

console.log('conditionalFormatEngine.test.js');

const RULES = [
    { id: 'flag-overdue-invoice', appliesTo: r => r.__domain === 'invoice', condition: r => r.status === 'Overdue', style: { fill: 'coral-soft' } },
    { id: 'flag-low-stock', appliesTo: r => r.__domain === 'inventory', condition: r => r.quantity < 10, style: { fill: 'coral-soft' } }
];

test('resolveFill returns the matching rule style', () => {
    const fill = cf.resolveFill({ __domain: 'invoice', status: 'Overdue' }, RULES);
    assert.strictEqual(fill, 'coral-soft');
});

test('resolveFill returns null when no rule matches', () => {
    const fill = cf.resolveFill({ __domain: 'invoice', status: 'Paid' }, RULES);
    assert.strictEqual(fill, null);
});

test('appliesTo scopes rules to the right record domain', () => {
    // quantity < 10 would match flag-low-stock's condition, but this
    // record isn't an inventory record, so appliesTo should exclude it.
    const fill = cf.resolveFill({ __domain: 'invoice', quantity: 2, status: 'Paid' }, RULES);
    assert.strictEqual(fill, null);
});

test('matchingRules can return more than one matched rule', () => {
    const rules = [
        { id: 'a', condition: () => true, style: { fill: 'x' } },
        { id: 'b', condition: r => r.value > 5, style: { fill: 'y' } }
    ];
    const matched = cf.matchingRules({ value: 10 }, rules);
    assert.strictEqual(matched.length, 2);
});

test('later rules win the cascade on conflicting matches', () => {
    const rules = [
        { id: 'general', condition: () => true, style: { fill: 'general-fill' } },
        { id: 'specific', condition: r => r.status === 'Overdue', style: { fill: 'specific-fill' } }
    ];
    const fill = cf.resolveFill({ status: 'Overdue' }, rules);
    assert.strictEqual(fill, 'specific-fill');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

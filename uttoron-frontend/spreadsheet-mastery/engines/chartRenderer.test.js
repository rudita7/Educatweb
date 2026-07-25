/* Standalone unit tests for chartRenderer.js -- run with:
     node engines/chartRenderer.test.js */
"use strict";
const assert = require('assert');
const chart = require('./chartRenderer.js');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok - ' + name); }
    catch (e) { failed++; console.error('  FAIL - ' + name + '\n    ' + e.message); }
}

console.log('chartRenderer.test.js');

test('renders a valid <svg> with one <rect> per category', () => {
    const svg = chart.renderBarChart(['A4 Paper', 'Stapler', 'Markers'], [48, 15, 30]);
    assert.ok(svg.startsWith('<svg'));
    const rectCount = (svg.match(/<rect/g) || []).length;
    assert.strictEqual(rectCount, 3);
});

test('bar heights are proportional to value (larger value -> larger height)', () => {
    const svg = chart.renderBarChart(['A', 'B'], [10, 50]);
    const heights = Array.from(svg.matchAll(/<rect[^>]*height="([\d.]+)"/g)).map(m => parseFloat(m[1]));
    assert.strictEqual(heights.length, 2);
    assert.ok(heights[1] > heights[0]);
});

test('escapes category labels to avoid breaking the SVG markup', () => {
    const svg = chart.renderBarChart(['<script>alert(1)</script>'], [5]);
    assert.ok(!svg.includes('<script>alert'));
    assert.ok(svg.includes('&lt;script&gt;'));
});

test('empty category list renders a graceful placeholder, not broken markup', () => {
    const svg = chart.renderBarChart([], []);
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('No data selected'));
});

test('handles a single bar without dividing by zero', () => {
    const svg = chart.renderBarChart(['Only'], [42]);
    assert.ok(svg.includes('<rect'));
    assert.ok(!svg.includes('NaN'));
});

test('all-zero values do not produce NaN geometry', () => {
    const svg = chart.renderBarChart(['A', 'B'], [0, 0]);
    assert.ok(!svg.includes('NaN'));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

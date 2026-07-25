/* Standalone unit tests for formulaEngine.js -- run with:
     node engines/formulaEngine.test.js
   No framework/dependency: this repo has no package.json or test
   runner, so this is a plain assert-based script, matching the rest of
   the codebase's zero-build-step convention. Built and passing BEFORE
   this engine is wired into any lesson UI (build spec §2.3). */
"use strict";
const assert = require('assert');
const fe = require('./formulaEngine.js');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  ok - ' + name); }
    catch (e) { failed++; console.error('  FAIL - ' + name + '\n    ' + e.message); }
}

// A tiny fixed cell map used as the resolveCellFn for most tests.
function resolverFor(map) {
    return function (id) {
        if (!(id in map)) return '#REF!';
        return map[id];
    };
}

console.log('formulaEngine.test.js');

test('plain arithmetic with precedence', () => {
    const r = fe.evaluateFormula('=2+3*4', resolverFor({}));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.value, 14);
});

test('parentheses override precedence', () => {
    const r = fe.evaluateFormula('=(2+3)*4', resolverFor({}));
    assert.strictEqual(r.value, 20);
});

test('unary minus', () => {
    const r = fe.evaluateFormula('=-5+10', resolverFor({}));
    assert.strictEqual(r.value, 5);
});

test('relative cell reference arithmetic (=A1*1.05)', () => {
    const r = fe.evaluateFormula('=A1*1.05', resolverFor({ A1: 100 }));
    assert.strictEqual(r.ok, true);
    assert.ok(Math.abs(r.value - 105) < 1e-9);
});

test('absolute reference is read the same as relative (value-wise)', () => {
    const r = fe.evaluateFormula('=A2*$B$1', resolverFor({ A2: 10, B1: 0.05 }));
    assert.strictEqual(r.ok, true);
    assert.ok(Math.abs(r.value - 0.5) < 1e-9);
});

test('mixed absolute forms $A1 / A$1 all resolve to the same cell id', () => {
    const r1 = fe.evaluateFormula('=$A1+1', resolverFor({ A1: 4 }));
    const r2 = fe.evaluateFormula('=A$1+1', resolverFor({ A1: 4 }));
    assert.strictEqual(r1.value, 5);
    assert.strictEqual(r2.value, 5);
});

test('nested expression =(A1+A2)/2', () => {
    const r = fe.evaluateFormula('=(A1+A2)/2', resolverFor({ A1: 10, A2: 20 }));
    assert.strictEqual(r.value, 15);
});

test('SUM over a range', () => {
    const r = fe.evaluateFormula('=SUM(A1:A3)', resolverFor({ A1: 1, A2: 2, A3: 3 }));
    assert.strictEqual(r.value, 6);
});

test('AVERAGE over a range', () => {
    const r = fe.evaluateFormula('=AVERAGE(B1:B3)', resolverFor({ B1: 5, B2: 10, B3: 15 }));
    assert.strictEqual(r.value, 10);
});

test('MAX / MIN over a range', () => {
    const rMax = fe.evaluateFormula('=MAX(A1:A3)', resolverFor({ A1: 1, A2: 30, A3: 3 }));
    const rMin = fe.evaluateFormula('=MIN(A1:A3)', resolverFor({ A1: 1, A2: 30, A3: 3 }));
    assert.strictEqual(rMax.value, 30);
    assert.strictEqual(rMin.value, 1);
});

test('SUM skips blank cells in a range', () => {
    const r = fe.evaluateFormula('=SUM(A1:A3)', resolverFor({ A1: 5, A2: '', A3: 7 }));
    assert.strictEqual(r.value, 12);
});

test('COUNT counts only numeric cells, COUNTA counts non-blank cells', () => {
    const map = { A1: 5, A2: '', A3: 'text' };
    const rCount = fe.evaluateFormula('=COUNT(A1:A3)', resolverFor(map));
    const rCountA = fe.evaluateFormula('=COUNTA(A1:A3)', resolverFor(map));
    assert.strictEqual(rCount.value, 1);
    assert.strictEqual(rCountA.value, 2);
});

test('division by zero -> #DIV/0!', () => {
    const r = fe.evaluateFormula('=A1/A2', resolverFor({ A1: 10, A2: 0 }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, '#DIV/0!');
});

test('text operand in direct arithmetic -> #VALUE!', () => {
    const r = fe.evaluateFormula('=A1+1', resolverFor({ A1: 'Rahman' }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, '#VALUE!');
});

test('reference outside the grid -> #REF!', () => {
    const r = fe.evaluateFormula('=Z99+1', resolverFor({}));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, '#REF!');
});

test('malformed formula (mismatched parens) -> #ERROR', () => {
    const r = fe.evaluateFormula('=SUM(A1:A3', resolverFor({ A1: 1, A2: 2, A3: 3 }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, '#ERROR');
});

test('unknown function -> #ERROR (not silently NaN)', () => {
    const r = fe.evaluateFormula('=VLOOKUP(A1,B1:B3,2)', resolverFor({ A1: 5, B1: 1, B2: 2, B3: 3 }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, '#ERROR');
});

test('an upstream error propagates through arithmetic', () => {
    const r = fe.evaluateFormula('=A1+1', resolverFor({ A1: '#REF!' }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, '#REF!');
});

test('an upstream error propagates through SUM', () => {
    const r = fe.evaluateFormula('=SUM(A1:A2)', resolverFor({ A1: 5, A2: '#DIV/0!' }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, '#DIV/0!');
});

// ---------- Lesson 2 additions: comparisons, string literals, IF/AND/OR,
// COUNTIF/SUMIF, and Lesson 3's LOOKUP ----------

test('comparison operators return booleans', () => {
    assert.strictEqual(fe.evaluateFormula('=5>3', resolverFor({})).value, true);
    assert.strictEqual(fe.evaluateFormula('=5<3', resolverFor({})).value, false);
    assert.strictEqual(fe.evaluateFormula('=5>=5', resolverFor({})).value, true);
    assert.strictEqual(fe.evaluateFormula('=5<=4', resolverFor({})).value, false);
    assert.strictEqual(fe.evaluateFormula('=5=5', resolverFor({})).value, true);
    assert.strictEqual(fe.evaluateFormula('=5<>5', resolverFor({})).value, false);
});

test('comparisons work against cell references', () => {
    const r = fe.evaluateFormula('=B2>9', resolverFor({ B2: 9.25 }));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.value, true);
});

test('text equality comparison is case-insensitive and trims', () => {
    const r = fe.evaluateFormula('=A1="Late"', resolverFor({ A1: ' late ' }));
    assert.strictEqual(r.value, true);
});

test('string literal as a whole formula result', () => {
    const r = fe.evaluateFormula('="Reorder"', resolverFor({}));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.value, 'Reorder');
});

test('IF returns text branches, not just numbers', () => {
    const late = fe.evaluateFormula('=IF(B2>9,"Late","On time")', resolverFor({ B2: 9.5 }));
    const onTime = fe.evaluateFormula('=IF(B2>9,"Late","On time")', resolverFor({ B2: 8.5 }));
    assert.strictEqual(late.value, 'Late');
    assert.strictEqual(onTime.value, 'On time');
});

test('nested IF', () => {
    const grade = qty => fe.evaluateFormula('=IF(A1<10,"Low",IF(A1<50,"Medium","High"))', resolverFor({ A1: qty })).value;
    assert.strictEqual(grade(5), 'Low');
    assert.strictEqual(grade(30), 'Medium');
    assert.strictEqual(grade(100), 'High');
});

test('AND / OR combine multiple conditions', () => {
    const overdue = (status, daysLate) => fe.evaluateFormula(
        '=IF(AND(A1<>"Paid",B1>0),"Overdue","OK")',
        resolverFor({ A1: status, B1: daysLate })
    ).value;
    assert.strictEqual(overdue('Pending', 5), 'Overdue');
    assert.strictEqual(overdue('Paid', 5), 'OK');
    assert.strictEqual(overdue('Pending', 0), 'OK');

    const eitherLate = (a, b) => fe.evaluateFormula('=OR(A1>9,B1>9)', resolverFor({ A1: a, B1: b })).value;
    assert.strictEqual(eitherLate(10, 1), true);
    assert.strictEqual(eitherLate(1, 1), false);
});

test('IF with a bare numeric condition (no comparison) still works', () => {
    const r = fe.evaluateFormula('=IF(A1,"yes","no")', resolverFor({ A1: 1 }));
    assert.strictEqual(r.value, 'yes');
});

test('COUNTIF counts text-equality matches', () => {
    const r = fe.evaluateFormula('=COUNTIF(A1:A4,"Late")', resolverFor({ A1: 'Late', A2: 'Present', A3: 'Late', A4: 'Absent' }));
    assert.strictEqual(r.value, 2);
});

test('COUNTIF with a comparison-operator criteria string', () => {
    const r = fe.evaluateFormula('=COUNTIF(A1:A4,">10")', resolverFor({ A1: 5, A2: 15, A3: 20, A4: 8 }));
    assert.strictEqual(r.value, 2);
});

test('SUMIF sums the parallel range where criteria matches', () => {
    // status column A1:A3, amount column B1:B3 -- sum amounts where status = "Paid"
    const r = fe.evaluateFormula('=SUMIF(A1:A3,"Paid",B1:B3)', resolverFor({
        A1: 'Paid', B1: 100, A2: 'Pending', B2: 200, A3: 'Paid', B3: 300
    }));
    assert.strictEqual(r.value, 400);
});

test('SUMIF with a numeric comparison criteria', () => {
    const r = fe.evaluateFormula('=SUMIF(A1:A3,">=10",B1:B3)', resolverFor({
        A1: 5, B1: 1, A2: 10, B2: 2, A3: 20, B3: 3
    }));
    assert.strictEqual(r.value, 5); // rows 2 and 3 qualify: B2+B3 = 2+3
});

test('LOOKUP finds an exact match and returns the parallel result', () => {
    const r = fe.evaluateFormula('=LOOKUP(A1,B1:B3,C1:C3)', resolverFor({
        A1: 'CUS-302', B1: 'CUS-301', C1: 'Green Valley Traders', B2: 'CUS-302', C2: 'Bay Textiles Ltd.', B3: 'CUS-303', C3: 'Dhanmondi Hardware'
    }));
    assert.strictEqual(r.value, 'Bay Textiles Ltd.');
});

test('LOOKUP with no match -> #N/A', () => {
    const r = fe.evaluateFormula('=LOOKUP(A1,B1:B2,C1:C2)', resolverFor({ A1: 'CUS-999', B1: 'CUS-301', C1: 'x', B2: 'CUS-302', C2: 'y' }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, '#N/A');
});

test('TRUE/FALSE from a comparison can be used in later arithmetic (TRUE=1, FALSE=0)', () => {
    const r = fe.evaluateFormula('=(A1>5)+1', resolverFor({ A1: 10 }));
    assert.strictEqual(r.value, 2);
});

test('an error inside an IF condition still propagates', () => {
    const r = fe.evaluateFormula('=IF(A1>5,"x","y")', resolverFor({ A1: '#REF!' }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, '#REF!');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

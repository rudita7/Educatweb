/* Logical validation / rule engine (spec §2.5, Lesson 3 Module 6).
   Business rules are small declarative objects -- { id, appliesTo,
   check(record), message } -- rather than if-statements scattered
   through the UI. evaluateRules() is a generic interpreter that runs
   any record against any rule list and returns pass/fail + messages,
   so the UI never hardcodes "this record is wrong because...". */
(function (global) {
    "use strict";

    function evaluateRules(record, rules) {
        return rules
            .filter(rule => !rule.appliesTo || rule.appliesTo(record))
            .map(rule => ({ id: rule.id, message: rule.message, passed: !!rule.check(record) }));
    }

    function summarize(results) {
        const failed = results.filter(r => !r.passed);
        return { total: results.length, passed: results.length - failed.length, failed };
    }

    global.T3 = global.T3 || {};
    global.T3.ruleEngine = { evaluateRules, summarize };
})(window);

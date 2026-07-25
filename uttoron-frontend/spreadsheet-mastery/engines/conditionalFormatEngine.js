/* Conditional formatting rule engine (build spec §2.6). Declarative rule
   objects -- { id, appliesTo, condition, style } -- the same spirit as
   Track 3's validation rule engine ({id, appliesTo, check, message}):
   business logic lives in small predicate functions instead of
   if-statements scattered through render code, so the UI never
   hardcodes "highlight this row because...". A small evaluator applies
   matching rules' styles to records at render time. Lesson 4 Module 2.
   UMD-wrapped like the other engines. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SM = root.SM || {};
        root.SM.conditionalFormatEngine = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    "use strict";

    /* Rule shape: { id, appliesTo?(record)=>bool, condition(record)=>bool, style: { fill } } */
    function matchingRules(record, rules) {
        return rules.filter(rule => (!rule.appliesTo || rule.appliesTo(record)) && rule.condition(record));
    }

    // Later rules in the array win on conflict, same cascade order as CSS
    // -- lets a learner stack a general rule with a more specific override.
    function resolveFill(record, rules) {
        const matched = matchingRules(record, rules);
        if (!matched.length) return null;
        return matched[matched.length - 1].style.fill;
    }

    return { matchingRules, resolveFill };
});

/* Data validation engine (build spec §5, Lesson 3 Modules 4-5). Small
   declarative rules restrict what a field may contain -- a dropdown-style
   list, or a numeric range -- same spirit as Track 3's validation rule
   objects. Pure functions, no DOM coupling, so both the "set up
   validation" module and the "fix invalid entries" module can reuse the
   same rule objects.
   UMD-wrapped like the other engines. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SM = root.SM || {};
        root.SM.validationEngine = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    "use strict";

    /* Rule shapes:
       { field, type: 'list', options: ['Present','Absent','Late'], message? }
       { field, type: 'range', min, max, message? } */
    function validateField(value, rule) {
        if (rule.type === 'list') {
            const val = String(value == null ? '' : value).trim();
            const ok = rule.options.some(o => String(o).toLowerCase() === val.toLowerCase());
            return { valid: ok, message: ok ? '' : (rule.message || `Must be one of: ${rule.options.join(', ')}.`) };
        }
        if (rule.type === 'range') {
            const n = Number(value);
            const ok = value !== '' && value !== null && value !== undefined && !isNaN(n) && n >= rule.min && n <= rule.max;
            return { valid: ok, message: ok ? '' : (rule.message || `Must be a number between ${rule.min} and ${rule.max}.`) };
        }
        return { valid: true, message: '' };
    }

    /* validateRecord(record, rules) -> [{ field, valid, message }] --
       one result per rule, in rule order. */
    function validateRecord(record, rules) {
        return rules.map(rule => Object.assign({ field: rule.field }, validateField(record[rule.field], rule)));
    }

    function isRecordValid(record, rules) {
        return validateRecord(record, rules).every(r => r.valid);
    }

    return { validateField, validateRecord, isRecordValid };
});

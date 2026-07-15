/* Functional pipeline composition (spec §5, Lesson 3 Modules 3, 4, 7).
   A library of small, pure string -> string formatter functions plus
   a pipeline() composer, so "cleaning a field" is literally running
   it through an ordered list of functions rather than one bespoke
   per-field routine. */
(function (global) {
    "use strict";

    function pipeline(...fns) {
        return (input) => fns.reduce((value, fn) => fn(value), input);
    }

    function trimWhitespace(s) {
        return String(s == null ? '' : s).trim();
    }

    function collapseInternalSpaces(s) {
        return String(s == null ? '' : s).replace(/ {2,}/g, ' ');
    }

    // Accepts DD/MM/YYYY or YYYY-MM-DD; always outputs YYYY-MM-DD.
    function standardizeDate(s) {
        const str = String(s == null ? '' : s).trim();
        const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
        if (iso) return str;
        const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
        if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
        return str;
    }

    // Accepts "01712-345678" or "+880-1712-345678"; always outputs with the +880 country code.
    function standardizePhone(s) {
        const digits = String(s == null ? '' : s).replace(/[^\d]/g, '');
        let local = digits;
        if (local.startsWith('880')) local = local.slice(3);
        if (local.startsWith('0')) local = local.slice(1);
        if (local.length < 9) return String(s == null ? '' : s).trim();
        return `+880-${local.slice(0, 4)}-${local.slice(4)}`;
    }

    function standardizeTitleCase(s) {
        return String(s == null ? '' : s).trim().toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase());
    }

    global.T3 = global.T3 || {};
    global.T3.pipeline = {
        pipeline,
        trimWhitespace,
        collapseInternalSpaces,
        standardizeDate,
        standardizePhone,
        standardizeTitleCase
    };
})(window);

/* Lightweight template-based instruction parser (Lesson 2 Module 2).
   Recognizes "<Verb> the <field phrase> to <value>" across many verb and
   field-phrase variants from a single parser, rather than one hardcoded
   instruction per screen. */
(function (global) {
    "use strict";

    const VERB = '(?:update|change|set|correct|fix)';
    const PATTERN = new RegExp('^\\s*' + VERB + '\\s+the\\s+(.+?)\\s+to\\s+(.+?)\\s*\\.?\\s*$', 'i');

    function parseInstruction(text, fieldSynonyms) {
        const match = PATTERN.exec(text || '');
        if (!match) return { matched: false };
        const fieldPhrase = match[1].trim().toLowerCase();
        const value = match[2].trim();
        const fieldKey = (fieldSynonyms && fieldSynonyms[fieldPhrase]) || null;
        return { matched: true, fieldPhrase: fieldPhrase, fieldKey: fieldKey, value: value };
    }

    global.T3 = global.T3 || {};
    global.T3.parseInstruction = parseInstruction;
})(window);

/* Dictionary-based spelling checker (spec §2.3) — deliberately narrow scope.
   Tokenizes text, flags any word not found in the bundled common-word set,
   with an allowance for capitalized words (likely proper nouns) so it
   doesn't over-flag names.

   Explicit limit, stated here and surfaced in the UI: this catches likely
   misspellings of COMMON words via a lookup set. It is not a grammar
   checker and will not catch usage errors ("their" vs "there" both pass —
   both are real dictionary words). Don't oversell what a lookup-based
   checker can do. */
(function (global) {
    "use strict";

    if (!global.PS || !global.PS.DICTIONARY_WORDS) {
        throw new Error('spellChecker.js requires data/dictionary.js to be loaded first.');
    }

    const DICTIONARY = new Set(global.PS.DICTIONARY_WORDS);
    // A tiny set of contraction fragments that tokenize out from words like
    // "don't" / "it's" and would otherwise false-flag on the dictionary lookup.
    const CONTRACTION_FRAGMENTS = new Set(['t', 's', 're', 've', 'll', 'd', 'm']);

    function tokenize(text) {
        const tokens = [];
        const re = /[A-Za-z']+/g;
        let m;
        while ((m = re.exec(text)) !== null) {
            tokens.push({ word: m[0], index: m.index });
        }
        return tokens;
    }

    function isKnown(word) {
        const lower = word.toLowerCase();
        if (DICTIONARY.has(lower)) return true;
        if (CONTRACTION_FRAGMENTS.has(lower)) return true;
        if (/^\d+$/.test(word)) return true;
        return false;
    }

    function looksLikeProperNoun(word) {
        return /^[A-Z]/.test(word) && word.length > 1;
    }

    /**
     * @returns {{word:string, index:number, reason:string}[]} flagged words with position
     */
    function check(text) {
        const flagged = [];
        tokenize(text).forEach(({ word, index }) => {
            if (word.length < 2) return;
            if (isKnown(word)) return;
            if (looksLikeProperNoun(word)) return; // allowance for likely proper nouns
            flagged.push({ word, index, reason: 'not found in common-word dictionary' });
        });
        return flagged;
    }

    global.PS = global.PS || {};
    global.PS.spellChecker = { check, isKnown, tokenize, DICTIONARY_SIZE: DICTIONARY.size };
})(window);

/* Filler-word / clarity classifier — a small lexicon of filler words/
   phrases plus a run-on-sentence length check, returning flagged phrases
   with position (same shape as the spelling checker's flag list, and the
   same architecture as any lexicon-based classifier elsewhere in this app:
   a fixed word/phrase set matched against tokenized text, not a model). */
(function (global) {
    "use strict";

    const FILLER_PHRASES = [
        'um', 'uh', 'er', 'ah', 'like', 'you know', 'kind of', 'sort of',
        'basically', 'actually', 'literally', 'i mean', 'so yeah', 'right',
        'just', 'stuff like that', 'or whatever', 'i guess', 'anyway'
    ];
    const RUN_ON_WORD_LIMIT = 30;

    function findPhraseFlags(text) {
        const flags = [];
        const lower = text.toLowerCase();
        FILLER_PHRASES.forEach(phrase => {
            const re = new RegExp('\\b' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
            let m;
            while ((m = re.exec(lower)) !== null) {
                flags.push({ phrase, index: m.index, length: phrase.length, type: 'filler' });
            }
        });
        return flags.sort((a, b) => a.index - b.index);
    }

    function findRunOnSentences(text) {
        const sentences = [];
        let start = 0;
        const re = /[.!?]+/g;
        let m;
        while ((m = re.exec(text)) !== null) {
            sentences.push({ text: text.slice(start, m.index), start, end: m.index });
            start = re.lastIndex;
        }
        if (start < text.length) sentences.push({ text: text.slice(start), start, end: text.length });
        return sentences
            .map(s => ({ ...s, wordCount: s.text.trim().split(/\s+/).filter(Boolean).length }))
            .filter(s => s.wordCount > RUN_ON_WORD_LIMIT);
    }

    function classify(text) {
        return {
            fillerFlags: findPhraseFlags(text),
            runOnSentences: findRunOnSentences(text),
            runOnLimit: RUN_ON_WORD_LIMIT
        };
    }

    global.PS = global.PS || {};
    global.PS.fillerWordClassifier = { classify, FILLER_PHRASES, RUN_ON_WORD_LIMIT };
})(window);

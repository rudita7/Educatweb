/* Simplified Flesch-Kincaid-style readability heuristic (spec §2.2).
   A genuine small algorithm — sentence length + average syllable count —
   not a hardcoded threshold on word count. Runs entirely client-side on
   whatever text a learner has typed (a slide or a script excerpt). */
(function (global) {
    "use strict";

    const VOWEL_GROUPS = /[aeiouy]+/g;

    // Counts syllables by counting vowel-groups in a word, then applying a
    // couple of common English corrections (silent trailing "e"). It's a
    // heuristic, not a dictionary lookup — good enough to estimate reading
    // difficulty without shipping a pronunciation model to a low-RAM device.
    function countSyllables(word) {
        const w = String(word).toLowerCase().replace(/[^a-z]/g, '');
        if (!w) return 0;
        const groups = w.match(VOWEL_GROUPS) || [];
        let count = groups.length;
        if (w.length > 2 && w.endsWith('e') && !w.endsWith('le')) count--;
        return Math.max(count, 1);
    }

    function splitSentences(text) {
        return String(text).split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    }

    function splitWords(text) {
        return String(text).split(/\s+/).map(w => w.replace(/[^a-zA-Z']/g, '')).filter(Boolean);
    }

    function levelFor(fkGrade) {
        if (fkGrade <= 6) return 'easy';
        if (fkGrade <= 10) return 'moderate';
        return 'hard';
    }

    const LEVEL_FEEDBACK = {
        easy: 'This is easy to follow at speaking pace — a good fit for something your audience only hears once.',
        moderate: 'This is reasonably clear, but a few shorter sentences and simpler words would make it even easier to follow out loud.',
        hard: 'This reads at a fairly advanced level for spoken delivery — try shorter sentences and swap in simpler, everyday words.'
    };

    function analyze(text) {
        const sentences = splitSentences(text);
        const words = splitWords(text);
        const sentenceCount = Math.max(sentences.length, 1);
        const wordCount = Math.max(words.length, 1);
        const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);

        const avgWordsPerSentence = wordCount / sentenceCount;
        const avgSyllablesPerWord = syllableCount / wordCount;
        // Flesch-Kincaid Grade Level formula.
        const fkGradeRaw = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
        const fkGrade = Math.max(Math.round(fkGradeRaw * 10) / 10, 0);
        const level = levelFor(fkGrade);

        return {
            sentenceCount: sentences.length,
            wordCount: words.length,
            syllableCount,
            avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
            avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
            fkGrade,
            level,
            feedback: LEVEL_FEEDBACK[level]
        };
    }

    global.PS = global.PS || {};
    global.PS.readability = { analyze, countSyllables };
})(window);

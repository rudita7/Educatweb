/* Slide + deck design rule engine (spec §2.2). Reuses Track 3's rule-engine
   interface exactly — evaluateRules(record, rules) / summarize(results),
   loaded from track3/shared/engines/ruleEngine.js — rather than
   reimplementing a second interpreter. This file only supplies the
   declarative rule *lists* for the "slide" and "deck" record shapes and
   thin evaluate*() convenience wrappers. No deviation from the shared
   engine's interface. */
(function (global) {
    "use strict";

    if (!global.T3 || !global.T3.ruleEngine) {
        throw new Error('slideRuleEngine.js requires track3/shared/engines/ruleEngine.js to be loaded first.');
    }

    function wordCount(s) { return s.trim().split(/\s+/).filter(Boolean).length; }

    const SLIDE_RULES = [
        {
            id: 'slide-has-headline',
            check: slide => slide.layout === 'sectionHeader' && !slide.headline
                ? true // section headers are optional dividers; still nudged by the same check when text exists
                : !!(slide.headline && slide.headline.trim().length > 0),
            message: 'Give this slide a clear headline — without one, the audience doesn’t know what point you’re making before you’ve said a word.'
        },
        {
            id: 'slide-not-overcrowded',
            check: slide => slide.bullets.length <= (slide.bulletLimit || 4),
            message: 'Try cutting this down to your top points — a slide with too many bullets is hard for an audience to follow.'
        },
        {
            id: 'slide-bullets-not-empty',
            check: slide => slide.bullets.every(b => b.trim().length > 0),
            message: 'Remove any empty bullets before moving on.'
        },
        {
            id: 'slide-bullets-concise',
            check: slide => slide.bullets.every(b => wordCount(b) <= 10),
            message: 'Keep each bullet short (10 words or fewer) — a long sentence on a slide competes with what you’re saying out loud.'
        },
        {
            id: 'animation-not-excessive',
            check: slide => (slide.animations || []).length <= 2,
            message: 'Too many animated objects can distract from your message — try keeping it to one or two.'
        }
    ];

    function evaluateSlide(slide) {
        return global.T3.ruleEngine.evaluateRules(slide, SLIDE_RULES);
    }

    // Deck-level rules check *consistency across* slides, not any one slide in isolation —
    // the "structural consistency check" called for in Lesson 5 Module 1.
    const DECK_RULES = [
        {
            id: 'deck-headline-style-consistent',
            check: deck => {
                const styles = new Set(deck.slides.filter(s => s.headline && s.headline.trim()).map(s => s.headlineStyle || 'large'));
                return styles.size <= 1;
            },
            message: 'Your headline style changes between slides — pick one style (e.g. all large & bold) and keep it consistent across the deck.'
        },
        {
            id: 'deck-bullet-punctuation-consistent',
            check: deck => {
                const bullets = deck.slides.flatMap(s => s.bullets).map(b => b.trim()).filter(Boolean);
                if (bullets.length < 2) return true;
                const endsWithPunct = bullets.map(b => /[.!?]$/.test(b));
                return endsWithPunct.every(v => v === endsWithPunct[0]);
            },
            message: 'Some bullets end with punctuation and some don’t — pick one style and use it for every bullet in the deck.'
        }
    ];

    function evaluateDeck(deck) {
        return global.T3.ruleEngine.evaluateRules(deck, DECK_RULES);
    }

    global.PS = global.PS || {};
    global.PS.slideRuleEngine = {
        SLIDE_RULES,
        DECK_RULES,
        evaluateSlide,
        evaluateDeck,
        summarize: global.T3.ruleEngine.summarize
    };
})(window);

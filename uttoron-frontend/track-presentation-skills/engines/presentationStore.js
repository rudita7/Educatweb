/* The presentation domain object (spec §2.1) and its storage. One deck is
   built incrementally across Lessons 1-5 and used in Lesson 6 + the
   Capstone, so — unlike the fully-isolated per-lesson records used
   elsewhere in this app — this record has to persist across page loads.
   Kept in localStorage, keyed per learner (or "guest" when signed out),
   exactly the same storage mechanism the rest of the app already uses. */
(function (global) {
    "use strict";

    const Storage = global.PS.Storage;

    const THEMES = [
        { id: 'paper-classic', name: 'Paper Classic', desc: 'Warm paper background, serif headlines — the app\'s own ledger look.', accent: '#2E7D5B', bg: '#F6F0DF', ink: '#1C2B2E', font: "'Instrument Serif', serif" },
        { id: 'marigold-fresh', name: 'Marigold Fresh', desc: 'Bright and modern, marigold accents on a clean white slide.', accent: '#E8A33D', bg: '#FFFDF7', ink: '#2a2416', font: "'Space Grotesk', sans-serif" },
        { id: 'coral-bold', name: 'Coral Bold', desc: 'High-energy coral accents — good for a confident, punchy pitch.', accent: '#E2593B', bg: '#FFF7F3', ink: '#2a1712', font: "'Space Grotesk', sans-serif" },
        { id: 'midnight-mono', name: 'Midnight Mono', desc: 'Understated and technical — monospace headlines, muted ink.', accent: '#14313B', bg: '#F2F1EA', ink: '#14313B', font: "'IBM Plex Mono', monospace" }
    ];

    const LAYOUTS = [
        { id: 'title', name: 'Title Slide', icon: '🏷️', desc: 'A big headline and a subtitle — for your opening slide.', maxBullets: 0, hasImage: false, hasChart: false },
        { id: 'titleContent', name: 'Title + Content', icon: '📋', desc: 'A headline with a bulleted list below it — the workhorse layout.', maxBullets: 4, hasImage: false, hasChart: true },
        { id: 'twoContent', name: 'Two Content', icon: '🗂️', desc: 'A headline with a bulleted list next to an image or icon.', maxBullets: 4, hasImage: true, hasChart: true },
        { id: 'imageOnly', name: 'Image Only', icon: '🖼️', desc: 'A single large image or icon with a short caption headline.', maxBullets: 0, hasImage: true, hasChart: false },
        { id: 'sectionHeader', name: 'Section Header', icon: '📌', desc: 'A short divider slide that introduces a new part of your talk.', maxBullets: 0, hasImage: false, hasChart: false }
    ];

    function layoutById(id) { return LAYOUTS.find(l => l.id === id) || LAYOUTS[1]; }
    function themeById(id) { return THEMES.find(t => t.id === id) || THEMES[0]; }

    function uid(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 9); }

    function deckKey(session) { return 'ps:deck:' + (session ? session.num : 'guest'); }

    function getDeck(session) {
        return Storage.get(deckKey(session));
    }
    function saveDeck(session, deck) {
        Storage.set(deckKey(session), deck);
        return deck;
    }
    function clearDeck(session) {
        Storage.remove(deckKey(session));
    }

    function newDeck(title, themeId) {
        return {
            id: uid('deck'),
            title: (title || 'Untitled Presentation').trim(),
            themeId: themeId || THEMES[0].id,
            slides: [],
            script: '',
            readinessScore: 0
        };
    }

    function newSlide(layoutId) {
        const layout = layoutById(layoutId);
        return {
            id: uid('slide'),
            layout: layout.id,
            headline: '',
            headlineStyle: 'large',
            bullets: [],
            bulletLimit: layout.maxBullets || 4,
            imageId: null,
            chartData: null,
            transition: 'none',
            animations: [],
            speakerNotes: ''
        };
    }

    // Concatenates every slide's speaker notes into a single practice script —
    // used to prefill Lesson 6's pacing practice (spec §8, Module 3 note).
    function scriptFromNotes(deck) {
        return deck.slides
            .map(s => (s.speakerNotes || '').trim())
            .filter(Boolean)
            .join('\n\n');
    }

    // Shared "which deck am I editing" status strip, shown near the top of
    // Lessons 2-6 and the Capstone — every one of those pages needs this,
    // so it lives here once instead of six near-identical copies.
    function deckStatusHtml(deck, opts) {
        opts = opts || {};
        const esc = global.PS.escapeHtml;
        if (!deck) {
            return `<div class="deck-status missing">⚠️ No deck found yet — <a href="${opts.lesson1Href || '../lesson1/index.html'}">start Lesson 1</a> to create one first.</div>`;
        }
        const theme = themeById(deck.themeId);
        return `<div class="deck-status"><span class="deck-status-title">📽️ ${esc(deck.title)}</span><span class="deck-status-meta">${esc(theme.name)} · ${deck.slides.length} slide${deck.slides.length === 1 ? '' : 's'}</span></div>`;
    }

    global.PS = global.PS || {};
    global.PS.THEMES = THEMES;
    global.PS.LAYOUTS = LAYOUTS;
    global.PS.deckStore = { getDeck, saveDeck, clearDeck, newDeck, newSlide, layoutById, themeById, uid, scriptFromNotes, deckStatusHtml };
})(window);

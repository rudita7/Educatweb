/* Local image/icon library (spec §2.5) — the offline-appropriate substitute
   for "search online pictures." A small bundled set, each with a stable id
   so a slide can reference one (slide.imageId) without embedding any binary
   asset or making a network request. */
(function (global) {
    "use strict";

    const ICONS = [
        { id: 'shop', emoji: '🏪', label: 'Shop' },
        { id: 'phone', emoji: '📱', label: 'Mobile phone' },
        { id: 'money', emoji: '💵', label: 'Money' },
        { id: 'chart-up', emoji: '📈', label: 'Growth' },
        { id: 'people', emoji: '👥', label: 'People' },
        { id: 'handshake', emoji: '🤝', label: 'Agreement' },
        { id: 'idea', emoji: '💡', label: 'Idea' },
        { id: 'clock', emoji: '⏰', label: 'Time' },
        { id: 'target', emoji: '🎯', label: 'Goal' },
        { id: 'shield', emoji: '🛡️', label: 'Safety' },
        { id: 'book', emoji: '📚', label: 'Learning' },
        { id: 'laptop', emoji: '💻', label: 'Computer' },
        { id: 'chat', emoji: '💬', label: 'Conversation' },
        { id: 'star', emoji: '⭐', label: 'Quality' },
        { id: 'tools', emoji: '🛠️', label: 'Tools' },
        { id: 'leaf', emoji: '🌱', label: 'Growth (nature)' },
        { id: 'globe', emoji: '🌍', label: 'Community' },
        { id: 'chart-bar', emoji: '📊', label: 'Data' },
        { id: 'calendar', emoji: '📅', label: 'Schedule' },
        { id: 'lightbulb-off', emoji: '⚡', label: 'Energy / power' },
        { id: 'family', emoji: '👨‍👩‍👧', label: 'Family' },
        { id: 'graduation', emoji: '🎓', label: 'Achievement' },
        { id: 'lock', emoji: '🔒', label: 'Security' },
        { id: 'map', emoji: '🗺️', label: 'Plan / route' }
    ];

    function iconById(id) { return ICONS.find(i => i.id === id) || null; }

    global.PS = global.PS || {};
    global.PS.ICONS = ICONS;
    global.PS.iconById = iconById;
})(window);

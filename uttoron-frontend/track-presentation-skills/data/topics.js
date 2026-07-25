/* Topic bank (spec §4, Lesson 2 Module 3) — the learner picks one of these
   for their skeleton deck, or writes their own. Kept relevant to the same
   everyday/small-business scenarios used across this app's other tracks. */
(function (global) {
    "use strict";

    const TOPICS = [
        { id: 'mobile-payments', title: 'Why our shop should accept mobile payments', audience: 'Shop owner and staff' },
        { id: 'new-product', title: 'Introducing our new product to customers', audience: 'Regular customers' },
        { id: 'internet-safety', title: 'Staying safe online for first-time internet users', audience: 'New computer users at the community center' },
        { id: 'earlier-hours', title: 'Why we should open two hours earlier', audience: 'Shop co-owners' },
        { id: 'save-water', title: 'Simple ways our neighborhood can save water', audience: 'Local community group' },
        { id: 'job-application', title: 'How to prepare a strong job application', audience: 'Fellow students finishing the program' },
        { id: 'recycling', title: 'Starting a small recycling effort at the market', audience: 'Fellow market vendors' },
        { id: 'own-topic', title: 'Write your own topic', audience: '' }
    ];

    global.PS = global.PS || {};
    global.PS.TOPICS = TOPICS;
})(window);

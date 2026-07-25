/* Q&A readiness engine (spec §2.9) — a finite state machine, same
   architecture as track3/shared/engines/stateMachine.js (constructor +
   allowedTransitions()/can()/transition() prototype methods, a transition
   log), but with its own transition table since this flow's states don't
   match a record's correction lifecycle. No existing "interview simulator"
   FSM was found elsewhere in this app to import verbatim (flagging that
   per this track's build-spec instruction to flag any deviation from a
   shared engine).

   Flow: Question -> Response -> Scored -> (FollowUp | NextQuestion) -> Closing
   FollowUp loops back into Scored; NextQuestion loops back into Question. */
(function (global) {
    "use strict";

    const TRANSITIONS = {
        'Question': ['Response'],
        'Response': ['Scored'],
        'Scored': ['FollowUp', 'NextQuestion', 'Closing'],
        'FollowUp': ['Scored'],
        'NextQuestion': ['Question'],
        'Closing': []
    };

    function QAFSM(initial) {
        this.state = initial || 'Question';
        this.log = [{ state: this.state, at: Date.now() }];
    }
    QAFSM.prototype.allowedTransitions = function () { return TRANSITIONS[this.state] || []; };
    QAFSM.prototype.can = function (next) { return this.allowedTransitions().indexOf(next) !== -1; };
    QAFSM.prototype.transition = function (next) {
        if (!this.can(next)) return { ok: false, reason: 'Cannot move from "' + this.state + '" to "' + next + '".' };
        this.state = next;
        this.log.push({ state: next, at: Date.now() });
        return { ok: true };
    };

    // A small generic question bank, tagged so questions can be loosely
    // matched to whatever the learner's deck is about — real topic
    // understanding is out of scope (spec explicitly excludes full NLP
    // grading elsewhere in this track), so this is keyword overlap, not
    // semantic matching.
    const QUESTION_BANK = [
        { id: 'cost', text: 'What would this actually cost to put in place?', tags: ['cost', 'price', 'money', 'budget', 'fee', 'pay', 'payment'], rubric: ['cost', 'price', 'budget', 'free', 'fee', 'taka', 'month'] },
        { id: 'time', text: 'How long would this take to get up and running?', tags: ['time', 'schedule', 'when', 'launch', 'start'], rubric: ['week', 'month', 'day', 'time', 'soon', 'immediately'] },
        { id: 'risk', text: 'What could go wrong with this, and how would you handle it?', tags: ['risk', 'problem', 'fail', 'issue'], rubric: ['risk', 'problem', 'backup', 'handle', 'plan', 'issue'] },
        { id: 'evidence', text: 'What makes you confident this will actually work?', tags: ['evidence', 'proof', 'data', 'result'], rubric: ['because', 'data', 'result', 'showed', 'tested', 'evidence'] },
        { id: 'audience', text: 'Who exactly benefits from this, and who might not?', tags: ['audience', 'customer', 'who', 'benefit'], rubric: ['customer', 'shop', 'benefit', 'everyone', 'people'] },
        { id: 'alternative', text: 'Why this option instead of just continuing what we do now?', tags: ['alternative', 'compare', 'why', 'instead'], rubric: ['because', 'instead', 'better', 'compare', 'current'] }
    ];

    function extractKeywords(text) {
        const STOP = new Set(['this', 'that', 'with', 'from', 'your', 'have', 'will', 'about', 'into', 'they', 'them', 'when', 'what', 'which', 'there', 'their', 'would', 'could', 'should']);
        return Array.from(new Set((String(text).toLowerCase().match(/[a-z']+/g) || []))).filter(w => w.length >= 3 && !STOP.has(w));
    }

    function pickQuestions(topicText, count) {
        const kws = extractKeywords(topicText);
        const scored = QUESTION_BANK.map(q => ({
            q, score: q.tags.reduce((s, t) => s + (kws.includes(t) ? 1 : 0), 0) + Math.random() * 0.5
        }));
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, count || 3).map(s => s.q);
    }

    // Keyword/rubric scoring (spec: "Scored via keyword/rubric match", not free-text NLU).
    function scoreResponse(question, responseText) {
        const text = String(responseText).toLowerCase();
        const hits = question.rubric.filter(kw => text.includes(kw));
        const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
        const substantive = wordCount >= 6;
        const passed = hits.length > 0 && substantive;
        return { passed, hits, wordCount, rubricSize: question.rubric.length };
    }

    global.PS = global.PS || {};
    global.PS.QAFSM = QAFSM;
    global.PS.qaBank = { QUESTION_BANK, pickQuestions, scoreResponse, extractKeywords };
})(window);

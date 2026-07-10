/* Record lifecycle finite state machine (spec §2.6).
   Pending -> In Review -> (Corrected | Flagged for Supervisor) -> Validated -> Submitted
   Drives every "Workplace Simulation" module across Track 3. */
(function (global) {
    "use strict";

    const TRANSITIONS = {
        'Pending': ['In Review'],
        'In Review': ['Corrected', 'Flagged for Supervisor'],
        'Corrected': ['Validated'],
        'Flagged for Supervisor': ['Validated'],
        'Validated': ['Submitted'],
        'Submitted': []
    };

    function RecordFSM(initial) {
        this.state = initial || 'Pending';
        this.log = [{ state: this.state, at: Date.now() }];
    }

    RecordFSM.prototype.allowedTransitions = function () {
        return TRANSITIONS[this.state] || [];
    };

    RecordFSM.prototype.can = function (next) {
        return this.allowedTransitions().indexOf(next) !== -1;
    };

    RecordFSM.prototype.transition = function (next) {
        if (!this.can(next)) {
            return { ok: false, reason: 'Cannot move from "' + this.state + '" to "' + next + '".' };
        }
        this.state = next;
        this.log.push({ state: next, at: Date.now() });
        return { ok: true };
    };

    global.T3 = global.T3 || {};
    global.T3.RecordFSM = RecordFSM;
    global.T3.RECORD_STATES = Object.keys(TRANSITIONS);
})(window);

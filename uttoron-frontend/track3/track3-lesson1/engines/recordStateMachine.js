const RECORD_STATES = {
    PENDING: 'Pending',
    IN_REVIEW: 'In Review',
    CORRECTED: 'Corrected',
    FLAGGED_FOR_SUPERVISOR: 'Flagged for Supervisor',
    VALIDATED: 'Validated',
    SUBMITTED: 'Submitted'
};

const TRANSITIONS = {
    [RECORD_STATES.PENDING]: [RECORD_STATES.IN_REVIEW],
    [RECORD_STATES.IN_REVIEW]: [RECORD_STATES.CORRECTED, RECORD_STATES.FLAGGED_FOR_SUPERVISOR],
    [RECORD_STATES.CORRECTED]: [RECORD_STATES.VALIDATED],
    [RECORD_STATES.FLAGGED_FOR_SUPERVISOR]: [RECORD_STATES.VALIDATED],
    [RECORD_STATES.VALIDATED]: [RECORD_STATES.SUBMITTED],
    [RECORD_STATES.SUBMITTED]: [] // Terminal state
};

class RecordStateMachine {
    constructor(initialState = RECORD_STATES.PENDING) {
        if (!Object.values(RECORD_STATES).includes(initialState)) {
            throw new Error(`Invalid initial state: ${initialState}`);
        }
        this.currentState = initialState;
    }

    transitionTo(newState) {
        if (!Object.values(RECORD_STATES).includes(newState)) {
            throw new Error(`Invalid target state: ${newState}`);
        }
        if (TRANSITIONS[this.currentState].includes(newState)) {
            this.currentState = newState;
            return true;
        } else {
            console.warn(`Invalid transition from ${this.currentState} to ${newState}`);
            return false;
        }
    }

    getCurrentState() {
        return this.currentState;
    }

    getAllowedTransitions() {
        return TRANSITIONS[this.currentState];
    }

    isTerminalState() {
        return TRANSITIONS[this.currentState].length === 0;
    }
}

export { RecordStateMachine, RECORD_STATES };

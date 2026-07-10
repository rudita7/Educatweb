import { RecordStateMachine, RECORD_STATES } from '../engines/recordStateMachine.js';

class WorkplaceSimulation {
    constructor(records) {
        this.records = records.map(record => ({
            ...record,
            stateMachine: new RecordStateMachine(RECORD_STATES.PENDING),
            id: record.id || `REC-${Math.random().toString(36).substr(2, 9)}`
        }));
        this.completionStats = {
            totalRecords: this.records.length,
            corrected: 0,
            flagged: 0,
            submitted: 0
        };
    }

    updateRecordState(recordIndex, newState) {
        if (recordIndex < 0 || recordIndex >= this.records.length) {
            throw new Error('Invalid record index');
        }

        const record = this.records[recordIndex];
        const success = record.stateMachine.transitionTo(newState);

        if (success) {
            // Update completion stats
            if (newState === RECORD_STATES.CORRECTED) {
                this.completionStats.corrected++;
            } else if (newState === RECORD_STATES.FLAGGED_FOR_SUPERVISOR) {
                this.completionStats.flagged++;
            } else if (newState === RECORD_STATES.SUBMITTED) {
                this.completionStats.submitted++;
            }
        }

        return success;
    }

    getRecordState(recordIndex) {
        if (recordIndex < 0 || recordIndex >= this.records.length) {
            throw new Error('Invalid record index');
        }
        return this.records[recordIndex].stateMachine.getCurrentState();
    }

    getAllowedTransitions(recordIndex) {
        if (recordIndex < 0 || recordIndex >= this.records.length) {
            throw new Error('Invalid record index');
        }
        return this.records[recordIndex].stateMachine.getAllowedTransitions();
    }

    isSimulationComplete() {
        return this.records.every(record => record.stateMachine.isTerminalState());
    }

    getCompletionStats() {
        return {
            ...this.completionStats,
            percentageComplete: Math.round((this.completionStats.submitted / this.completionStats.totalRecords) * 100)
        };
    }

    getRecords() {
        return this.records;
    }

    reset() {
        this.records.forEach(record => {
            record.stateMachine = new RecordStateMachine(RECORD_STATES.PENDING);
        });
        this.completionStats = {
            totalRecords: this.records.length,
            corrected: 0,
            flagged: 0,
            submitted: 0
        };
    }
}

export { WorkplaceSimulation };

// Module 6: Workplace Simulation
// Purpose: Learner manages a batch of records through the state machine workflow

import { WorkplaceSimulation } from '../../components/WorkplaceSimulation.js';
import { RECORD_STATES } from '../../engines/recordStateMachine.js';

class Module6 {
    constructor(errorInjectionEngine, sampleRecords) {
        this.title = 'Module 6: Workplace Simulation';
        this.errorInjectionEngine = errorInjectionEngine;
        this.sampleRecords = sampleRecords;
        this.completed = false;
        this.simulation = null;
        this.score = 0;
    }

    // See Module 3/4 for why this retries: not every (errorType, field) pair is
    // supported by the injection engine, so a naive single attempt can silently
    // no-op and hand back an uncorrupted record while the caller still expects one.
    injectRandom(record, errorTypes, fields) {
        for (let attempt = 0; attempt < 30; attempt++) {
            const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
            const field = fields[Math.floor(Math.random() * fields.length)];
            let result;
            switch (errorType) {
                case 'typo':
                    result = this.errorInjectionEngine.injectTypo(record, field);
                    break;
                case 'missing':
                    result = this.errorInjectionEngine.injectMissingField(record, field);
                    break;
                case 'logical':
                    result = this.errorInjectionEngine.injectLogicalViolation(record, field);
                    break;
            }
            if (result && result.groundTruthDiff) return result;
        }
        return this.errorInjectionEngine.injectMissingField(record, fields[0]);
    }

    generateBatch(numRecords = 5) {
        const domains = ['invoice', 'attendance', 'inventory'];
        const records = [];

        for (let i = 0; i < numRecords; i++) {
            const domain = domains[i % domains.length];
            const record = JSON.parse(JSON.stringify(this.sampleRecords[domain]));

            // Inject errors into some records
            if (Math.random() > 0.5) {
                const errorTypes = ['typo', 'missing', 'logical'];
                const fields = Object.keys(record).filter(k => k !== 'id' && k !== 'status' && k !== 'lineItems');
                const result = this.injectRandom(record, errorTypes, fields);
                records.push(result.corruptedRecord);
            } else {
                records.push(record);
            }
        }

        this.simulation = new WorkplaceSimulation(records);
        return this.simulation.getRecords();
    }

    updateRecordState(recordIndex, newState) {
        if (!this.simulation) return false;
        return this.simulation.updateRecordState(recordIndex, newState);
    }

    getRecordState(recordIndex) {
        if (!this.simulation) return null;
        return this.simulation.getRecordState(recordIndex);
    }

    getAllowedTransitions(recordIndex) {
        if (!this.simulation) return [];
        return this.simulation.getAllowedTransitions(recordIndex);
    }

    isSimulationComplete() {
        if (!this.simulation) return false;
        return this.simulation.isSimulationComplete();
    }

    submitBatch() {
        if (!this.simulation || !this.isSimulationComplete()) {
            return {
                success: false,
                message: 'Not all records have been submitted. Continue processing the batch.'
            };
        }

        const stats = this.simulation.getCompletionStats();
        this.score = stats.percentageComplete;

        return {
            success: true,
            message: 'Batch submitted successfully!',
            stats: stats
        };
    }

    getRecords() {
        if (!this.simulation) return [];
        return this.simulation.getRecords();
    }

    getStats() {
        if (!this.simulation) return null;
        return this.simulation.getCompletionStats();
    }

    reset() {
        if (this.simulation) {
            this.simulation.reset();
        }
        this.score = 0;
    }

    markComplete() {
        this.completed = true;
    }

    isComplete() {
        return this.completed;
    }
}

export { Module6 };

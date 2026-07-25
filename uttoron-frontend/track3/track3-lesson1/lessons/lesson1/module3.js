// Module 3: Spot the Error
// Purpose: Render a record; learner clicks the field(s) they believe are wrong

import { SpotTheError } from '../../components/SpotTheError.js';

class Module3 {
    constructor(errorInjectionEngine, sampleRecords) {
        this.title = 'Module 3: Spot the Error';
        this.errorInjectionEngine = errorInjectionEngine;
        this.sampleRecords = sampleRecords;
        this.completed = false;
        this.difficulty = 1; // Scales with learner progress
        this.currentActivity = null;
        this.score = 0;
        this.attempts = 0;
    }

    // Not every (errorType, field) pair is actually supported by the injection
    // engine (e.g. format-inconsistency only understands invoiceDate/checkIn) --
    // unsupported combos silently no-op and return a null groundTruthDiff. Retry
    // with a fresh random pair until one actually produces a corruption, instead
    // of ever handing back a "corrupted" record with nothing wrong with it.
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
                case 'format':
                    result = this.errorInjectionEngine.injectFormatInconsistency(record, field);
                    break;
                case 'whitespace':
                    result = this.errorInjectionEngine.injectExtraWhitespace(record, field);
                    break;
            }
            if (result && result.groundTruthDiff) return result;
        }
        // injectMissingField always succeeds for any field, so this is a
        // guaranteed-safe fallback if 30 random attempts all missed.
        return this.errorInjectionEngine.injectMissingField(record, fields[0]);
    }

    generateActivity() {
        // Select a random record domain
        const domains = ['invoice', 'attendance', 'inventory'];
        const domain = domains[Math.floor(Math.random() * domains.length)];
        const record = JSON.parse(JSON.stringify(this.sampleRecords[domain]));

        // Inject errors based on difficulty
        let corruptedRecord = record;
        let groundTruthDiff = null;

        if (this.difficulty === 1) {
            // Single error
            const errorTypes = ['typo', 'missing', 'format'];
            const fields = Object.keys(record).filter(k => k !== 'id' && k !== 'status' && k !== 'lineItems');
            const result = this.injectRandom(record, errorTypes, fields);
            corruptedRecord = result.corruptedRecord;
            groundTruthDiff = result.groundTruthDiff;
        } else if (this.difficulty >= 2) {
            // Multiple errors
            const errorTypes = ['typo', 'missing', 'whitespace'];
            const numErrors = Math.min(this.difficulty, 3);
            const fields = Object.keys(record).filter(k => k !== 'id' && k !== 'status' && k !== 'lineItems');

            for (let i = 0; i < numErrors && fields.length > 0; i++) {
                const fieldIdx = Math.floor(Math.random() * fields.length);
                const field = fields.splice(fieldIdx, 1)[0];
                const result = this.injectRandom(corruptedRecord, errorTypes, [field]);
                corruptedRecord = result.corruptedRecord;
                if (i === numErrors - 1) {
                    groundTruthDiff = result.groundTruthDiff;
                }
            }
        }

        this.currentActivity = new SpotTheError(corruptedRecord, groundTruthDiff);
        return {
            record: corruptedRecord,
            domain: domain,
            difficulty: this.difficulty
        };
    }

    checkAnswer() {
        if (!this.currentActivity) return null;
        this.attempts++;
        const result = this.currentActivity.checkAnswer();
        if (result.isCorrect) {
            this.score++;
            this.difficulty = Math.min(this.difficulty + 1, 5); // Cap at difficulty 5
        }
        return result;
    }

    toggleFieldSelection(fieldName) {
        if (this.currentActivity) {
            this.currentActivity.toggleFieldSelection(fieldName);
        }
    }

    getSelectedFields() {
        if (this.currentActivity) {
            return this.currentActivity.getSelectedFields();
        }
        return [];
    }

    reset() {
        if (this.currentActivity) {
            this.currentActivity.reset();
        }
    }

    markComplete() {
        this.completed = true;
    }

    isComplete() {
        return this.completed;
    }

    getStats() {
        return {
            score: this.score,
            attempts: this.attempts,
            accuracy: this.attempts > 0 ? Math.round((this.score / this.attempts) * 100) : 0,
            difficulty: this.difficulty
        };
    }
}

export { Module3 };

// Module 4: Error Hunt Challenge
// Purpose: Timed mode - learner scans and flags erroneous records before time runs out

class Module4 {
    constructor(errorInjectionEngine, sampleRecords) {
        this.title = 'Module 4: Error Hunt Challenge';
        this.errorInjectionEngine = errorInjectionEngine;
        this.sampleRecords = sampleRecords;
        this.completed = false;
        this.timeLimit = 120; // 2 minutes in seconds
        this.records = [];
        this.flaggedRecords = new Set();
        this.score = 0;
        this.timeSpent = 0;
        this.active = false;
    }

    generateChallenge(numRecords = 8) {
        this.records = [];
        const domains = ['invoice', 'attendance', 'inventory'];

        for (let i = 0; i < numRecords; i++) {
            const domain = domains[i % domains.length];
            const record = JSON.parse(JSON.stringify(this.sampleRecords[domain]));

            let hasError = Math.random() > 0.4; // 60% of records have errors
            let corruptedRecord = record;
            let groundTruthDiff = null;

            if (hasError) {
                const errorTypes = ['typo', 'missing', 'format', 'whitespace', 'logical'];
                const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
                const fields = Object.keys(record).filter(k => k !== 'id' && k !== 'status' && k !== 'lineItems');
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
                    case 'logical':
                        result = this.errorInjectionEngine.injectLogicalViolation(record, field);
                        break;
                }
                corruptedRecord = result.corruptedRecord;
                groundTruthDiff = result.groundTruthDiff;
            }

            this.records.push({
                id: record.id,
                domain: domain,
                record: corruptedRecord,
                hasError: hasError,
                groundTruthDiff: groundTruthDiff,
                isFlagged: false
            });
        }

        this.flaggedRecords.clear();
        this.score = 0;
        this.timeSpent = 0;
        return this.records;
    }

    toggleRecordFlag(recordIndex) {
        if (recordIndex < 0 || recordIndex >= this.records.length) return false;

        const record = this.records[recordIndex];
        record.isFlagged = !record.isFlagged;

        if (record.isFlagged) {
            this.flaggedRecords.add(recordIndex);
        } else {
            this.flaggedRecords.delete(recordIndex);
        }

        return record.isFlagged;
    }

    startChallenge() {
        this.active = true;
        this.timeSpent = 0;
    }

    endChallenge(timeSpent) {
        this.active = false;
        this.timeSpent = timeSpent;

        // Calculate score
        let correctFlags = 0;
        let falsePositives = 0;

        for (let i = 0; i < this.records.length; i++) {
            const record = this.records[i];
            const isFlagged = this.flaggedRecords.has(i);

            if (isFlagged && record.hasError) {
                correctFlags++;
            } else if (isFlagged && !record.hasError) {
                falsePositives++;
            }
        }

        const totalErrors = this.records.filter(r => r.hasError).length;
        const accuracy = totalErrors > 0 ? Math.round((correctFlags / totalErrors) * 100) : 0;
        const precision = this.flaggedRecords.size > 0 ? Math.round((correctFlags / this.flaggedRecords.size) * 100) : 100;

        this.score = {
            correctFlags,
            falsePositives,
            totalErrors,
            accuracy,
            precision,
            timeSpent
        };

        return this.score;
    }

    getRecords() {
        return this.records;
    }

    getStats() {
        return {
            totalRecords: this.records.length,
            flaggedCount: this.flaggedRecords.size,
            score: this.score
        };
    }

    reset() {
        this.records = [];
        this.flaggedRecords.clear();
        this.score = 0;
        this.timeSpent = 0;
        this.active = false;
    }

    markComplete() {
        this.completed = true;
    }

    isComplete() {
        return this.completed;
    }
}

export { Module4 };

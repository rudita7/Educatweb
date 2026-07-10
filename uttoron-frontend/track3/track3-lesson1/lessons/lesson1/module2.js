// Module 2: Types of Errors
// Purpose: Interactive taxonomy browser with live-generated error examples

class Module2 {
    constructor(errorInjectionEngine, sampleRecords) {
        this.title = 'Module 2: Types of Errors';
        this.errorInjectionEngine = errorInjectionEngine;
        this.sampleRecords = sampleRecords;
        this.completed = false;
        this.currentErrorType = null;
        this.errorTypes = [
            { id: 'typo', name: 'Typo', description: 'A small spelling or character mistake' },
            { id: 'missing', name: 'Missing Field', description: 'A required field is blank or null' },
            { id: 'format', name: 'Format Inconsistency', description: 'Data format doesn\'t match standard' },
            { id: 'whitespace', name: 'Extra Whitespace', description: 'Unwanted spaces in data' },
            { id: 'duplicate', name: 'Duplicate', description: 'Same record entered twice' },
            { id: 'logical', name: 'Logical Violation', description: 'Data contradicts business rules' }
        ];
    }

    getErrorTypes() {
        return this.errorTypes;
    }

    generateExample(errorTypeId) {
        const errorType = this.errorTypes.find(et => et.id === errorTypeId);
        if (!errorType) return null;

        let record = JSON.parse(JSON.stringify(this.sampleRecords.invoice));
        let result;

        switch (errorTypeId) {
            case 'typo':
                result = this.errorInjectionEngine.injectTypo(record, 'customerName');
                break;
            case 'missing':
                result = this.errorInjectionEngine.injectMissingField(record, 'customerName');
                break;
            case 'format':
                result = this.errorInjectionEngine.injectFormatInconsistency(record, 'invoiceDate');
                break;
            case 'whitespace':
                result = this.errorInjectionEngine.injectExtraWhitespace(record, 'customerName');
                break;
            case 'logical':
                result = this.errorInjectionEngine.injectLogicalViolation(record, 'total');
                break;
            case 'duplicate':
                result = this.errorInjectionEngine.injectDuplicate(record, {});
                break;
            default:
                return null;
        }

        this.currentErrorType = errorTypeId;
        return {
            errorType: errorType,
            example: result.groundTruthDiff,
            record: result.corruptedRecord
        };
    }

    markComplete() {
        this.completed = true;
    }

    isComplete() {
        return this.completed;
    }
}

export { Module2 };

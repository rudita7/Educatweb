class SpotTheError {
    constructor(record, groundTruthDiff) {
        this.record = record;
        this.groundTruthDiff = groundTruthDiff;
        this.selectedFields = new Set();
    }

    toggleFieldSelection(fieldName) {
        if (this.selectedFields.has(fieldName)) {
            this.selectedFields.delete(fieldName);
        } else {
            this.selectedFields.add(fieldName);
        }
    }

    checkAnswer() {
        if (!this.groundTruthDiff) {
            return { isCorrect: false, message: 'No errors in this record.' };
        }

        const correctField = this.groundTruthDiff.field;
        const hasSelectedCorrectField = this.selectedFields.has(correctField);
        const hasSelectedOnlyCorrectField = this.selectedFields.size === 1;

        if (hasSelectedCorrectField && hasSelectedOnlyCorrectField) {
            return {
                isCorrect: true,
                message: `Correct! You identified the error in the "${correctField}" field. The value "${this.groundTruthDiff.corrupted}" should be "${this.groundTruthDiff.original}".`,
                diff: this.groundTruthDiff
            };
        } else if (hasSelectedCorrectField) {
            return {
                isCorrect: false,
                message: `You found the error in "${correctField}", but you also selected other fields. Try again, selecting only the field with the error.`,
                diff: this.groundTruthDiff
            };
        } else {
            return {
                isCorrect: false,
                message: `Not quite. The error is in the "${correctField}" field. Look for the difference: "${this.groundTruthDiff.corrupted}" vs "${this.groundTruthDiff.original}".`,
                diff: this.groundTruthDiff
            };
        }
    }

    reset() {
        this.selectedFields.clear();
    }

    getSelectedFields() {
        return Array.from(this.selectedFields);
    }
}

export { SpotTheError };

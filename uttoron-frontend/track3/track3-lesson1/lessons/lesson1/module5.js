// Module 5: Prioritizing Errors
// Purpose: Learner ranks errors by severity using a priority queue

import { PriorityQueue } from '../../components/PriorityQueue.js';

class Module5 {
    constructor() {
        this.title = 'Module 5: Prioritizing Errors';
        this.completed = false;
        this.priorityQueue = null;
        this.userOrder = [];
        this.score = 0;
    }

    generateErrorList() {
        const errors = [
            {
                id: 1,
                description: 'Invoice total mismatch ($4300 vs $4250)',
                severity: 'Critical',
                impact: 'Financial discrepancy, affects accounting',
                field: 'total'
            },
            {
                id: 2,
                description: 'Employee name missing in attendance record',
                severity: 'High',
                impact: 'Cannot identify employee, payroll impact',
                field: 'employeeName'
            },
            {
                id: 3,
                description: 'Inventory date format inconsistency (15/01/2024 vs 2024-01-15)',
                severity: 'Medium',
                impact: 'System parsing issues, may cause import failures',
                field: 'lastUpdated'
            },
            {
                id: 4,
                description: 'Extra whitespace in customer name ("  Rahman  ")',
                severity: 'Low',
                impact: 'Cosmetic issue, doesn\'t affect functionality',
                field: 'customerName'
            },
            {
                id: 5,
                description: 'Duplicate inventory record for same SKU',
                severity: 'High',
                impact: 'Double-counts stock, affects ordering',
                field: 'sku'
            },
            {
                id: 6,
                description: 'Check-out time earlier than check-in time',
                severity: 'Critical',
                impact: 'Invalid time data, breaks attendance logic',
                field: 'checkOut'
            }
        ];

        // Shuffle the errors for display
        const shuffled = errors.sort(() => Math.random() - 0.5);
        this.priorityQueue = new PriorityQueue(shuffled);
        this.userOrder = [];

        return shuffled;
    }

    recordUserOrder(orderedIds) {
        this.userOrder = orderedIds;
    }

    checkOrder() {
        const correctOrder = [6, 1, 2, 5, 3, 4]; // Critical, Critical, High, High, Medium, Low

        let isCorrect = true;
        let score = 0;

        for (let i = 0; i < Math.min(correctOrder.length, this.userOrder.length); i++) {
            if (this.userOrder[i] === correctOrder[i]) {
                score++;
            } else {
                isCorrect = false;
            }
        }

        this.score = Math.round((score / correctOrder.length) * 100);

        return {
            isCorrect: this.priorityQueue.checkOrder(),
            userOrder: this.userOrder,
            correctOrder: correctOrder,
            score: this.score,
            message: isCorrect
                ? 'Perfect! You\'ve correctly prioritized errors from most to least critical. Fix critical errors first to prevent cascading damage.'
                : 'Not quite right. Remember: financial and data-integrity errors are most critical. Errors affecting multiple records or systems are high priority. Cosmetic issues can wait.'
        };
    }

    getErrorList() {
        return this.priorityQueue ? this.priorityQueue.getItems() : [];
    }

    reset() {
        this.userOrder = [];
        this.score = 0;
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
            completed: this.completed
        };
    }
}

export { Module5 };

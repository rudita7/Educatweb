// Module 1: Why Accuracy Matters
// Purpose: Narrative/scenario screen showing real consequences of records errors

class Module1 {
    constructor() {
        this.title = 'Module 1: Why Accuracy Matters';
        this.completed = false;
    }

    getContent() {
        return {
            title: this.title,
            scenario: {
                title: 'A Single Digit Error',
                description: 'A small business relies on accurate inventory records. When a single item\'s quantity is recorded incorrectly, the consequences ripple through the entire operation.',
                record: {
                    itemName: 'Wireless Mouse',
                    sku: 'WM-2024-001',
                    recordedQuantity: 150,
                    actualQuantity: 15,
                    lastUpdated: '2024-01-15'
                }
            },
            consequences: [
                {
                    title: 'Oversell',
                    description: 'Promised 100 units to a customer, but only 15 were in stock. The order couldn\'t be fulfilled.'
                },
                {
                    title: 'Lose Revenue',
                    description: 'Customer cancelled and bought from a competitor instead.'
                },
                {
                    title: 'Damage Trust',
                    description: 'The business\'s reputation for reliability took a hit.'
                },
                {
                    title: 'Waste Time',
                    description: 'Staff had to investigate, apologize, and manually correct records.'
                }
            ],
            learningObjective: 'As a records specialist, you\'ll learn to catch these errors before they cause damage. In this lesson, you\'ll discover what errors look like, how to find them quickly, and how to prioritize which ones to fix first. Your accuracy directly protects the business and the people who depend on it.'
        };
    }

    markComplete() {
        this.completed = true;
    }

    isComplete() {
        return this.completed;
    }
}

export { Module1 };

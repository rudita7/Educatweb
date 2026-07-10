const errorInjectionEngine = {
    injectTypo: (record, field) => {
        const value = record[field];
        if (typeof value !== 'string' || value.length === 0) return { corruptedRecord: record, groundTruthDiff: null };
        
        const idx = Math.floor(Math.random() * value.length);
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const newChar = chars[Math.floor(Math.random() * chars.length)];
        
        const corrupted = {
            ...record,
            [field]: value.substring(0, idx) + newChar + value.substring(idx + 1)
        };
        
        return {
            corruptedRecord: corrupted,
            groundTruthDiff: { field, original: value, corrupted: corrupted[field], type: 'typo' }
        };
    },

    injectMissingField: (record, field) => {
        const originalValue = record[field];
        const corrupted = { ...record, [field]: '' };
        return {
            corruptedRecord: corrupted,
            groundTruthDiff: { field, original: originalValue, corrupted: '', type: 'missing' }
        };
    },

    injectFormatInconsistency: (record, field) => {
        if (field === 'invoiceDate' && record.invoiceDate) {
            const original = record.invoiceDate;
            const parts = original.split('-');
            const corrupted = `${parts[2]}/${parts[1]}/${parts[0]}`;
            return {
                corruptedRecord: { ...record, [field]: corrupted },
                groundTruthDiff: { field, original, corrupted, type: 'format' }
            };
        } else if (field === 'checkIn' && record.checkIn) {
            const original = record.checkIn;
            const [hours, minutes] = original.split(':');
            const corrupted = `${parseInt(hours) % 12 || 12}:${minutes} ${parseInt(hours) >= 12 ? 'PM' : 'AM'}`;
            return {
                corruptedRecord: { ...record, [field]: corrupted },
                groundTruthDiff: { field, original, corrupted, type: 'format' }
            };
        }
        return { corruptedRecord: record, groundTruthDiff: null };
    },

    injectExtraWhitespace: (record, field) => {
        const original = record[field];
        if (typeof original !== 'string') return { corruptedRecord: record, groundTruthDiff: null };
        const corrupted = `  ${original.trim()}  `;
        return {
            corruptedRecord: { ...record, [field]: corrupted },
            groundTruthDiff: { field, original, corrupted, type: 'whitespace' }
        };
    },

    injectDuplicate: (record, mutation) => {
        // For simplicity, this just marks the record as a duplicate without creating a full copy
        // A full implementation would create a new record with slight mutations
        return {
            corruptedRecord: { ...record, isDuplicate: true },
            groundTruthDiff: { field: 'record', original: 'unique', corrupted: 'duplicate', type: 'duplicate' }
        };
    },

    injectLogicalViolation: (record, field) => {
        if (field === 'total' && record.lineItems) {
            const correct = record.lineItems.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
            const corrupted = correct + 50; // Introduce a $50 discrepancy
            return {
                corruptedRecord: { ...record, [field]: corrupted },
                groundTruthDiff: { field, original: correct, corrupted, type: 'logical' }
            };
        } else if (field === 'checkOut' && record.checkIn && record.checkOut) {
            const checkInTime = new Date(`2000/01/01 ${record.checkIn}`);
            const checkOutTime = new Date(`2000/01/01 ${record.checkOut}`);
            if (checkOutTime < checkInTime) {
                // Already a violation, don't corrupt further
                return { corruptedRecord: record, groundTruthDiff: null };
            }
            const corruptedCheckOut = '08:00'; // Make checkout earlier than checkin
            return {
                corruptedRecord: { ...record, [field]: corruptedCheckOut },
                groundTruthDiff: { field, original: record.checkOut, corrupted: corruptedCheckOut, type: 'logical' }
            };
        }
        return { corruptedRecord: record, groundTruthDiff: null };
    },

    injectCrossReferenceMismatch: (recordA, recordB) => {
        // This is a placeholder. Real implementation would involve two records.
        return {
            corruptedRecord: { ...recordA, crossRefError: true },
            groundTruthDiff: { field: 'crossReference', original: 'match', corrupted: 'mismatch', type: 'cross-reference' }
        };
    }
};

// Sample data for demonstration
const sampleRecords = {
    invoice: {
        id: 'INV-001',
        customerName: 'Rahman Trading Co.',
        invoiceDate: '2024-01-15',
        lineItems: [
            { description: 'Wireless Mouse', qty: 10, unitPrice: 250 },
            { description: 'USB Cable', qty: 5, unitPrice: 150 }
        ],
        total: 4250,
        status: 'Pending'
    },
    attendance: {
        id: 'ATT-001',
        employeeName: 'Fatima Khan',
        date: '2024-01-15',
        checkIn: '09:00',
        checkOut: '17:30',
        status: 'Present'
    },
    inventory: {
        id: 'INV-STOCK-001',
        itemName: 'Wireless Mouse',
        sku: 'WM-2024-001',
        quantity: 150,
        lastUpdated: '2024-01-15',
        location: 'Shelf A3'
    }
};

// Export for use in other modules
export { errorInjectionEngine, sampleRecords };

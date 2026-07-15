/* Shared record domains (spec §2.1) + small master-data lists used for
   cross-record consistency checks. Reused across Track 3 lessons so
   learners see the same record shapes deepen in complexity as they
   progress, rather than throwaway examples per lesson. */
(function (global) {
    "use strict";

    const ROSTER = [
        { employeeId: 'EMP-104', name: 'Farhana Akter' },
        { employeeId: 'EMP-108', name: 'Shakil Rahman' },
        { employeeId: 'EMP-112', name: 'Nusrat Jahan' },
        { employeeId: 'EMP-119', name: 'Imran Kabir' },
        { employeeId: 'EMP-121', name: 'Tania Sultana' }
    ];

    const CUSTOMERS = [
        { customerId: 'CUS-301', name: 'Green Valley Traders', address: 'Uttara, Dhaka' },
        { customerId: 'CUS-302', name: 'Bay Textiles Ltd.', address: 'Agrabad, Chattogram' },
        { customerId: 'CUS-303', name: 'Dhanmondi Hardware', address: 'Dhanmondi, Dhaka' },
        { customerId: 'CUS-304', name: 'Sundarban Foods', address: 'Khulna Sadar, Khulna' }
    ];

    function attendance(overrides) {
        return Object.assign({
            id: 'ATT-2201',
            employeeId: 'EMP-108',
            employeeName: 'Shakil Rahman',
            date: '2026-07-06',
            checkIn: '09:02',
            checkOut: '17:10',
            status: 'Present'
        }, overrides || {});
    }

    function invoice(overrides) {
        return Object.assign({
            id: 'INV-5560',
            customerId: 'CUS-302',
            customerName: 'Bay Textiles Ltd.',
            customerAddress: 'Agrabad, Chattogram',
            invoiceDate: '2026-07-01',
            lineItems: [{ description: 'Cotton fabric roll', qty: 12, unitPrice: 850 }],
            total: 10200,
            status: 'Pending'
        }, overrides || {});
    }

    function inventory(overrides) {
        return Object.assign({
            id: 'INVT-771',
            itemName: 'A4 Paper Ream',
            sku: 'STA-4402',
            quantity: 48,
            lastUpdated: '2026-07-04',
            location: 'Shelf B3'
        }, overrides || {});
    }

    global.T3 = global.T3 || {};
    global.T3.data = { ROSTER: ROSTER, CUSTOMERS: CUSTOMERS, attendance: attendance, invoice: invoice, inventory: inventory };
})(window);

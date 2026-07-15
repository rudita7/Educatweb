(function () {
    "use strict";

    // ============================================================
    //  STORAGE — same schema as index1.html / lesson2.js
    // ============================================================
    const Storage = {
        get(key) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } },
        set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } }
    };

    const LESSON_ID = 'lesson3-data-cleaning';

    function loadSession() {
        const data = Storage.get('uttoron:session');
        if (data && data.num) {
            const user = Storage.get('user:' + data.num);
            if (user) return { num: data.num, nickname: user.nickname };
        }
        return null;
    }
    const session = loadSession();

    function logEvent(moduleNum, event, meta) {
        const log = Storage.get('analytics:events') || [];
        log.push({ ts: Date.now(), num: session ? session.num : null, track: 'track3-data-accuracy', lesson: 'lesson3', module: moduleNum, event, meta: meta || null });
        if (log.length > 500) log.shift();
        Storage.set('analytics:events', log);
    }

    function awardStampIfComplete() {
        if (![1,2,3,4,5,6,7].every(n => moduleDone[n])) return;
        if (session) {
            const progress = Storage.get('progress:' + session.num) || {};
            progress[LESSON_ID] = true;
            Storage.set('progress:' + session.num, progress);
        }
        $('#lessonStampBanner').classList.add('show');
        logEvent('all', 'lesson_completed', null);
    }

    // ============================================================
    //  DOM HELPERS + TOAST
    // ============================================================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    let toastTimer = null;
    function showToast(msg, type) {
        const el = $('#toast');
        el.textContent = msg;
        el.className = 'toast show ' + (type || '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
    }

    function feedback(id, ok, html) {
        const el = $(id);
        el.className = 'feedback show ' + (ok ? 'ok' : 'error');
        el.innerHTML = html;
        return el;
    }
    function resetFeedback(id) { $(id).className = 'feedback'; }

    const norm = window.T3.hashLookup.normalize;
    function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
    function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

    function ledgerRow(field, label, value, opts) {
        opts = opts || {};
        if (opts.editable) {
            return `<div class="ledger-row"><div class="k">${escapeHtml(label)}</div><div><input data-field="${field}" type="text" value="${escapeAttr(value)}" /></div></div>`;
        }
        return `<div class="ledger-row"><div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(value)}</div></div>`;
    }

    // ============================================================
    //  MODULE RAIL
    // ============================================================
    const MODULES = [
        { n: 1, label: 'Duplicates' },
        { n: 2, label: 'Missing Info' },
        { n: 3, label: 'Standardize' },
        { n: 4, label: 'Whitespace' },
        { n: 5, label: 'Cross-check' },
        { n: 6, label: 'Validation' },
        { n: 7, label: 'Challenge' }
    ];
    const moduleDone = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false };
    let activeModule = 1;

    function renderRail() {
        $('#moduleRail').innerHTML = MODULES.map(m => `
            <button class="module-dot ${m.n === activeModule ? 'active' : ''} ${moduleDone[m.n] ? 'done' : ''}" data-goto="${m.n}">
                <span class="num">${m.n}</span> ${m.label}
            </button>
        `).join('');
        $$('#moduleRail .module-dot').forEach(btn => btn.addEventListener('click', () => goToModule(Number(btn.dataset.goto))));
    }

    function goToModule(n) {
        activeModule = n;
        $$('.module-panel').forEach(p => p.classList.toggle('active', Number(p.dataset.module) === n));
        renderRail();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function markModuleDone(n) {
        if (moduleDone[n]) return;
        moduleDone[n] = true;
        logEvent(n, 'module_completed', null);
        renderRail();
        showToast('Module ' + n + ' complete!', 'success');
        awardStampIfComplete();
    }

    // ============================================================
    //  MODULE 1 — Removing Duplicates (fuzzy match + Union-Find)
    // ============================================================
    let m1Records, m1Clusters;
    function initModule1() {
        m1Records = [
            window.T3.data.inventory({ id: 'INVT-01', itemName: 'A4 Paper Ream', sku: 'STA-4402', quantity: 48, location: 'Shelf B3' }),
            window.T3.data.inventory({ id: 'INVT-02', itemName: 'A4  Paper Ream', sku: 'STA-4402', quantity: 48, location: 'Shelf B3' }),
            window.T3.data.inventory({ id: 'INVT-03', itemName: 'a4 paper ream', sku: 'STA-4402', quantity: 48, location: 'Shelf B3' }),
            window.T3.data.inventory({ id: 'INVT-04', itemName: 'Stapler Pins', sku: 'STA-1290', quantity: 20, location: 'Shelf B1' }),
            window.T3.data.inventory({ id: 'INVT-05', itemName: 'Whiteboard Marker', sku: 'STA-2210', quantity: 15, location: 'Shelf A4' }),
            window.T3.data.inventory({ id: 'INVT-06', itemName: 'Whiteboard Marker ', sku: 'STA-2210', quantity: 15, location: 'Shelf A4' })
        ];
        m1Clusters = window.T3.fuzzyMatch.clusterDuplicates(m1Records, r => r.itemName, 0.8);
        renderModule1();
    }

    function renderModule1() {
        $('#m1-grid').innerHTML = m1Records.map((r, i) => `
            <div class="dup-card" data-idx="${i}">
                <input type="checkbox" data-idx="${i}" />
                <div class="info">
                    <h4>${escapeHtml(r.itemName)}</h4>
                    <div class="meta">${r.sku} · qty ${r.quantity} · ${r.location}</div>
                </div>
            </div>
        `).join('');
    }

    $('#m1-check').addEventListener('click', () => {
        const checked = {};
        $$('#m1-grid input[type=checkbox]').forEach(cb => { checked[cb.dataset.idx] = cb.checked; });

        let correct = 0;
        m1Clusters.forEach((cluster, ci) => {
            cluster.indices.forEach((idx, pos) => {
                const shouldBeChecked = cluster.indices.length > 1 && pos > 0;
                const card = $(`.dup-card[data-idx="${idx}"]`);
                if (cluster.indices.length > 1) {
                    card.classList.add(ci % 2 === 0 ? 'cluster-even' : 'cluster-odd');
                    if (!card.querySelector('.cluster-tag')) {
                        card.querySelector('.info').insertAdjacentHTML('beforeend', `<span class="cluster-tag">Group ${ci + 1}${pos === 0 ? ' · keep' : ' · duplicate'}</span>`);
                    }
                }
                if (!!checked[idx] === shouldBeChecked) correct++;
            });
        });

        if (correct === m1Records.length) {
            feedback('#m1-feedback', true, '✅ Every duplicate correctly flagged.');
            markModuleDone(1);
        } else {
            feedback('#m1-feedback', false, `You got ${correct} of ${m1Records.length} right — clusters are now revealed above, compare against your checkboxes.`);
        }
    });

    // ============================================================
    //  MODULE 2 — Filling Missing Information (hash-map lookup)
    // ============================================================
    let m2Attendance, m2Invoice, m2aDone = false, m2bDone = false;
    function initModule2() {
        m2Attendance = window.T3.data.attendance({ employeeId: 'EMP-119', employeeName: '' });
        m2Invoice = window.T3.data.invoice({ customerId: 'CUS-303', customerName: '' });
        renderM2Attendance();
        renderM2Invoice();
    }

    function renderM2Attendance() {
        $('#m2-attendance').innerHTML = `
            <div class="ledger-title">Attendance Record · ${m2Attendance.id}</div>
            ${ledgerRow('employeeId', 'Employee ID', m2Attendance.employeeId)}
            ${ledgerRow('employeeName', 'Employee Name', m2Attendance.employeeName, { editable: true })}
        `;
        $('#m2-attendance input[data-field="employeeName"]').addEventListener('change', e => { m2Attendance.employeeName = e.target.value; });
    }
    function renderM2Invoice() {
        $('#m2-invoice').innerHTML = `
            <div class="ledger-title">Invoice · ${m2Invoice.id}</div>
            ${ledgerRow('customerId', 'Customer ID', m2Invoice.customerId)}
            ${ledgerRow('customerName', 'Customer Name', m2Invoice.customerName, { editable: true })}
        `;
        $('#m2-invoice input[data-field="customerName"]').addEventListener('change', e => { m2Invoice.customerName = e.target.value; });
    }

    $('#m2a-lookup').addEventListener('click', () => {
        $('#m2-roster-ledger').innerHTML = `
            <div class="ledger-title">Employee roster (master list)</div>
            <table class="roster-table"><thead><tr><th>Employee ID</th><th>Name</th></tr></thead>
            <tbody>${window.T3.data.ROSTER.map(r => `<tr><td class="mono">${r.employeeId}</td><td>${r.name}</td></tr>`).join('')}</tbody></table>
        `;
    });
    $('#m2b-lookup').addEventListener('click', () => {
        $('#m2-customers-ledger').innerHTML = `
            <div class="ledger-title">Customer master list</div>
            <table class="roster-table"><thead><tr><th>Customer ID</th><th>Name</th></tr></thead>
            <tbody>${window.T3.data.CUSTOMERS.map(c => `<tr><td class="mono">${c.customerId}</td><td>${c.name}</td></tr>`).join('')}</tbody></table>
        `;
    });

    $('#m2a-check').addEventListener('click', () => {
        const index = window.T3.hashLookup.buildIndex(window.T3.data.ROSTER, r => r.employeeId);
        const expected = index.get(m2Attendance.employeeId);
        if (expected && norm(m2Attendance.employeeName) === norm(expected.name)) {
            feedback('#m2a-feedback', true, '✅ Correct — matches the roster.');
            m2aDone = true;
            checkModule2();
        } else {
            feedback('#m2a-feedback', false, `Not quite. Look up the roster entry for ${m2Attendance.employeeId}.`);
        }
    });
    $('#m2b-check').addEventListener('click', () => {
        const index = window.T3.hashLookup.buildIndex(window.T3.data.CUSTOMERS, c => c.customerId);
        const expected = index.get(m2Invoice.customerId);
        if (expected && norm(m2Invoice.customerName) === norm(expected.name)) {
            feedback('#m2b-feedback', true, '✅ Correct — matches the customer master list.');
            m2bDone = true;
            checkModule2();
        } else {
            feedback('#m2b-feedback', false, `Not quite. Look up the customer entry for ${m2Invoice.customerId}.`);
        }
    });
    function checkModule2() { if (m2aDone && m2bDone) markModuleDone(2); }

    // ============================================================
    //  MODULE 3 — Standardizing Formats (pipeline composition)
    // ============================================================
    const M3_STEPS = [
        { key: 'trim', label: 'Trim whitespace', fn: window.T3.pipeline.trimWhitespace },
        { key: 'collapse', label: 'Collapse double spaces', fn: window.T3.pipeline.collapseInternalSpaces },
        { key: 'titleCase', label: 'Title Case', fn: window.T3.pipeline.standardizeTitleCase },
        { key: 'date', label: 'Standardize Date', fn: window.T3.pipeline.standardizeDate },
        { key: 'phone', label: 'Standardize Phone', fn: window.T3.pipeline.standardizePhone }
    ];
    let m3Raw, m3Expected;
    function initModule3() {
        m3Raw = { employeeName: '  MASUD  RANA  ', date: '04/07/2026', contactNumber: '01899-004433' };
        m3Expected = { employeeName: 'Masud Rana', date: '2026-07-04', contactNumber: '+880-1899-004433' };
        renderModule3();
    }

    function renderModule3() {
        const fieldLabels = { employeeName: 'Employee Name', date: 'Date', contactNumber: 'Phone Number' };
        $('#m3-record').innerHTML = `
            <div class="ledger-title">Employee Contact Record · ATT-3399</div>
            ${Object.keys(m3Raw).map(field => `
                <div class="pipeline-field">
                    <div class="before-after">
                        <strong>${fieldLabels[field]}:</strong>
                        <span class="mono">"${escapeHtml(m3Raw[field])}"</span>
                        <span class="arrow">→</span>
                        <span class="mono" id="m3-result-${field}">?</span>
                    </div>
                    <div class="pipeline-palette">
                        ${M3_STEPS.map(step => `<label><input type="checkbox" data-field="${field}" data-step="${step.key}" /> ${step.label}</label>`).join('')}
                    </div>
                </div>
            `).join('')}
        `;
    }

    $('#m3-check').addEventListener('click', () => {
        const results = {};
        Object.keys(m3Raw).forEach(field => {
            const selected = M3_STEPS.filter(step => {
                const cb = $(`#m3-record input[data-field="${field}"][data-step="${step.key}"]`);
                return cb && cb.checked;
            }).map(step => step.fn);
            const run = window.T3.pipeline.pipeline(...selected);
            results[field] = run(m3Raw[field]);
            $('#m3-result-' + field).textContent = '"' + results[field] + '"';
        });

        const correct = Object.keys(m3Expected).filter(f => results[f] === m3Expected[f]);
        if (correct.length === Object.keys(m3Expected).length) {
            feedback('#m3-feedback', true, '✅ All three fields cleaned correctly.');
            markModuleDone(3);
        } else {
            const missed = Object.keys(m3Expected).filter(f => results[f] !== m3Expected[f]);
            feedback('#m3-feedback', false, `Still off: ${missed.join(', ')}. Try a different combination of steps.`);
        }
    });

    // ============================================================
    //  MODULE 4 — Removing Extra Spaces (pipeline, focused scope)
    // ============================================================
    let m4Raw, m4Expected;
    function initModule4() {
        m4Raw = { itemName: '  Sticky Notes  ', location: 'Shelf  A2' };
        m4Expected = { itemName: 'Sticky Notes', location: 'Shelf A2' };
        renderModule4();
    }
    function renderModule4() {
        $('#m4-record').innerHTML = `
            <div class="ledger-title">Inventory Log · INVT-09</div>
            ${Object.keys(m4Raw).map(field => `
                <div class="ledger-row"><div class="k">${field === 'itemName' ? 'Item' : 'Location'}</div>
                <div class="mono">"${escapeHtml(m4Raw[field])}" → <span id="m4-result-${field}">?</span></div></div>
            `).join('')}
        `;
    }
    $('#m4-check').addEventListener('click', () => {
        const clean = window.T3.pipeline.pipeline(window.T3.pipeline.trimWhitespace, window.T3.pipeline.collapseInternalSpaces);
        const results = {};
        Object.keys(m4Raw).forEach(field => {
            results[field] = clean(m4Raw[field]);
            $('#m4-result-' + field).textContent = '"' + results[field] + '"';
        });
        const allMatch = Object.keys(m4Expected).every(f => results[f] === m4Expected[f]);
        if (allMatch) {
            feedback('#m4-feedback', true, '✅ Whitespace cleaned up correctly.');
            markModuleDone(4);
        } else {
            feedback('#m4-feedback', false, 'Something is still off — check the results above.');
        }
    });

    // ============================================================
    //  MODULE 5 — Cross-checking Records (hash-join style lookup)
    // ============================================================
    let m5Invoice;
    function initModule5() {
        m5Invoice = window.T3.data.invoice({ customerId: 'CUS-303', customerName: 'Dhanmondi Hardware', customerAddress: 'Mirpur, Dhaka' });
        $('#m5-customers').innerHTML = window.T3.data.CUSTOMERS.map(c => `<tr><td class="mono">${c.customerId}</td><td>${c.name}</td><td>${c.address}</td></tr>`).join('');
        renderModule5();
    }
    function renderModule5() {
        $('#m5-invoice').innerHTML = `
            <div class="ledger-title">Invoice · ${m5Invoice.id}</div>
            ${ledgerRow('customerId', 'Customer ID', m5Invoice.customerId)}
            ${ledgerRow('customerName', 'Customer Name', m5Invoice.customerName)}
            ${ledgerRow('customerAddress', 'Address on Invoice', m5Invoice.customerAddress, { editable: true })}
        `;
        $('#m5-invoice input[data-field="customerAddress"]').addEventListener('change', e => { m5Invoice.customerAddress = e.target.value; });
    }
    $('#m5-check').addEventListener('click', () => {
        const index = window.T3.hashLookup.buildIndex(window.T3.data.CUSTOMERS, c => c.customerId);
        const master = index.get(m5Invoice.customerId);
        const match = master && norm(m5Invoice.customerAddress) === norm(master.address);
        $('#m5-result').textContent = master ? `Master address for ${m5Invoice.customerId}: "${master.address}"` : 'Customer ID not found.';
        if (match) {
            feedback('#m5-feedback', true, '✅ Address confirmed against the master list.');
            markModuleDone(5);
        } else {
            feedback('#m5-feedback', false, 'Mismatch — update the address on the invoice to match the master list, then check again.');
        }
    });

    // ============================================================
    //  MODULE 6 — Logical Validation (rule engine)
    // ============================================================
    const M6_RULES = [
        { id: 'invoice-total', appliesTo: r => r.__domain === 'invoice', check: r => Number(r.total) === r.lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0), message: 'Total must equal the sum of line items.' },
        { id: 'attendance-checkout-after-checkin', appliesTo: r => r.__domain === 'attendance', check: r => r.checkOut > r.checkIn, message: 'Check-out time must be after check-in time.' },
        { id: 'inventory-nonneg-qty', appliesTo: r => r.__domain === 'inventory', check: r => Number(r.quantity) >= 0, message: 'Quantity cannot be negative.' }
    ];
    let m6Records;
    function initModule6() {
        m6Records = [
            Object.assign({ __domain: 'invoice' }, window.T3.data.invoice({ id: 'INV-7701', total: 13500 })),
            Object.assign({ __domain: 'attendance' }, window.T3.data.attendance({ id: 'ATT-7702', checkIn: '17:10', checkOut: '09:02' })),
            Object.assign({ __domain: 'inventory' }, window.T3.data.inventory({ id: 'INVT-7703', quantity: -5 }))
        ];
        renderModule6();
    }
    function renderModule6() {
        $('#m6-records').innerHTML = m6Records.map((r, i) => {
            let fieldsHtml = '';
            if (r.__domain === 'invoice') fieldsHtml = ledgerRow('total', 'Total (৳)', r.total, { editable: true });
            if (r.__domain === 'attendance') fieldsHtml = ledgerRow('checkIn', 'Check-in', r.checkIn, { editable: true }) + ledgerRow('checkOut', 'Check-out', r.checkOut, { editable: true });
            if (r.__domain === 'inventory') fieldsHtml = ledgerRow('quantity', 'Quantity', r.quantity, { editable: true });
            return `<div class="ledger" data-idx="${i}">
                <div class="ledger-title">${r.__domain} · ${r.id}</div>
                ${fieldsHtml}
                <ul class="rule-result-list" id="m6-results-${i}"></ul>
                <button class="btn btn-secondary btn-sm" data-idx="${i}" id="m6-run-${i}">Run validation</button>
            </div>`;
        }).join('');

        m6Records.forEach((r, i) => {
            $$(`#m6-records .ledger[data-idx="${i}"] input`).forEach(el => {
                el.addEventListener('change', () => {
                    const field = el.dataset.field;
                    r[field] = field === 'total' || field === 'quantity' ? Number(el.value) : el.value;
                });
            });
            $('#m6-run-' + i).addEventListener('click', () => runM6Validation(i));
        });
    }
    function runM6Validation(i) {
        const record = m6Records[i];
        const results = window.T3.ruleEngine.evaluateRules(record, M6_RULES);
        $('#m6-results-' + i).innerHTML = results.map(res => `
            <li class="rule-result-item"><span class="badge ${res.passed ? 'pass' : 'fail'}">${res.passed ? 'PASS' : 'FAIL'}</span> ${res.message}</li>
        `).join('');
        checkModule6();
    }
    function checkModule6() {
        const validFlags = m6Records.map(r => window.T3.ruleEngine.evaluateRules(r, M6_RULES).every(res => res.passed));
        const validCount = validFlags.filter(Boolean).length;
        $('#m6-status').textContent = `${validCount} of ${m6Records.length} records fully valid.`;
        if (validCount === m6Records.length) {
            feedback('#m6-feedback', true, '✅ All records pass validation.');
            markModuleDone(6);
        }
    }

    // ============================================================
    //  MODULE 7 — Data Cleaning Challenge (pipeline ordering)
    // ============================================================
    const M7_STEP_DEFS = {
        dedupe: 'Remove Duplicates',
        standardize: 'Standardize Formats',
        fillMissing: 'Fill Missing Information',
        validate: 'Validate'
    };
    let m7Order = ['dedupe', 'standardize', 'fillMissing', 'validate'];

    function initModule7() {
        renderModule7Steps();
    }

    function renderModule7Steps() {
        $('#m7-steps').innerHTML = m7Order.map((key, i) => `
            <li class="step-item" data-key="${key}">
                <span class="order-num">${i + 1}</span>
                <span class="label">${M7_STEP_DEFS[key]}</span>
                <span class="reorder-btns">
                    <button data-act="up" data-key="${key}" ${i === 0 ? 'disabled' : ''}>▲</button>
                    <button data-act="down" data-key="${key}" ${i === m7Order.length - 1 ? 'disabled' : ''}>▼</button>
                </span>
            </li>
        `).join('');
        $$('#m7-steps button').forEach(btn => btn.addEventListener('click', () => {
            const key = btn.dataset.key;
            const idx = m7Order.indexOf(key);
            const dir = btn.dataset.act === 'up' ? -1 : 1;
            const swapWith = idx + dir;
            if (swapWith < 0 || swapWith >= m7Order.length) return;
            [m7Order[idx], m7Order[swapWith]] = [m7Order[swapWith], m7Order[idx]];
            renderModule7Steps();
        }));
    }

    function freshM7Batch() {
        return [
            { id: 'C-1', employeeId: 'EMP-104', employeeName: 'Farhana Akter', contactNumber: '01712-345678' },
            { id: 'C-2', employeeId: 'EMP-104', employeeName: 'Farhana Akter', contactNumber: '+880-1712-345678' },
            { id: 'C-3', employeeId: 'EMP-119', employeeName: '', contactNumber: '01650-112233' },
            { id: 'C-4', employeeId: 'EMP-121', employeeName: 'Tania Sultana', contactNumber: '01777-998877' }
        ];
    }

    $('#m7-run').addEventListener('click', () => {
        let batch = freshM7Batch();
        const log = [];
        let dedupeFoundGroup = false;
        let fillMissingRan = false;
        let validateRanLastReport = null;

        m7Order.forEach(step => {
            if (step === 'dedupe') {
                const clusters = window.T3.fuzzyMatch.clusterDuplicates(batch, r => r.contactNumber, 0.85);
                const groups = clusters.filter(c => c.records.length > 1);
                dedupeFoundGroup = groups.length > 0;
                log.push({ text: `Remove Duplicates: found ${groups.length} duplicate group(s).`, good: groups.length > 0 });
            } else if (step === 'standardize') {
                batch = batch.map(r => Object.assign({}, r, { contactNumber: window.T3.pipeline.standardizePhone(r.contactNumber) }));
                log.push({ text: 'Standardize Formats: normalized all phone numbers.', good: true });
            } else if (step === 'fillMissing') {
                const index = window.T3.hashLookup.buildIndex(window.T3.data.ROSTER, r => r.employeeId);
                let filled = 0;
                batch = batch.map(r => {
                    if (!r.employeeName && index.has(r.employeeId)) { filled++; return Object.assign({}, r, { employeeName: index.get(r.employeeId).name }); }
                    return r;
                });
                fillMissingRan = true;
                log.push({ text: `Fill Missing Information: filled ${filled} blank name(s).`, good: true });
            } else if (step === 'validate') {
                const phonePattern = /^\+880-\d{4}-\d{6}$/;
                const validCount = batch.filter(r => r.employeeName && phonePattern.test(r.contactNumber)).length;
                validateRanLastReport = { validCount, total: batch.length };
                log.push({ text: `Validate: ${validCount} of ${batch.length} records fully valid at this point.`, good: validCount === batch.length });
            }
        });

        $('#m7-log').style.display = 'block';
        $('#m7-log').innerHTML = log.map(l => `<span class="step-line ${l.good ? 'good' : 'bad'}">▸ ${l.text}</span>`).join('');

        const validateIsLast = m7Order[m7Order.length - 1] === 'validate';
        if (dedupeFoundGroup && fillMissingRan && validateIsLast) {
            feedback('#m7-feedback', true, '✅ Correct order — every issue was caught and the final report reflects the fully cleaned batch.');
            markModuleDone(7);
        } else {
            const problems = [];
            if (!dedupeFoundGroup) problems.push('your duplicate check ran before Standardize Formats, so it missed a match that only becomes identical once phone numbers share the same format');
            if (!validateIsLast) problems.push('Validate should run last, or its report won\'t reflect your other fixes');
            feedback('#m7-feedback', false, 'Not quite the right order: ' + problems.join('; ') + '.');
        }
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        renderRail();
        initModule1();
        initModule2();
        initModule3();
        initModule4();
        initModule5();
        initModule6();
        initModule7();
        goToModule(1);
        if (!session) {
            showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
        }
    }

    init();
})();

(function () {
    "use strict";

    // ============================================================
    //  STORAGE — same schema as index1.html, so a stamp earned here
    //  shows up on the Skills Passport dashboard.
    // ============================================================
    const Storage = {
        get(key) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } },
        set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } }
    };

    const LESSON_ID = 'lesson2-correct-records';

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
        log.push({ ts: Date.now(), num: session ? session.num : null, track: 'track3-data-accuracy', lesson: 'lesson2', module: moduleNum, event, meta: meta || null });
        if (log.length > 500) log.shift();
        Storage.set('analytics:events', log);
    }

    function awardStampIfComplete() {
        if (![1,2,3,4,5,6].every(n => moduleDone[n])) return;
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

    // ============================================================
    //  MODULE RAIL
    // ============================================================
    const MODULES = [
        { n: 1, label: 'Update' },
        { n: 2, label: 'Instructions' },
        { n: 3, label: 'Undo/Redo' },
        { n: 4, label: 'Versions' },
        { n: 5, label: 'Consistency' },
        { n: 6, label: 'Simulation' }
    ];
    const moduleDone = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
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
    //  SHARED: generic editable ledger row + command-stack binding
    // ============================================================
    function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
    function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

    function ledgerRow(field, label, value, opts) {
        opts = opts || {};
        if (opts.editable) {
            const inputType = opts.type === 'select' ? 'select' : (opts.type || 'text');
            if (inputType === 'select') {
                const options = opts.options.map(o => `<option value="${escapeAttr(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
                return `<div class="ledger-row"><div class="k">${escapeHtml(label)}</div><div><select data-field="${field}">${options}</select></div></div>`;
            }
            return `<div class="ledger-row"><div class="k">${escapeHtml(label)}</div><div><input data-field="${field}" type="${inputType}" value="${escapeAttr(value)}" /></div></div>`;
        }
        return `<div class="ledger-row"><div class="k">${escapeHtml(label)}</div><div class="v">${escapeHtml(value)}</div></div>`;
    }

    // Wires plain inputs/selects inside `container` to a CommandStack so every
    // committed edit becomes an undoable command (spec §2.7 command pattern).
    function bindEditableLedger(container, record, stack, onCommit) {
        $$('input, select', container).forEach(el => {
            const field = el.dataset.field;
            const commit = () => {
                const prev = record[field];
                const next = el.value;
                if (prev === next) return;
                stack.do({
                    label: field + ': "' + prev + '" → "' + next + '"',
                    do() { record[field] = next; },
                    undo() { record[field] = prev; }
                });
                if (onCommit) onCommit(field, next);
            };
            el.addEventListener('change', commit);
        });
    }

    // ============================================================
    //  MODULE 1 — Updating Information (input validation)
    // ============================================================
    const FIELD_RULES = {
        quantity: { type: 'number', test: v => /^\d+$/.test(String(v).trim()), hint: 'Whole number, zero or more.' },
        location: { type: 'text', test: v => String(v).trim().length >= 2, hint: 'Enter a shelf/location label (at least 2 characters).' },
        lastUpdated: { type: 'text', test: v => /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) && !isNaN(Date.parse(v.trim())), hint: 'Use YYYY-MM-DD format, e.g. 2026-07-10.' }
    };

    let m1Record, m1Target;
    function initModule1() {
        m1Record = window.T3.data.inventory();
        const today = new Date().toISOString().slice(0, 10);
        m1Target = { quantity: 62, location: 'Shelf C1', lastUpdated: today };
        $('#m1-call-text').textContent = `We recounted — it's actually ${m1Target.quantity} units now, and we moved them to ${m1Target.location} this morning (${m1Target.lastUpdated}). Please update the record.`;
        renderModule1();
    }

    function renderModule1() {
        $('#m1-ledger').innerHTML = `
            <div class="ledger-title">Inventory Log · ${m1Record.id}</div>
            ${ledgerRow('itemName', 'Item', m1Record.itemName)}
            ${ledgerRow('sku', 'SKU', m1Record.sku)}
            ${ledgerRow('quantity', 'Quantity', m1Record.quantity, { editable: true, type: 'number' })}
            ${ledgerRow('location', 'Location', m1Record.location, { editable: true, type: 'text' })}
            ${ledgerRow('lastUpdated', 'Last Updated', m1Record.lastUpdated, { editable: true, type: 'text' })}
        `;
        ['quantity', 'location', 'lastUpdated'].forEach(field => {
            const input = $('#m1-ledger input[data-field="' + field + '"]');
            const hint = document.createElement('div');
            hint.className = 'field-hint';
            hint.textContent = FIELD_RULES[field].hint;
            input.insertAdjacentElement('afterend', hint);
            input.addEventListener('input', () => {
                const valid = FIELD_RULES[field].test(input.value);
                input.classList.toggle('invalid', !valid);
                hint.classList.toggle('error', !valid);
                m1Record[field] = input.value;
            });
        });
    }

    $('#m1-check').addEventListener('click', () => {
        const invalid = ['quantity', 'location', 'lastUpdated'].filter(f => !FIELD_RULES[f].test(String(m1Record[f])));
        if (invalid.length) {
            feedback('#m1-feedback', false, 'Fix the highlighted field(s) before checking: ' + invalid.join(', ') + '.');
            return;
        }
        const results = {
            quantity: Number(m1Record.quantity) === m1Target.quantity,
            location: norm(m1Record.location) === norm(m1Target.location),
            lastUpdated: m1Record.lastUpdated.trim() === m1Target.lastUpdated
        };
        const correct = Object.values(results).filter(Boolean).length;
        if (correct === 3) {
            feedback('#m1-feedback', true, '✅ All three updates match what the warehouse reported.');
            markModuleDone(1);
        } else {
            const missed = Object.keys(results).filter(k => !results[k]);
            feedback('#m1-feedback', false, `Not quite — re-check: ${missed.join(', ')}.`);
        }
    });

    // ============================================================
    //  MODULE 2 — Following Instructions (template-based parser)
    // ============================================================
    const M2_SYNONYMS = {
        'phone number': 'contactNumber', 'contact number': 'contactNumber',
        'employee name': 'employeeName', 'name': 'employeeName',
        'check-in time': 'checkIn', 'check in time': 'checkIn',
        'check-out time': 'checkOut', 'check out time': 'checkOut',
        'attendance status': 'status', 'status': 'status'
    };
    const M2_PHRASES = {
        contactNumber: ['phone number', 'contact number'],
        employeeName: ['employee name', 'name'],
        checkIn: ['check-in time', 'check in time'],
        checkOut: ['check-out time', 'check out time'],
        status: ['attendance status', 'status']
    };
    const VERBS = ['Update', 'Change', 'Set', 'Correct', 'Fix'];

    function randomValueFor(field) {
        switch (field) {
            case 'contactNumber': return '017' + (10 + Math.floor(Math.random() * 89)) + '-' + (100000 + Math.floor(Math.random() * 899999));
            case 'employeeName': {
                const others = window.T3.data.ROSTER.filter(r => r.name !== m2Original.employeeName);
                return others[Math.floor(Math.random() * others.length)].name;
            }
            case 'checkIn': return String(7 + Math.floor(Math.random() * 2)).padStart(2, '0') + ':' + String(Math.floor(Math.random() * 60)).padStart(2, '0');
            case 'checkOut': return String(17 + Math.floor(Math.random() * 2)).padStart(2, '0') + ':' + String(Math.floor(Math.random() * 60)).padStart(2, '0');
            case 'status': {
                const opts = ['Present', 'Absent', 'Late'].filter(s => s !== m2Original.status);
                return opts[Math.floor(Math.random() * opts.length)];
            }
        }
    }

    function compareM2Value(field, a, b) {
        if (field === 'employeeName' || field === 'contactNumber') return norm(a) === norm(b);
        return String(a).trim() === String(b).trim();
    }

    let m2Original, m2Record, m2Expected;
    function newM2Instruction() {
        m2Original = window.T3.data.attendance({ contactNumber: '01710-223344' });
        m2Record = JSON.parse(JSON.stringify(m2Original));
        const field = Object.keys(M2_PHRASES)[Math.floor(Math.random() * Object.keys(M2_PHRASES).length)];
        const phrase = M2_PHRASES[field][Math.floor(Math.random() * M2_PHRASES[field].length)];
        const value = randomValueFor(field);
        const verb = VERBS[Math.floor(Math.random() * VERBS.length)];
        const text = `${verb} the ${phrase} to ${value}.`;
        const parsed = window.T3.parseInstruction(text, M2_SYNONYMS);
        m2Expected = { fieldKey: parsed.fieldKey, value: parsed.value };
        $('#m2-instruction').textContent = text;
        renderModule2();
        resetFeedback('#m2-feedback');
    }

    function renderModule2() {
        $('#m2-ledger').innerHTML = `
            <div class="ledger-title">Attendance Record · ${m2Record.id}</div>
            ${ledgerRow('employeeName', 'Employee Name', m2Record.employeeName, { editable: true })}
            ${ledgerRow('contactNumber', 'Phone Number', m2Record.contactNumber, { editable: true })}
            ${ledgerRow('checkIn', 'Check-in', m2Record.checkIn, { editable: true })}
            ${ledgerRow('checkOut', 'Check-out', m2Record.checkOut, { editable: true })}
            ${ledgerRow('status', 'Status', m2Record.status, { editable: true, type: 'select', options: ['Present', 'Absent', 'Late'] })}
        `;
        $$('#m2-ledger input, #m2-ledger select').forEach(el => {
            el.addEventListener('change', () => { m2Record[el.dataset.field] = el.value; });
        });
    }

    $('#m2-new').addEventListener('click', newM2Instruction);
    $('#m2-check').addEventListener('click', () => {
        const changed = window.T3.diff.diffRecords(m2Original, m2Record, { ignoreFields: ['id', 'employeeId'] }).filter(f => f.changed);
        if (changed.length !== 1) {
            feedback('#m2-feedback', false, changed.length === 0
                ? 'You haven’t changed anything yet.'
                : `You changed ${changed.length} fields — the instruction only asked for one.`);
            return;
        }
        const edit = changed[0];
        const rightField = edit.field === m2Expected.fieldKey;
        const rightValue = compareM2Value(edit.field, edit.after, m2Expected.value);
        if (rightField && rightValue) {
            feedback('#m2-feedback', true, '✅ Correct field, correct value.');
            markModuleDone(2);
        } else if (!rightField) {
            feedback('#m2-feedback', false, `That’s the wrong field. Re-read the instruction and find the field it actually refers to.`);
        } else {
            feedback('#m2-feedback', false, `Right field, but the value doesn’t match the instruction exactly.`);
        }
    });

    // ============================================================
    //  MODULE 3 — Avoiding Accidental Changes (command stack)
    // ============================================================
    let m3Record, m3Stack, m3Started = false, m3Accidented = false;
    function initModule3() {
        m3Record = window.T3.data.invoice({ customerName: 'Bay Textiles Ltf.' });
        m3Stack = new window.T3.CommandStack();
        m3Started = false;
        m3Accidented = false;
        renderModule3();
    }

    function renderModule3() {
        $('#m3-ledger').innerHTML = `
            <div class="ledger-title">Invoice · ${m3Record.id}</div>
            ${ledgerRow('customerName', 'Customer Name', m3Record.customerName, { editable: true })}
            ${ledgerRow('status', 'Status', m3Record.status, { editable: true, type: 'select', options: ['Pending', 'Paid', 'Overdue'] })}
            ${ledgerRow('total', 'Total (৳)', m3Record.total)}
        `;
        bindEditableLedger($('#m3-ledger'), m3Record, m3Stack, () => { checkM3Progress(); renderModule3(); });
        renderM3History();
        $('#m3-undo').disabled = !m3Stack.canUndo();
        $('#m3-redo').disabled = !m3Stack.canRedo();
    }

    function renderM3History() {
        let html = m3Stack.undoStack.map((cmd, i) =>
            `<li class="${i === m3Stack.undoStack.length - 1 ? 'current' : ''}">${cmd.label}</li>`).join('');
        html += m3Stack.redoStack.slice().reverse().map(cmd => `<li class="undone">${cmd.label} (undone)</li>`).join('');
        $('#m3-history').innerHTML = html || '<li style="border:none;color:#8a7c58;">No edits yet.</li>';
    }

    function checkM3Progress() {
        const statusDone = m3Record.status === 'Paid';
        const nameDone = norm(m3Record.customerName) === norm('Bay Textiles Ltd.');
        if (statusDone && nameDone && !m3Accidented && !m3Started) {
            m3Started = true;
            setTimeout(() => {
                m3Accidented = true;
                m3Stack.do({
                    label: 'total: "৳' + m3Record.total + '" → "৳13500" (unattended sync)',
                    do() { m3Record.total = 13500; },
                    undo() { m3Record.total = 10200; }
                });
                renderModule3();
                showToast('⚠️ Accidental change: something just overwrote the Total to ৳13500!', 'error');
            }, 900);
        }
    }

    $('#m3-undo').addEventListener('click', () => { m3Stack.undo(); renderModule3(); });
    $('#m3-redo').addEventListener('click', () => { m3Stack.redo(); renderModule3(); });
    $('#m3-check').addEventListener('click', () => {
        const statusOk = m3Record.status === 'Paid';
        const nameOk = norm(m3Record.customerName) === norm('Bay Textiles Ltd.');
        const totalOk = Number(m3Record.total) === 10200;
        if (!m3Accidented) {
            feedback('#m3-feedback', false, 'Make both requested edits first — the accidental change happens right after.');
            return;
        }
        if (statusOk && nameOk && totalOk) {
            feedback('#m3-feedback', true, '✅ You kept your own edits and undid exactly the accidental one.');
            markModuleDone(3);
        } else if (!totalOk) {
            feedback('#m3-feedback', false, 'The Total is still wrong — undo the accidental overwrite.');
        } else {
            feedback('#m3-feedback', false, 'The Total looks right, but your own edits (status / customer name) got lost. You may have undone too far — try Redo.');
        }
    });

    // ============================================================
    //  MODULE 4 — Version Checking (diff engine)
    // ============================================================
    let m4Before, m4After;
    function initModule4() {
        m4Before = window.T3.data.attendance({ employeeName: 'Nusrat Jahan', employeeId: 'EMP-112', date: '2026-07-06', checkIn: '09:02', checkOut: '17:10', status: 'Present' });
        m4After = JSON.parse(JSON.stringify(m4Before));
        m4After.employeeName = 'Nusrat Jahan ';
        m4After.checkOut = '18:45';
        m4After.status = 'Late';

        $('#m4-before').innerHTML = ['employeeName', 'date', 'checkIn', 'checkOut', 'status']
            .map(f => ledgerRow(f, fieldLabel(f), m4Before[f])).join('');

        $('#m4-checklist').innerHTML = ['employeeName', 'date', 'checkIn', 'checkOut', 'status'].map(f => `
            <div class="field-check-row">
                <input type="checkbox" id="m4-cb-${f}" data-field="${f}" />
                <label for="m4-cb-${f}">${fieldLabel(f)}: <span class="mono">${m4After[f]}</span></label>
            </div>
        `).join('');
        $('#m4-diffs').innerHTML = '';
    }

    const FIELD_LABELS = {
        employeeName: 'Employee Name', date: 'Date', checkIn: 'Check-in', checkOut: 'Check-out', status: 'Status',
        customerName: 'Customer Name', customerId: 'Customer ID', invoiceDate: 'Invoice Date', total: 'Total (৳)'
    };
    function fieldLabel(f) { return FIELD_LABELS[f] || f; }

    function renderDiffLine(before, after) {
        return window.T3.diff.diffStrings(before, after).map(op =>
            op.type === 'equal' ? escapeHtml(op.value) : `<span class="${op.type === 'add' ? 'add' : 'del'}">${escapeHtml(op.value)}</span>`
        ).join('');
    }

    $('#m4-check').addEventListener('click', () => {
        const truth = window.T3.diff.diffRecords(m4Before, m4After, { ignoreFields: ['id', 'employeeId'] });
        const selected = {};
        $$('#m4-checklist input[type=checkbox]').forEach(cb => { selected[cb.dataset.field] = cb.checked; });

        let correct = 0;
        const diffHtml = truth.map(f => {
            const gotIt = !!selected[f.field] === f.changed;
            if (gotIt) correct++;
            return `<div class="ledger" style="margin-bottom:8px;">
                <div class="ledger-title">${fieldLabel(f.field)} ${f.changed ? '· changed' : '· unchanged'} ${gotIt ? '✅' : '❌'}</div>
                <div class="diffline">${renderDiffLine(f.before, f.after)}</div>
            </div>`;
        }).join('');
        $('#m4-diffs').innerHTML = diffHtml;

        if (correct === truth.length) {
            feedback('#m4-feedback', true, '✅ You caught every real change, including the subtle ones.');
            markModuleDone(4);
        } else {
            feedback('#m4-feedback', false, `You got ${correct} of ${truth.length} right — check the diff above for what you missed.`);
        }
    });

    // ============================================================
    //  MODULE 5 — Maintaining Consistency (hash-map lookup)
    // ============================================================
    let m5Attendance, m5Invoice, m5aDone = false, m5bDone = false;
    function initModule5() {
        const rosterIndex = window.T3.hashLookup.buildIndex(window.T3.data.ROSTER, r => r.employeeId);
        m5Attendance = window.T3.data.attendance({ employeeId: 'EMP-112', employeeName: 'Nusrat Jaman' });
        const custIndex = window.T3.hashLookup.buildIndex(window.T3.data.CUSTOMERS, c => c.customerId);
        m5Invoice = window.T3.data.invoice({ customerId: 'CUS-399', customerName: 'Bay Textiles Ltd.' });

        $('#m5-roster').innerHTML = window.T3.data.ROSTER.map(r => `<tr><td class="mono">${r.employeeId}</td><td>${r.name}</td></tr>`).join('');
        $('#m5-customers').innerHTML = window.T3.data.CUSTOMERS.map(c => `<tr><td class="mono">${c.customerId}</td><td>${c.name}</td></tr>`).join('');

        window.__m5RosterIndex = rosterIndex;
        window.__m5CustIndex = custIndex;
        renderM5Attendance();
        renderM5Invoice();
    }

    function renderM5Attendance() {
        $('#m5-attendance').innerHTML = `
            <div class="ledger-title">Attendance Record · ${m5Attendance.id}</div>
            ${ledgerRow('employeeId', 'Employee ID', m5Attendance.employeeId)}
            ${ledgerRow('employeeName', 'Employee Name', m5Attendance.employeeName, { editable: true })}
        `;
        $('#m5-attendance input[data-field="employeeName"]').addEventListener('change', e => { m5Attendance.employeeName = e.target.value; });
    }
    function renderM5Invoice() {
        $('#m5-invoice').innerHTML = `
            <div class="ledger-title">Invoice · ${m5Invoice.id}</div>
            ${ledgerRow('customerId', 'Customer ID', m5Invoice.customerId)}
            ${ledgerRow('customerName', 'Customer Name (on the invoice)', m5Invoice.customerName)}
        `;
    }

    $('#m5a-fix').addEventListener('click', () => {
        const result = window.T3.hashLookup.checkConsistency(
            { employeeId: m5Attendance.employeeId, employeeName: m5Attendance.employeeName },
            window.__m5RosterIndex, 'employeeId', 'employeeName', 'name'
        );
        if (result.consistent) {
            feedback('#m5a-feedback', true, '✅ Name matches the roster exactly.');
            m5aDone = true;
            checkModule5();
        } else {
            feedback('#m5a-feedback', false, `${result.reason} Roster spelling: "${result.expected}". Edit the field above and check again.`);
        }
    });

    $('#m5b-check').addEventListener('click', () => {
        const found = window.__m5CustIndex.has(m5Invoice.customerId);
        if (found) {
            feedback('#m5b-feedback', false, 'Hmm — that ID is actually in the master list. Try a different scenario by reloading.');
        } else {
            feedback('#m5b-feedback', true, `⚠️ Correctly flagged: customer ID "${m5Invoice.customerId}" was not found in the master list. This needs a supervisor to confirm the right customer — don’t guess.`);
            m5bDone = true;
            checkModule5();
        }
    });

    function checkModule5() {
        if (m5aDone && m5bDone) markModuleDone(5);
    }

    // ============================================================
    //  MODULE 6 — Workplace Simulation (FSM + command stack + diff)
    // ============================================================
    let simRecords = [];
    function initModule6() {
        const attClean = window.T3.data.attendance({ employeeId: 'EMP-104', employeeName: 'Farhana Akter' });
        const attInjected = window.T3.inject.injectExtraWhitespace(attClean, 'employeeName');

        const invClean = window.T3.data.invoice();
        const invInjected = window.T3.inject.injectLogicalViolation(invClean, {
            field: 'total', message: 'Total does not match sum of line items.',
            apply(rec) { rec.total = 13500; }
        });

        const invRefClean = window.T3.data.invoice({ id: 'INV-5561', customerId: 'CUS-302', customerName: 'Bay Textiles Ltd.' });
        const invRefInjected = window.T3.inject.injectCrossReferenceMismatch(invRefClean, 'customerId', 'CUS-399');

        simRecords = [
            { key: 'att', domain: 'Attendance', clean: attClean, record: JSON.parse(JSON.stringify(attInjected.corruptedRecord)), fsm: new window.T3.RecordFSM(), stack: new window.T3.CommandStack(), kind: 'correctable', fields: ['employeeName', 'date', 'checkIn', 'checkOut', 'status'], editable: ['employeeName'] },
            { key: 'inv', domain: 'Invoice', clean: invClean, record: JSON.parse(JSON.stringify(invInjected.corruptedRecord)), fsm: new window.T3.RecordFSM(), stack: new window.T3.CommandStack(), kind: 'correctable', fields: ['customerName', 'invoiceDate', 'total'], editable: ['total'] },
            { key: 'invref', domain: 'Invoice', clean: invRefClean, record: JSON.parse(JSON.stringify(invRefInjected.corruptedRecord)), fsm: new window.T3.RecordFSM(), stack: new window.T3.CommandStack(), kind: 'flag', fields: ['customerId', 'customerName'], editable: [] }
        ];
        renderSim();
    }

    function simIsCorrectlyFixed(sim) {
        if (sim.key === 'att') return sim.record.employeeName === sim.clean.employeeName;
        if (sim.key === 'inv') return Number(sim.record.total) === sim.clean.total;
        return false; // invref can never be self-corrected — must be flagged
    }

    function renderSim() {
        $('#sim-records').innerHTML = simRecords.map(sim => {
            const stateClass = { 'Pending': '', 'In Review': 'review', 'Corrected': 'corrected', 'Flagged for Supervisor': 'flagged', 'Validated': 'validated', 'Submitted': 'submitted' }[sim.fsm.state];
            const rows = sim.fields.map(f => ledgerRow(f, fieldLabel(f), sim.record[f], { editable: sim.editable.includes(f) })).join('');
            let actions = '';
            const allowed = sim.fsm.allowedTransitions();
            if (allowed.includes('In Review')) actions += `<button class="btn btn-secondary btn-sm" data-act="review" data-key="${sim.key}">Move to In Review</button>`;
            if (allowed.includes('Corrected')) actions += `<button class="btn btn-secondary btn-sm" data-act="correct" data-key="${sim.key}">Mark Corrected</button>`;
            if (allowed.includes('Flagged for Supervisor')) actions += `<button class="btn btn-secondary btn-sm" data-act="flag" data-key="${sim.key}">Flag for Supervisor</button>`;
            if (allowed.includes('Validated')) actions += `<button class="btn btn-secondary btn-sm" data-act="validate" data-key="${sim.key}">Validate</button>`;
            if (allowed.includes('Submitted')) actions += `<button class="btn btn-success btn-sm" data-act="submit" data-key="${sim.key}">Submit</button>`;
            if (sim.editable.length) actions += `<button class="btn btn-secondary btn-sm" data-act="undo" data-key="${sim.key}" ${sim.stack.canUndo() ? '' : 'disabled'}>↶ Undo</button>`;
            return `<div class="sim-record">
                <div class="sim-record-head">
                    <div><span class="sim-domain-tag">${sim.domain} · ${sim.record.id}</span></div>
                    <span class="state-pill ${stateClass}">${sim.fsm.state}</span>
                </div>
                <div class="ledger" style="box-shadow:none;padding:12px 14px;">${rows}</div>
                <div class="sim-actions">${actions}</div>
                <div class="feedback show" id="sim-fb-${sim.key}" style="display:none;"></div>
            </div>`;
        }).join('');

        $$('#sim-records button').forEach(btn => btn.addEventListener('click', onSimAction));
        bindSimEdits();

        const submitted = simRecords.filter(s => s.fsm.state === 'Submitted').length;
        $('#sim-status').textContent = `${submitted} of ${simRecords.length} records submitted.`;
        $('#sim-finish').disabled = submitted !== simRecords.length;
    }

    function bindSimEdits() {
        $$('#sim-records .sim-record').forEach((block, idx) => {
            const sim = simRecords[idx];
            $$('input, select', block).forEach(el => {
                el.addEventListener('change', () => {
                    const field = el.dataset.field;
                    const prev = sim.record[field];
                    const next = el.value;
                    if (prev === next) return;
                    sim.stack.do({
                        label: field + ' updated',
                        do() { sim.record[field] = field === 'total' ? Number(next) : next; },
                        undo() { sim.record[field] = prev; }
                    });
                    renderSim();
                });
            });
        });
    }

    function simFeedback(key, ok, msg) {
        const el = $('#sim-fb-' + key);
        el.style.display = 'block';
        el.className = 'feedback show ' + (ok ? 'ok' : 'error');
        el.textContent = msg;
    }

    function onSimAction(e) {
        const key = e.target.dataset.key;
        const act = e.target.dataset.act;
        const sim = simRecords.find(s => s.key === key);
        if (!sim) return;

        if (act === 'undo') { sim.stack.undo(); renderSim(); return; }
        if (act === 'review') { sim.fsm.transition('In Review'); renderSim(); return; }
        if (act === 'correct') {
            if (sim.kind === 'flag') {
                simFeedback(key, false, 'You can’t verify this from the data on hand — use "Flag for Supervisor" instead.');
                return;
            }
            if (!simIsCorrectlyFixed(sim)) {
                simFeedback(key, false, 'Not fixed yet — edit the field so it matches the correct value, then try again.');
                return;
            }
            sim.fsm.transition('Corrected');
            simFeedback(key, true, 'Correction verified.');
            renderSim();
            return;
        }
        if (act === 'flag') { sim.fsm.transition('Flagged for Supervisor'); renderSim(); return; }
        if (act === 'validate') { sim.fsm.transition('Validated'); renderSim(); return; }
        if (act === 'submit') { sim.fsm.transition('Submitted'); renderSim(); return; }
    }

    $('#sim-finish').addEventListener('click', () => {
        const corrected = simRecords.filter(s => s.kind === 'correctable').length;
        const flagged = simRecords.filter(s => s.kind === 'flag').length;
        feedback('#sim-feedback', true, `✅ Batch submitted — ${corrected} record(s) corrected, ${flagged} flagged for supervisor review.`);
        markModuleDone(6);
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        renderRail();
        initModule1();
        newM2Instruction();
        initModule3();
        initModule4();
        initModule5();
        initModule6();
        goToModule(1);
        if (!session) {
            showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
        }
    }

    init();
})();

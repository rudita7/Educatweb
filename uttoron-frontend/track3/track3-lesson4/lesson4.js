(function () {
    "use strict";

    // ============================================================
    //  STORAGE — same schema as index1.html / lesson2.js / lesson3.js
    // ============================================================
    const Storage = {
        get(key) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } },
        set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } }
    };

    const LESSON_ID = 'lesson4-workplace-qa';

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
        log.push({ ts: Date.now(), num: session ? session.num : null, track: 'track3-data-accuracy', lesson: 'lesson4', module: moduleNum, event, meta: meta || null });
        if (log.length > 500) log.shift();
        Storage.set('analytics:events', log);
    }

    function awardStampIfComplete() {
        if (![1, 2, 3, 4].every(n => moduleDone[n])) return;
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

    const FIELD_LABELS = {
        customerName: 'Customer Name', customerId: 'Customer ID', invoiceDate: 'Invoice Date', total: 'Total (৳)',
        employeeName: 'Employee Name', employeeId: 'Employee ID', date: 'Date', checkIn: 'Check-in', checkOut: 'Check-out',
        itemName: 'Item', sku: 'SKU', quantity: 'Quantity', location: 'Location', status: 'Status'
    };
    function fieldLabel(f) { return FIELD_LABELS[f] || f; }
    const DOMAIN_LABEL = { invoice: 'Invoice', attendance: 'Attendance', inventory: 'Inventory' };
    const DOMAIN_FIELDS = {
        invoice: ['customerId', 'customerName', 'invoiceDate', 'total'],
        attendance: ['employeeId', 'employeeName', 'date', 'checkIn', 'checkOut'],
        inventory: ['itemName', 'sku', 'quantity', 'location']
    };

    // ============================================================
    //  MODULE RAIL
    // ============================================================
    const MODULES = [
        { n: 1, label: 'Inspect' },
        { n: 2, label: 'Correct' },
        { n: 3, label: 'Validate' },
        { n: 4, label: 'Report' }
    ];
    const moduleDone = { 1: false, 2: false, 3: false, 4: false };
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
    //  THE BATCH — one shared, mixed-domain dataset that carries
    //  through all four modules (spec §6: "one Track flows through
    //  Inspect -> Correct -> Validate -> Report").
    // ============================================================
    let batch = [];

    function buildBatch() {
        // 1. Clean invoice -- a true negative for Module 1's flagging pass.
        const invA = Object.assign(
            { __domain: 'invoice', __kind: 'clean', id: 'INV-9001' },
            window.T3.data.invoice({ id: 'INV-9001', customerId: 'CUS-301', customerName: 'Green Valley Traders' })
        );

        // 2. Invoice with a logical violation on total -- correctable by
        //    recomputing the sum of line items.
        const invBClean = window.T3.data.invoice({ id: 'INV-9002', customerId: 'CUS-303', customerName: 'Dhanmondi Hardware' });
        const invBInjected = window.T3.inject.injectLogicalViolation(invBClean, {
            field: 'total', message: 'Total does not match sum of line items.',
            apply(rec) { rec.total = rec.total + 900; }
        });
        const invB = Object.assign({ __domain: 'invoice', __kind: 'correctable', __clean: invBClean, __field: 'total' }, invBInjected.corruptedRecord);

        // 3. Clean attendance record.
        const attA = Object.assign(
            { __domain: 'attendance', __kind: 'clean', id: 'ATT-9003' },
            window.T3.data.attendance({ id: 'ATT-9003', employeeId: 'EMP-104', employeeName: 'Farhana Akter' })
        );

        // 4. Attendance with a typo in employeeName -- correctable via a
        //    roster lookup (same hash-map pattern as Lesson 2 Module 5).
        const attBClean = window.T3.data.attendance({ id: 'ATT-9004', employeeId: 'EMP-121', employeeName: 'Tania Sultana' });
        const attBInjected = window.T3.inject.injectTypo(attBClean, 'employeeName', Math.random);
        const attB = Object.assign({ __domain: 'attendance', __kind: 'correctable', __clean: attBClean, __field: 'employeeName' }, attBInjected.corruptedRecord);

        // 5. Inventory record with extra whitespace in itemName -- correctable,
        //    self-evident from the record alone.
        const invtAClean = window.T3.data.inventory({ id: 'INVT-9005', itemName: 'A4 Paper Ream', sku: 'STA-4402' });
        const invtAInjected = window.T3.inject.injectExtraWhitespace(invtAClean, 'itemName');
        const invtA = Object.assign({ __domain: 'inventory', __kind: 'correctable', __clean: invtAClean, __field: 'itemName' }, invtAInjected.corruptedRecord);

        // 6. A near-duplicate of #5 -- not an "error" on its own (Module 1
        //    ground truth treats it as clean), but Module 3's duplicate scan
        //    should catch the pair.
        const invtB = Object.assign(
            { __domain: 'inventory', __kind: 'clean', id: 'INVT-9006' },
            window.T3.data.inventory({ id: 'INVT-9006', itemName: 'a4 paper ream', sku: 'STA-4402', quantity: 48, location: 'Shelf B3' })
        );

        // 7. Invoice with a cross-reference mismatch -- NOT self-correctable;
        //    must be flagged for a supervisor, same as Lesson 2 Module 6.
        const invCClean = window.T3.data.invoice({ id: 'INV-9007', customerId: 'CUS-302', customerName: 'Bay Textiles Ltd.' });
        const invCInjected = window.T3.inject.injectCrossReferenceMismatch(invCClean, 'customerId', 'CUS-399');
        const invC = Object.assign({ __domain: 'invoice', __kind: 'flag', __field: 'customerId' }, invCInjected.corruptedRecord);

        return [invA, invB, attA, attB, invtA, invtB, invC];
    }

    function isRecordFixed(r) {
        if (r.__kind !== 'correctable') return false;
        const field = r.__field;
        const actual = r[field];
        const expected = r.__clean[field];
        if (field === 'total') return Number(actual) === Number(expected);
        return norm(actual) === norm(expected);
    }

    // ============================================================
    //  MODULE 1 — Inspect Records (batch-scale flagging)
    // ============================================================
    let m1Flags = {};
    function initModule1() {
        m1Flags = {};
        renderModule1();
    }

    function renderModule1() {
        $('#m1-records').innerHTML = batch.map(r => {
            const flagged = !!m1Flags[r.id];
            const rows = DOMAIN_FIELDS[r.__domain].map(f => ledgerRow(f, fieldLabel(f), r[f])).join('');
            return `
                <div class="inspect-card">
                    <div class="ledger">
                        <div class="ledger-title">${DOMAIN_LABEL[r.__domain]} · ${r.id}</div>
                        ${rows}
                    </div>
                    <div class="flag-row">
                        <span class="flag-pill ${flagged ? 'flagged' : ''}">${flagged ? '🚩 Flagged' : 'Not flagged'}</span>
                        <button class="btn btn-secondary btn-sm" data-id="${r.id}">${flagged ? 'Unflag' : 'Flag as error'}</button>
                    </div>
                </div>
            `;
        }).join('');

        $$('#m1-records button[data-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                m1Flags[id] = !m1Flags[id];
                renderModule1();
                updateM1Status();
            });
        });
        updateM1Status();
    }

    function updateM1Status() {
        const count = Object.values(m1Flags).filter(Boolean).length;
        $('#m1-status').textContent = `${count} of ${batch.length} records flagged.`;
    }

    $('#m1-check').addEventListener('click', () => {
        let correct = 0, falsePositives = 0;
        const totalErrors = batch.filter(r => r.__kind !== 'clean').length;
        batch.forEach(r => {
            const flagged = !!m1Flags[r.id];
            const hasError = r.__kind !== 'clean';
            if (flagged && hasError) correct++;
            else if (flagged && !hasError) falsePositives++;
        });
        const accuracy = totalErrors > 0 ? Math.round((correct / totalErrors) * 100) : 0;

        if (correct === totalErrors && falsePositives === 0) {
            feedback('#m1-feedback', true, `✅ All ${totalErrors} erroneous records correctly flagged, zero false positives.`);
            markModuleDone(1);
        } else {
            feedback('#m1-feedback', false, `Accuracy: ${accuracy}% (${correct}/${totalErrors} errors caught). False positives: ${falsePositives}. Re-check the batch above.`);
        }
    });

    // ============================================================
    //  MODULE 2 — Correct Records (command-stack undo/redo, reused
    //  from Lesson 2 Module 3)
    // ============================================================
    const m2Stacks = {};
    function initModule2() {
        batch.filter(r => r.__kind === 'correctable').forEach(r => { m2Stacks[r.id] = new window.T3.CommandStack(); });
        renderModule2();
    }

    function bindEditableLedger(container, record, stack, onCommit) {
        $$('input', container).forEach(el => {
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
                if (onCommit) onCommit();
            };
            el.addEventListener('change', commit);
        });
    }

    function renderModule2() {
        const correctable = batch.filter(r => r.__kind === 'correctable');
        const flagOnly = batch.filter(r => r.__kind === 'flag');

        $('#m2-records').innerHTML = correctable.map(r => {
            const rows = DOMAIN_FIELDS[r.__domain].map(f => ledgerRow(f, fieldLabel(f), r[f], { editable: f === r.__field })).join('');
            const stack = m2Stacks[r.id];
            return `
                <div class="correct-card">
                    <div class="ledger">
                        <div class="ledger-title">${DOMAIN_LABEL[r.__domain]} · ${r.id}</div>
                        ${rows}
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <button class="btn btn-secondary btn-sm" data-undo="${r.id}" ${stack.canUndo() ? '' : 'disabled'}>↶ Undo</button>
                        <span style="font-size:0.78rem;color:rgba(255,255,255,0.5);">${isRecordFixed(r) ? '✅ Matches expected value' : '⭕ Not yet corrected'}</span>
                    </div>
                </div>
            `;
        }).join('') + flagOnly.map(r => {
            const rows = DOMAIN_FIELDS[r.__domain].map(f => ledgerRow(f, fieldLabel(f), r[f])).join('');
            return `
                <div class="flag-only-note">🚩 <strong>${DOMAIN_LABEL[r.__domain]} · ${r.id}</strong> — this can't be verified from the data on hand alone. Leave it flagged for a supervisor rather than guessing.</div>
                <div class="flag-only-ledger">
                    <div class="ledger">
                        <div class="ledger-title">${DOMAIN_LABEL[r.__domain]} · ${r.id} (flagged)</div>
                        ${rows}
                    </div>
                </div>
            `;
        }).join('');

        $$('.correct-card').forEach((card, i) => {
            bindEditableLedger(card, correctable[i], m2Stacks[correctable[i].id], () => renderModule2());
        });
        $$('#m2-records button[data-undo]').forEach(btn => {
            btn.addEventListener('click', () => { m2Stacks[btn.dataset.undo].undo(); renderModule2(); });
        });

        const fixedCount = correctable.filter(isRecordFixed).length;
        $('#m2-status').textContent = `${fixedCount} of ${correctable.length} correctable records fixed.`;
    }

    $('#m2-check').addEventListener('click', () => {
        const correctable = batch.filter(r => r.__kind === 'correctable');
        const fixedCount = correctable.filter(isRecordFixed).length;
        if (fixedCount === correctable.length) {
            feedback('#m2-feedback', true, '✅ All correctable records now match their expected values. The flagged record was correctly left for a supervisor.');
            markModuleDone(2);
        } else {
            feedback('#m2-feedback', false, `${fixedCount} of ${correctable.length} corrected so far — check the highlighted field on each record above.`);
        }
    });

    // ============================================================
    //  MODULE 3 — Validate Before Submission (rule engine +
    //  duplicate/fuzzy-match engine)
    // ============================================================
    const RULES = [
        { id: 'invoice-total', appliesTo: r => r.__domain === 'invoice', check: r => Number(r.total) === r.lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0), message: 'Total must equal the sum of line items.' },
        { id: 'attendance-checkout-after-checkin', appliesTo: r => r.__domain === 'attendance', check: r => r.checkOut > r.checkIn, message: 'Check-out time must be after check-in time.' },
        { id: 'inventory-nonneg-qty', appliesTo: r => r.__domain === 'inventory', check: r => Number(r.quantity) >= 0, message: 'Quantity cannot be negative.' },
        {
            id: 'invoice-known-customer', appliesTo: r => r.__domain === 'invoice',
            check: r => window.T3.hashLookup.buildIndex(window.T3.data.CUSTOMERS, c => c.customerId).has(r.customerId),
            message: 'Customer ID must exist in the customer master list.'
        }
    ];

    function runValidation() {
        const ruleRows = batch.map(r => ({ record: r, results: window.T3.ruleEngine.evaluateRules(r, RULES) }));
        $('#m3-rules').style.display = 'block';
        $('#m3-rules').innerHTML = `
            <div class="ledger-title">Business rule validation</div>
            <ul class="rule-result-list">
                ${ruleRows.flatMap(rr => rr.results.map(res => {
                    const expectedFail = !res.passed && rr.record.__kind === 'flag';
                    const badgeClass = res.passed ? 'pass' : (expectedFail ? 'expected-fail' : 'fail');
                    const badgeText = res.passed ? 'PASS' : (expectedFail ? 'FLAGGED' : 'FAIL');
                    return `<li class="rule-result-item"><span class="badge ${badgeClass}">${badgeText}</span> <strong>${rr.record.id}</strong> — ${res.message}</li>`;
                })).join('')}
            </ul>
        `;

        const invItems = batch.filter(r => r.__domain === 'inventory');
        const clusters = window.T3.fuzzyMatch.clusterDuplicates(invItems, r => r.itemName, 0.8).filter(c => c.records.length > 1);
        $('#m3-dupes').style.display = 'block';
        $('#m3-dupes').innerHTML = `
            <div class="ledger-title">Duplicate scan (inventory)</div>
            ${clusters.length === 0
                ? '<div style="font-size:0.85rem;color:rgba(255,255,255,0.5);">No duplicate groups found.</div>'
                : `<ul class="dup-group-list">${clusters.map(c => `<li class="dup-group-row"><span class="badge">Group</span> ${c.records.map(r => r.id + ' (' + escapeHtml(r.itemName.trim()) + ')').join(' ≈ ')} — likely duplicates.</li>`).join('')}</ul>`}
        `;

        const unexpectedFailures = ruleRows.some(rr => rr.record.__kind !== 'flag' && rr.results.some(res => !res.passed));
        const totalRules = ruleRows.reduce((s, rr) => s + rr.results.length, 0);
        const passedRules = ruleRows.reduce((s, rr) => s + rr.results.filter(res => res.passed).length, 0);
        $('#m3-status').textContent = `${passedRules} of ${totalRules} rule checks passed. ${clusters.length} duplicate group(s) found.`;

        if (!unexpectedFailures) {
            feedback('#m3-feedback', true, '✅ No unexpected rule failures. The flagged record failing "known customer" is expected — that\'s exactly why it was flagged.');
            markModuleDone(3);
        } else {
            feedback('#m3-feedback', false, 'One or more correctable records are still failing validation — go back to Module 2 and finish correcting them.');
        }
    }

    $('#m3-run').addEventListener('click', runValidation);

    // ============================================================
    //  MODULE 4 — Final Submission Report (aggregation/reduce +
    //  JSON export). Stamp-worthy pass requires Modules 1-3 to have
    //  each independently passed their own correctness gate -- this
    //  Track doesn't award completion for merely clicking a button.
    // ============================================================
    function buildReport() {
        const reviewed = batch.length;
        const errorsFound = batch.filter(r => r.__kind !== 'clean').length;
        const correctable = batch.filter(r => r.__kind === 'correctable');
        const correctedCount = correctable.filter(isRecordFixed).length;
        const flaggedCount = batch.filter(r => r.__kind === 'flag').length;
        const invItems = batch.filter(r => r.__domain === 'inventory');
        const dupGroups = window.T3.fuzzyMatch.clusterDuplicates(invItems, r => r.itemName, 0.8).filter(c => c.records.length > 1).length;
        const ruleRows = batch.map(r => ({ record: r, results: window.T3.ruleEngine.evaluateRules(r, RULES) }));
        const allResults = ruleRows.flatMap(rr => rr.results);
        const rulesSummary = window.T3.ruleEngine.summarize(allResults);

        const passed = moduleDone[1] && moduleDone[2] && moduleDone[3];

        return {
            generatedAt: new Date().toISOString(),
            lesson: 'Track 3 · Lesson 4: Workplace Quality Assurance Project',
            recordsReviewed: reviewed,
            errorsFound,
            errorsCorrected: correctedCount,
            errorsFlaggedForSupervisor: flaggedCount,
            duplicateGroupsFound: dupGroups,
            ruleChecks: { total: rulesSummary.total, passed: rulesSummary.passed, failed: rulesSummary.failed.length },
            status: passed ? 'PASS' : 'INCOMPLETE',
            passingCriteria: 'Modules 1 (Inspect), 2 (Correct), and 3 (Validate) must each be completed correctly.',
            batch: batch.map(r => ({ id: r.id, domain: r.__domain, kind: r.__kind }))
        };
    }

    let lastReport = null;
    $('#m4-generate').addEventListener('click', () => {
        lastReport = buildReport();
        const r = lastReport;
        $('#m4-report').innerHTML = `
            <div class="report-status-banner ${r.status === 'PASS' ? 'pass' : 'fail'}">
                ${r.status === 'PASS' ? '✅ PASS — this batch is fit to submit.' : '⏳ INCOMPLETE — finish Modules 1-3 with a correct result first.'}
            </div>
            <div class="report-grid">
                <div class="report-stat"><div class="num">${r.recordsReviewed}</div><div class="label">Reviewed</div></div>
                <div class="report-stat"><div class="num">${r.errorsFound}</div><div class="label">Errors found</div></div>
                <div class="report-stat"><div class="num">${r.errorsCorrected}</div><div class="label">Corrected</div></div>
                <div class="report-stat"><div class="num">${r.errorsFlaggedForSupervisor}</div><div class="label">Flagged</div></div>
                <div class="report-stat"><div class="num">${r.duplicateGroupsFound}</div><div class="label">Dup. groups</div></div>
                <div class="report-stat"><div class="num">${r.ruleChecks.passed}/${r.ruleChecks.total}</div><div class="label">Rules passed</div></div>
            </div>
        `;
        $('#m4-actions').style.display = 'block';
        logEvent(4, 'report_generated', { status: r.status });

        if (r.status === 'PASS') {
            feedback('#m4-feedback', true, '✅ Report generated. Download it below — this is what a real QA handoff looks like.');
            markModuleDone(4);
        } else {
            feedback('#m4-feedback', false, 'Report generated, but the batch isn\'t clean yet. Go back and finish Modules 1-3, then generate again.');
        }
    });

    $('#m4-download').addEventListener('click', () => {
        if (!lastReport) return;
        const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'uttoron-qa-report-' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('Report downloaded.', 'success');
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        batch = buildBatch();
        renderRail();
        initModule1();
        initModule2();
        goToModule(1);
        if (!session) {
            showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
        }
    }

    init();
})();

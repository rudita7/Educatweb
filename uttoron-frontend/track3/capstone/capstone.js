(function () {
    "use strict";

    // ============================================================
    //  STORAGE — same schema as index1.html / lesson2-4.js
    // ============================================================
    const Storage = {
        get(key) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } },
        set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } }
    };

    const LESSON_ID = 'capstone-records-department';

    function loadSession() {
        const data = Storage.get('uttoron:session');
        if (data && data.num) {
            const user = Storage.get('user:' + data.num);
            if (user) return { num: data.num, nickname: user.nickname };
        }
        return null;
    }
    const session = loadSession();

    function logEvent(stageNum, event, meta) {
        const log = Storage.get('analytics:events') || [];
        log.push({ ts: Date.now(), num: session ? session.num : null, track: 'track3-data-accuracy', lesson: 'capstone', module: stageNum, event, meta: meta || null });
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
        logEvent('all', 'capstone_completed', null);
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
        itemName: 'Item', sku: 'SKU', quantity: 'Quantity', location: 'Location', lastUpdated: 'Last Updated', status: 'Status'
    };
    function fieldLabel(f) { return FIELD_LABELS[f] || f; }
    const DOMAIN_LABEL = { invoice: 'Invoice', attendance: 'Attendance', inventory: 'Inventory' };
    const DOMAIN_FIELDS = {
        invoice: ['customerId', 'customerName', 'invoiceDate', 'total'],
        attendance: ['employeeId', 'employeeName', 'date', 'checkIn', 'checkOut'],
        inventory: ['itemName', 'sku', 'quantity', 'location', 'lastUpdated']
    };

    // ============================================================
    //  STAGE RAIL
    // ============================================================
    const MODULES = [
        { n: 1, label: 'Inspect' },
        { n: 2, label: 'Correct' },
        { n: 3, label: 'Validate' },
        { n: 4, label: 'Submit' }
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
        logEvent(n, 'stage_completed', null);
        renderRail();
        showToast('Stage ' + n + ' complete!', 'success');
        awardStampIfComplete();
    }

    // ============================================================
    //  THE BATCH — a larger, mixed-domain dataset (invoices,
    //  attendance sheets, inventory logs) that carries through all
    //  four stages, per spec §8.
    // ============================================================
    let batch = [];

    function buildBatch() {
        const invC1 = Object.assign({ __domain: 'invoice', __kind: 'clean' }, window.T3.data.invoice({ id: 'INV-C1', customerId: 'CUS-302', customerName: 'Bay Textiles Ltd.' }));

        const invC2Clean = window.T3.data.invoice({ id: 'INV-C2', customerId: 'CUS-304', customerName: 'Sundarban Foods' });
        const invC2Injected = window.T3.inject.injectTypo(invC2Clean, 'customerName', Math.random);
        const invC2 = Object.assign({ __domain: 'invoice', __kind: 'correctable', __clean: invC2Clean, __field: 'customerName' }, invC2Injected.corruptedRecord);

        const invC3Clean = window.T3.data.invoice({ id: 'INV-C3', customerId: 'CUS-301', customerName: 'Green Valley Traders' });
        const invC3Injected = window.T3.inject.injectLogicalViolation(invC3Clean, {
            field: 'total', message: 'Total does not match sum of line items.',
            apply(rec) { rec.total = rec.total + 1200; }
        });
        const invC3 = Object.assign({ __domain: 'invoice', __kind: 'correctable', __clean: invC3Clean, __field: 'total' }, invC3Injected.corruptedRecord);

        const invC4Clean = window.T3.data.invoice({ id: 'INV-C4', customerId: 'CUS-303', customerName: 'Dhanmondi Hardware' });
        const invC4Injected = window.T3.inject.injectCrossReferenceMismatch(invC4Clean, 'customerId', 'CUS-499');
        const invC4 = Object.assign({ __domain: 'invoice', __kind: 'flag', __field: 'customerId' }, invC4Injected.corruptedRecord);

        const attC1 = Object.assign({ __domain: 'attendance', __kind: 'clean' }, window.T3.data.attendance({ id: 'ATT-C1', employeeId: 'EMP-104', employeeName: 'Farhana Akter' }));

        const attC2Clean = window.T3.data.attendance({ id: 'ATT-C2', employeeId: 'EMP-108', employeeName: 'Shakil Rahman' });
        const attC2Injected = window.T3.inject.injectMissingField(attC2Clean, 'employeeName');
        const attC2 = Object.assign({ __domain: 'attendance', __kind: 'correctable', __clean: attC2Clean, __field: 'employeeName' }, attC2Injected.corruptedRecord);

        const attC3Clean = window.T3.data.attendance({ id: 'ATT-C3', employeeId: 'EMP-119', employeeName: 'Imran Kabir', checkIn: '09:00', checkOut: '17:30' });
        const attC3Injected = window.T3.inject.injectLogicalViolation(attC3Clean, {
            field: 'checkOut', message: 'Check-out time must be after check-in time.',
            apply(rec) { rec.checkOut = '07:00'; }
        });
        const attC3 = Object.assign({ __domain: 'attendance', __kind: 'correctable', __clean: attC3Clean, __field: 'checkOut' }, attC3Injected.corruptedRecord);

        const invtC1Clean = window.T3.data.inventory({ id: 'INVT-C1', itemName: 'Sticky Notes', sku: 'STA-3301', quantity: 30, location: 'Shelf A2' });
        const invtC1Injected = window.T3.inject.injectExtraWhitespace(invtC1Clean, 'itemName');
        const invtC1 = Object.assign({ __domain: 'inventory', __kind: 'correctable', __clean: invtC1Clean, __field: 'itemName' }, invtC1Injected.corruptedRecord);

        // Near-duplicate of INVT-C1 -- not an "error" on its own (clean for
        // Stage 1's ground truth), but Stage 3's duplicate scan should catch
        // the pair. Genuinely exercises injectDuplicate() (spec §2.2).
        const dupResult = window.T3.inject.injectDuplicate(invtC1Clean, { field: 'itemName', transform: v => String(v).toLowerCase() });
        const invtC2 = Object.assign({ __domain: 'inventory', __kind: 'clean' }, dupResult.corruptedRecord, { id: 'INVT-C2' });

        const invtC3Clean = window.T3.data.inventory({ id: 'INVT-C3', itemName: 'Stapler Pins', sku: 'STA-1290', quantity: 20, location: 'Shelf B1', lastUpdated: '2026-07-10' });
        const invtC3Injected = window.T3.inject.injectFormatInconsistency(invtC3Clean, 'lastUpdated', v => {
            const parts = String(v).split('-');
            return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : v;
        });
        const invtC3 = Object.assign({ __domain: 'inventory', __kind: 'correctable', __clean: invtC3Clean, __field: 'lastUpdated' }, invtC3Injected.corruptedRecord);

        return [invC1, invC2, invC3, invC4, attC1, attC2, attC3, invtC1, invtC2, invtC3];
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
    //  SCORING — shared by each stage's own "check" feedback and by
    //  Stage 4's final weighted composite (spec §8: % identified,
    //  % corrected, false-positive rate, and validation cleanliness).
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

    let s1Flags = {};

    function computeIdentifyStats() {
        let correct = 0, falsePositives = 0;
        const totalErrors = batch.filter(r => r.__kind !== 'clean').length;
        const totalClean = batch.filter(r => r.__kind === 'clean').length;
        batch.forEach(r => {
            const flagged = !!s1Flags[r.id];
            const hasError = r.__kind !== 'clean';
            if (flagged && hasError) correct++;
            else if (flagged && !hasError) falsePositives++;
        });
        return {
            correct, falsePositives, totalErrors, totalClean,
            identifyRate: totalErrors > 0 ? correct / totalErrors : 0,
            falsePositiveRate: totalClean > 0 ? falsePositives / totalClean : 0
        };
    }

    function computeCorrectionStats() {
        const correctable = batch.filter(r => r.__kind === 'correctable');
        const fixed = correctable.filter(isRecordFixed).length;
        return { fixed, total: correctable.length, correctionRate: correctable.length > 0 ? fixed / correctable.length : 0 };
    }

    function computeValidationStats() {
        const ruleRows = batch.map(r => ({ record: r, results: window.T3.ruleEngine.evaluateRules(r, RULES) }));
        // Rule failures tied to the flagged (flag-only) record are expected --
        // that's exactly why it was flagged -- so they don't count against
        // the learner's validation score.
        const gradable = ruleRows.filter(rr => rr.record.__kind !== 'flag').flatMap(rr => rr.results);
        const passed = gradable.filter(res => res.passed).length;
        const invItems = batch.filter(r => r.__domain === 'inventory');
        const dupGroups = window.T3.fuzzyMatch.clusterDuplicates(invItems, r => r.itemName, 0.8).filter(c => c.records.length > 1).length;
        return { ruleRows, gradableTotal: gradable.length, gradablePassed: passed, rulePassRate: gradable.length > 0 ? passed / gradable.length : 0, dupGroups };
    }

    function computeComposite() {
        const id = computeIdentifyStats();
        const co = computeCorrectionStats();
        const va = computeValidationStats();
        const factors = {
            identifyRate: id.identifyRate,
            correctionRate: co.correctionRate,
            cleanFlagging: 1 - id.falsePositiveRate,
            rulePassRate: va.rulePassRate
        };
        const composite = Math.round(((factors.identifyRate + factors.correctionRate + factors.cleanFlagging + factors.rulePassRate) / 4) * 100);
        return { id, co, va, factors, composite, passed: composite >= 80 };
    }

    // ============================================================
    //  STAGE 1 — Inspect
    // ============================================================
    function initStage1() {
        s1Flags = {};
        renderStage1();
    }

    function renderStage1() {
        $('#s1-records').innerHTML = batch.map(r => {
            const flagged = !!s1Flags[r.id];
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

        $$('#s1-records button[data-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                s1Flags[btn.dataset.id] = !s1Flags[btn.dataset.id];
                renderStage1();
            });
        });
        const count = Object.values(s1Flags).filter(Boolean).length;
        $('#s1-status').textContent = `${count} of ${batch.length} records flagged.`;
    }

    $('#s1-check').addEventListener('click', () => {
        const stats = computeIdentifyStats();
        const accuracy = Math.round(stats.identifyRate * 100);
        if (stats.correct === stats.totalErrors && stats.falsePositives === 0) {
            feedback('#s1-feedback', true, `✅ All ${stats.totalErrors} erroneous records correctly flagged, zero false positives.`);
            markModuleDone(1);
        } else {
            feedback('#s1-feedback', false, `Accuracy: ${accuracy}% (${stats.correct}/${stats.totalErrors} errors caught). False positives: ${stats.falsePositives}. Re-check the batch above.`);
        }
    });

    // ============================================================
    //  STAGE 2 — Correct
    // ============================================================
    const s2Stacks = {};
    function initStage2() {
        batch.filter(r => r.__kind === 'correctable').forEach(r => { s2Stacks[r.id] = new window.T3.CommandStack(); });
        renderStage2();
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

    function renderStage2() {
        const correctable = batch.filter(r => r.__kind === 'correctable');
        const flagOnly = batch.filter(r => r.__kind === 'flag');

        $('#s2-records').innerHTML = correctable.map(r => {
            const rows = DOMAIN_FIELDS[r.__domain].map(f => ledgerRow(f, fieldLabel(f), r[f], { editable: f === r.__field })).join('');
            const stack = s2Stacks[r.id];
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
            bindEditableLedger(card, correctable[i], s2Stacks[correctable[i].id], () => renderStage2());
        });
        $$('#s2-records button[data-undo]').forEach(btn => {
            btn.addEventListener('click', () => { s2Stacks[btn.dataset.undo].undo(); renderStage2(); });
        });

        const stats = computeCorrectionStats();
        $('#s2-status').textContent = `${stats.fixed} of ${stats.total} correctable records fixed.`;
    }

    $('#s2-check').addEventListener('click', () => {
        const stats = computeCorrectionStats();
        if (stats.fixed === stats.total) {
            feedback('#s2-feedback', true, '✅ All correctable records now match their expected values. The flagged record was correctly left for a supervisor.');
            markModuleDone(2);
        } else {
            feedback('#s2-feedback', false, `${stats.fixed} of ${stats.total} corrected so far — check the highlighted field on each record above.`);
        }
    });

    // ============================================================
    //  STAGE 3 — Validate
    // ============================================================
    function runValidation() {
        const stats = computeValidationStats();
        $('#s3-rules').style.display = 'block';
        $('#s3-rules').innerHTML = `
            <div class="ledger-title">Business rule validation</div>
            <ul class="rule-result-list">
                ${stats.ruleRows.flatMap(rr => rr.results.map(res => {
                    const expectedFail = !res.passed && rr.record.__kind === 'flag';
                    const badgeClass = res.passed ? 'pass' : (expectedFail ? 'expected-fail' : 'fail');
                    const badgeText = res.passed ? 'PASS' : (expectedFail ? 'FLAGGED' : 'FAIL');
                    return `<li class="rule-result-item"><span class="badge ${badgeClass}">${badgeText}</span> <strong>${rr.record.id}</strong> — ${res.message}</li>`;
                })).join('')}
            </ul>
        `;

        const invItems = batch.filter(r => r.__domain === 'inventory');
        const clusters = window.T3.fuzzyMatch.clusterDuplicates(invItems, r => r.itemName, 0.8).filter(c => c.records.length > 1);
        $('#s3-dupes').style.display = 'block';
        $('#s3-dupes').innerHTML = `
            <div class="ledger-title">Duplicate scan (inventory)</div>
            ${clusters.length === 0
                ? '<div style="font-size:0.85rem;color:rgba(255,255,255,0.5);">No duplicate groups found.</div>'
                : `<ul class="dup-group-list">${clusters.map(c => `<li class="dup-group-row"><span class="badge">Group</span> ${c.records.map(r => r.id + ' (' + escapeHtml(r.itemName.trim()) + ')').join(' ≈ ')} — likely duplicates.</li>`).join('')}</ul>`}
        `;

        $('#s3-status').textContent = `${stats.gradablePassed} of ${stats.gradableTotal} rule checks passed. ${stats.dupGroups} duplicate group(s) found.`;

        if (stats.gradablePassed === stats.gradableTotal) {
            feedback('#s3-feedback', true, '✅ No unexpected rule failures. The flagged record failing "known customer" is expected — that\'s exactly why it was flagged.');
            markModuleDone(3);
        } else {
            feedback('#s3-feedback', false, 'One or more correctable records are still failing validation — go back to Stage 2 and finish correcting them.');
        }
    }

    $('#s3-run').addEventListener('click', runValidation);

    // ============================================================
    //  STAGE 4 — Submit (weighted composite score + exportable
    //  Quality Report, spec §8: identify %, correction %,
    //  false-positive rate, and validation cleanliness, each
    //  weighted equally, gated at an explicit >=80% threshold).
    // ============================================================
    let lastReport = null;

    function buildReport(score) {
        return {
            generatedAt: new Date().toISOString(),
            lesson: 'Track 3 · Capstone: A Day in the Records Department',
            recordsReviewed: batch.length,
            errorsFound: score.id.totalErrors,
            errorsCorrectlyIdentified: score.id.correct,
            falsePositives: score.id.falsePositives,
            errorsCorrected: score.co.fixed,
            errorsFlaggedForSupervisor: batch.filter(r => r.__kind === 'flag').length,
            duplicateGroupsFound: score.va.dupGroups,
            ruleChecks: { total: score.va.gradableTotal, passed: score.va.gradablePassed },
            scoreBreakdown: {
                identifyRate: Math.round(score.factors.identifyRate * 100),
                correctionRate: Math.round(score.factors.correctionRate * 100),
                cleanFlaggingRate: Math.round(score.factors.cleanFlagging * 100),
                validationRate: Math.round(score.factors.rulePassRate * 100)
            },
            compositeScore: score.composite,
            passingThreshold: 80,
            status: score.passed ? 'PASS' : 'BELOW THRESHOLD',
            batch: batch.map(r => ({ id: r.id, domain: r.__domain, kind: r.__kind }))
        };
    }

    $('#s4-generate').addEventListener('click', () => {
        const score = computeComposite();
        lastReport = buildReport(score);
        const r = lastReport;

        $('#s4-report').innerHTML = `
            <div class="composite-banner ${score.passed ? 'pass' : 'fail'}">
                <div class="composite-num">${score.composite}%</div>
                <div class="composite-label">${score.passed ? '✅ PASS — composite meets the 80% threshold' : '⏳ Below the 80% passing threshold'}</div>
            </div>
            <div class="score-grid">
                <div class="score-stat"><div class="num">${r.scoreBreakdown.identifyRate}%</div><div class="label">Identified</div></div>
                <div class="score-stat"><div class="num">${r.scoreBreakdown.correctionRate}%</div><div class="label">Corrected</div></div>
                <div class="score-stat"><div class="num">${r.scoreBreakdown.cleanFlaggingRate}%</div><div class="label">Clean flagging</div></div>
                <div class="score-stat"><div class="num">${r.scoreBreakdown.validationRate}%</div><div class="label">Validation</div></div>
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
        $('#s4-actions').style.display = 'block';
        logEvent(4, 'report_generated', { composite: score.composite });

        if (score.passed) {
            feedback('#s4-feedback', true, '✅ Report generated. Download it below — this is what a real end-of-day QA handoff looks like.');
            markModuleDone(4);
        } else {
            feedback('#s4-feedback', false, 'Report generated, but the composite score is below 80%. Go back to whichever stage scored lowest above, fix it, then generate again.');
        }
    });

    $('#s4-download').addEventListener('click', () => {
        if (!lastReport) return;
        const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'uttoron-capstone-report-' + Date.now() + '.json';
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
        initStage1();
        initStage2();
        goToModule(1);
        if (!session) {
            showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
        }
    }

    init();
})();

(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-lesson3-structure',
        trackKey: 'presentation-skills',
        modules: [
            { n: 1, label: 'Practice' },
            { n: 2, label: 'Checkpoint' },
            { n: 3, label: 'Do It For Real' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, markModuleDone, session } = shell;

    const ROLES = {
        title:   { label: 'Title',   desc: 'Topic + your name',   color: '#2b3a67' },
        agenda:  { label: 'Agenda',  desc: 'What you\'ll cover',  color: '#3a6ea5' },
        content: { label: 'Content', desc: 'One main point',      color: '#2E7D5B' },
        closing: { label: 'Closing', desc: 'Summary + thanks',    color: '#C43E1C' }
    };

    // ============================================================
    //  Shared sorter renderer (▲▼ accessible reorder + native drag)
    // ============================================================
    function renderSorter(containerSel, slides, opts) {
        opts = opts || {};
        const container = $(containerSel);
        container.innerHTML = slides.map((s, i) => {
            const r = ROLES[s.role];
            return `
                <div class="sorter-card" draggable="true" data-idx="${i}">
                    <span class="sorter-num">${i + 1}</span>
                    <div class="sorter-canvas" style="border-top:5px solid ${r.color};">
                        <div class="sorter-role">${escapeHtml(r.label)}</div>
                        <div class="sorter-desc">${escapeHtml(r.desc)}</div>
                    </div>
                    <div class="sorter-move">
                        <button type="button" data-move="up" data-idx="${i}" ${i === 0 ? 'disabled' : ''} title="Move left">▲</button>
                        <button type="button" data-move="down" data-idx="${i}" ${i === slides.length - 1 ? 'disabled' : ''} title="Move right">▼</button>
                        ${opts.removable ? `<button type="button" data-remove="${i}" title="Remove">✕</button>` : ''}
                    </div>
                </div>`;
        }).join('') || '<p style="grid-column:1/-1;color:rgba(255,255,255,0.4);font-size:0.85rem;">No slides yet — add some above.</p>';

        $$('[data-move]', container).forEach(btn => btn.addEventListener('click', () => {
            const i = Number(btn.dataset.idx);
            const j = btn.dataset.move === 'up' ? i - 1 : i + 1;
            if (j < 0 || j >= slides.length) return;
            [slides[i], slides[j]] = [slides[j], slides[i]];
            renderSorter(containerSel, slides, opts);
            if (opts.onChange) opts.onChange();
        }));
        if (opts.removable) {
            $$('[data-remove]', container).forEach(btn => btn.addEventListener('click', () => {
                slides.splice(Number(btn.dataset.remove), 1);
                renderSorter(containerSel, slides, opts);
                if (opts.onChange) opts.onChange();
            }));
        }
        // native drag
        let dragIdx = null;
        $$('.sorter-card', container).forEach(card => {
            card.addEventListener('dragstart', () => { dragIdx = Number(card.dataset.idx); card.classList.add('dragging'); });
            card.addEventListener('dragend', () => card.classList.remove('dragging'));
            card.addEventListener('dragover', e => e.preventDefault());
            card.addEventListener('drop', () => {
                const dropIdx = Number(card.dataset.idx);
                if (dragIdx === null || dragIdx === dropIdx) return;
                const [moved] = slides.splice(dragIdx, 1);
                slides.splice(dropIdx, 0, moved);
                dragIdx = null;
                renderSorter(containerSel, slides, opts);
                if (opts.onChange) opts.onChange();
            });
        });
    }

    // ============================================================
    //  STEP 1 — Practice: build the 5-slide skeleton
    // ============================================================
    const TARGET = ['title', 'agenda', 'content', 'content', 'closing'];
    let built = [];

    function renderLayoutPicker() {
        $('#layoutPicker').innerHTML = Object.keys(ROLES).map(role =>
            `<button type="button" class="layout-opt" data-role="${role}">➕ ${escapeHtml(ROLES[role].label)}</button>`
        ).join('');
        $$('#layoutPicker .layout-opt').forEach(btn => btn.addEventListener('click', () => {
            if (built.length >= 6) { showToast('That\'s plenty of slides for this skeleton.', ''); return; }
            built.push({ role: btn.dataset.role });
            renderSorter('#buildSorter', built, { removable: true, onChange: updateM1 });
            updateM1();
        }));
    }
    function updateM1() {
        $('#m1-status').textContent = built.length + ' slide' + (built.length === 1 ? '' : 's') + ' added';
    }
    $('#m1-check').addEventListener('click', () => {
        if (built.length !== TARGET.length) {
            feedback('#m1-feedback', false, `You need exactly ${TARGET.length} slides: Title, Agenda, two Content, and Closing. You have ${built.length}.`);
            return;
        }
        const roles = built.map(s => s.role);
        const matches = roles.every((r, i) => r === TARGET[i]);
        if (matches) {
            feedback('#m1-feedback', true, '✅ Perfect skeleton: open with a Title, set expectations with an Agenda, make your points, and close cleanly.');
            markModuleDone(1);
            shell.goToModule(2);
        } else {
            const counts = roles.reduce((a, r) => (a[r] = (a[r] || 0) + 1, a), {});
            const need = { title: 1, agenda: 1, content: 2, closing: 1 };
            const countOk = Object.keys(need).every(k => counts[k] === need[k]);
            if (!countOk) {
                feedback('#m1-feedback', false, 'You have the wrong mix — it should be exactly 1 Title, 1 Agenda, 2 Content, 1 Closing.');
            } else {
                feedback('#m1-feedback', false, 'Right slides, wrong order. Title goes first, Closing last, Agenda right after the Title.');
            }
        }
    });

    // ============================================================
    //  STEP 2 — Checkpoint: fix the jumbled 4-slide deck
    // ============================================================
    // Deliberately scrambled: opens on Content, Title buried, Closing not last.
    let jumbled = [{ role: 'content' }, { role: 'closing' }, { role: 'title' }, { role: 'agenda' }];
    const FIX_TARGET = ['title', 'agenda', 'content', 'closing'];

    $('#m2-check').addEventListener('click', () => {
        const roles = jumbled.map(s => s.role);
        if (roles.every((r, i) => r === FIX_TARGET[i])) {
            feedback('#m2-feedback', true, '✅ Fixed — it now opens on the Title and ends on the Closing, with the Agenda up front where it belongs.');
            markModuleDone(2);
            shell.goToModule(3);
        } else {
            let hint = 'Not yet. ';
            if (roles[0] !== 'title') hint += 'A deck should open on its Title slide. ';
            else if (roles[roles.length - 1] !== 'closing') hint += 'The Closing should be the very last slide. ';
            else hint += 'The Agenda should come right after the Title. ';
            feedback('#m2-feedback', false, hint);
        }
    });

    // ============================================================
    //  STEP 3 — Do It For Real
    // ============================================================
    $('#m3-finish').addEventListener('click', () => {
        if (!$('#m3-done').checked) {
            feedback('#m3-feedback', false, 'Check the box once you\'ve built the 5-slide skeleton in your real file.');
            return;
        }
        feedback('#m3-feedback', true, '✅ Structure in place. Next you\'ll fill it with text that actually works.');
        markModuleDone(3);
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        shell.renderRail();
        renderLayoutPicker();
        renderSorter('#buildSorter', built, { removable: true, onChange: updateM1 });
        updateM1();
        renderSorter('#fixSorter', jumbled, { removable: false });
        shell.goToModule(1);
        if (!session) showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
    }
    init();
})();

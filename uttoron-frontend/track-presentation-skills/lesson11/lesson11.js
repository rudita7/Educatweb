(function () {
    "use strict";

    const shell = PS.createLessonShell({
        lessonId: 'ps-lesson11-slideshow',
        trackKey: 'presentation-skills',
        modules: [
            { n: 1, label: 'Practice' },
            { n: 2, label: 'Checkpoint' },
            { n: 3, label: 'Do It For Real' }
        ]
    });
    const { $, $$, escapeHtml, showToast, feedback, markModuleDone, session } = shell;

    const SLIDES = ['Welcome', 'Agenda', 'The Problem', 'Our Solution', 'Results So Far', 'Thank You'];
    const NOTES = ['Smile, say hello', 'Three things today', 'Keep it brief', 'This is the core', 'Point at the chart', 'Ask for questions'];

    // ============================================================
    //  STEP 1 — Practice: present mode + presenter view
    // ============================================================
    let presentIdx = 0;
    const presentVisited = new Set();
    let presenterOpened = false;

    function updateM1Status() {
        $('#m1-status').textContent = `${presentVisited.size} of ${SLIDES.length} slides viewed · Presenter View ${presenterOpened ? 'opened ✓' : 'not opened yet'}`;
        $('#m1-continue').disabled = !(presentVisited.size >= SLIDES.length && presenterOpened);
    }

    function updatePresentSlide() {
        $('#presentSlide').innerHTML = PS_PPT.canvas({ title: SLIDES[presentIdx] });
        $('#presentCounter').textContent = `${presentIdx + 1} / ${SLIDES.length}`;
        presentVisited.add(presentIdx);
        updateM1Status();
    }
    $('#startPresent').addEventListener('click', () => { presentIdx = 0; $('#presentOverlay').classList.remove('hidden'); updatePresentSlide(); });
    $('#presentExit').addEventListener('click', () => { $('#presentOverlay').classList.add('hidden'); if (presentVisited.size >= SLIDES.length) feedback('#m1-feedback', true, '✅ You navigated the whole deck.'); });
    $('#presentPrev').addEventListener('click', () => { presentIdx = (presentIdx - 1 + SLIDES.length) % SLIDES.length; updatePresentSlide(); });
    $('#presentNext').addEventListener('click', () => { presentIdx = (presentIdx + 1) % SLIDES.length; updatePresentSlide(); });
    document.addEventListener('keydown', (e) => {
        if (!$('#presentOverlay').classList.contains('hidden')) {
            if (e.key === 'ArrowRight') $('#presentNext').click();
            if (e.key === 'ArrowLeft') $('#presentPrev').click();
            if (e.key === 'Escape') $('#presentExit').click();
        }
        if (!$('#drillOverlay').classList.contains('hidden')) {
            if (e.key === 'ArrowRight') $('#drillNext').click();
            if (e.key === 'ArrowLeft') $('#drillPrev').click();
        }
    });

    let presenterIdx = 0;
    function updatePresenterSlide() {
        $('#presenterCurrent').innerHTML = PS_PPT.canvas({ title: SLIDES[presenterIdx] });
        const next = SLIDES[presenterIdx + 1];
        $('#presenterNext').innerHTML = next ? PS_PPT.canvas({ title: next }) : '<p style="color:rgba(255,255,255,0.4);font-size:0.85rem;">(end of deck)</p>';
        $('#presenterNotes').textContent = NOTES[presenterIdx];
        $('#presenterCounter').textContent = `${presenterIdx + 1} / ${SLIDES.length}`;
    }
    $('#startPresenter').addEventListener('click', () => { presenterIdx = 0; presenterOpened = true; $('#presenterOverlay').classList.remove('hidden'); updatePresenterSlide(); updateM1Status(); });
    $('#presenterExit').addEventListener('click', () => $('#presenterOverlay').classList.add('hidden'));
    $('#presenterPrev').addEventListener('click', () => { presenterIdx = Math.max(0, presenterIdx - 1); updatePresenterSlide(); });
    $('#presenterNextBtn').addEventListener('click', () => { presenterIdx = Math.min(SLIDES.length - 1, presenterIdx + 1); updatePresenterSlide(); });

    $('#m1-continue').addEventListener('click', () => { markModuleDone(1); shell.goToModule(2); });

    // ============================================================
    //  STEP 2 — Checkpoint: timed drill, 8 slides < 60s
    // ============================================================
    const DRILL_SLIDES = ['Title', 'Agenda', 'Point 1', 'Point 2', 'Point 3', 'Data', 'Next Steps', 'Thank You'];
    let drillIdx = 0;
    let drillStart = 0;
    let drillTimerHandle = null;
    const drillVisited = new Set();

    function updateDrillSlide() {
        $('#drillSlide').innerHTML = PS_PPT.canvas({ title: DRILL_SLIDES[drillIdx] });
        $('#drillCounter').textContent = `${drillIdx + 1} / ${DRILL_SLIDES.length}`;
        drillVisited.add(drillIdx);
        if (drillVisited.size >= DRILL_SLIDES.length) finishDrill();
    }
    $('#startDrill').addEventListener('click', () => {
        drillIdx = 0; drillVisited.clear();
        $('#drillOverlay').classList.remove('hidden');
        drillStart = performance.now();
        drillTimerHandle = setInterval(() => {
            $('#drillTimer').textContent = ((performance.now() - drillStart) / 1000).toFixed(1) + 's';
        }, 100);
        updateDrillSlide();
    });
    $('#drillPrev').addEventListener('click', () => { drillIdx = Math.max(0, drillIdx - 1); updateDrillSlide(); });
    $('#drillNext').addEventListener('click', () => { drillIdx = Math.min(DRILL_SLIDES.length - 1, drillIdx + 1); updateDrillSlide(); });
    $('#drillExit').addEventListener('click', () => { clearInterval(drillTimerHandle); $('#drillOverlay').classList.add('hidden'); });

    function finishDrill() {
        clearInterval(drillTimerHandle);
        const seconds = (performance.now() - drillStart) / 1000;
        setTimeout(() => {
            $('#drillOverlay').classList.add('hidden');
            if (seconds <= 60) {
                feedback('#m2-feedback', true, `✅ ${seconds.toFixed(1)}s — under a minute. That's confident navigation.`);
                markModuleDone(2);
                shell.goToModule(3);
            } else {
                feedback('#m2-feedback', false, `${seconds.toFixed(1)}s — a bit slow. Try again, using the arrow keys instead of hunting for buttons.`);
            }
        }, 300);
    }

    // ============================================================
    //  STEP 3 — Do It For Real
    // ============================================================
    $('#m3-finish').addEventListener('click', () => {
        if (!$('#m3-done').checked) { feedback('#m3-feedback', false, 'Check the box once you\'ve run your real deck as a slideshow, start to finish.'); return; }
        feedback('#m3-feedback', true, '✅ You know the controls cold now. Next: delivery.');
        markModuleDone(3);
    });

    // ============================================================
    //  INIT
    // ============================================================
    function init() {
        shell.renderRail();
        updateM1Status();
        shell.goToModule(1);
        if (!session) showToast('You’re not signed in — progress here won’t save to a passport. Sign in from the home page first.', 'error');
    }
    init();
})();

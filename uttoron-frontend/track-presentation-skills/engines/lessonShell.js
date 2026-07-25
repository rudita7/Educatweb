/* Shared lesson-page boilerplate: Skills Passport session/localStorage
   plumbing, the module rail, stamp-on-completion, toast/feedback helpers.
   Every lesson in this track (and the capstone) calls PS.createLessonShell()
   once instead of re-implementing this — the v1 build of this track had
   this duplicated verbatim in every lesson.js file; with 6 lessons + a
   capstone in v2, that duplication stops being reasonable. */
(function (global) {
    "use strict";

    const Storage = {
        get(key) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } },
        set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } },
        remove(key) { try { localStorage.removeItem(key); return true; } catch { return false; } }
    };

    function loadSession() {
        const data = Storage.get('uttoron:session');
        if (data && data.num) {
            const user = Storage.get('user:' + data.num);
            if (user) return { num: data.num, nickname: user.nickname };
        }
        return null;
    }

    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
    function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

    /**
     * @param {Object} opts
     * @param {string} opts.lessonId - progress key, e.g. 'ps-lesson1-getting-started'
     * @param {string} opts.trackKey - analytics track key, e.g. 'presentation-skills-v2'
     * @param {{n:number,label:string}[]} opts.modules - module rail definition
     */
    function createLessonShell(opts) {
        const {
            lessonId, trackKey, modules,
            railSelector = '#moduleRail',
            bannerSelector = '#lessonStampBanner',
            toastSelector = '#toast'
        } = opts;

        const session = loadSession();
        const moduleDone = {};
        modules.forEach(m => { moduleDone[m.n] = false; });
        let activeModule = modules[0].n;
        let toastTimer = null;
        let onModuleChange = null;
        let onAllComplete = null;

        function showToast(msg, type) {
            const el = $(toastSelector);
            if (!el) return;
            el.textContent = msg;
            el.className = 'toast show ' + (type || '');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
        }

        function feedback(sel, ok, html) {
            const el = $(sel);
            if (!el) return null;
            el.className = 'feedback show ' + (ok ? 'ok' : 'error');
            el.innerHTML = html;
            return el;
        }
        function resetFeedback(sel) { const el = $(sel); if (el) el.className = 'feedback'; }

        function logEvent(moduleNum, event, meta) {
            const log = Storage.get('analytics:events') || [];
            log.push({ ts: Date.now(), num: session ? session.num : null, track: trackKey, lesson: lessonId, module: moduleNum, event, meta: meta || null });
            if (log.length > 500) log.shift();
            Storage.set('analytics:events', log);
        }

        function awardStampIfComplete() {
            if (!modules.every(m => moduleDone[m.n])) return;
            if (session) {
                const progress = Storage.get('progress:' + session.num) || {};
                progress[lessonId] = true;
                Storage.set('progress:' + session.num, progress);
            }
            const banner = $(bannerSelector);
            if (banner) banner.classList.add('show');
            logEvent('all', 'lesson_completed', null);
            if (onAllComplete) onAllComplete();
        }

        function renderRail() {
            const rail = $(railSelector);
            if (!rail) return;
            rail.innerHTML = modules.map(m => `
                <button class="module-dot ${m.n === activeModule ? 'active' : ''} ${moduleDone[m.n] ? 'done' : ''}" data-goto="${m.n}">
                    <span class="num">${m.n}</span> ${escapeHtml(m.label)}
                </button>
            `).join('');
            $$('[data-goto]', rail).forEach(btn => btn.addEventListener('click', () => goToModule(Number(btn.dataset.goto))));
        }

        function goToModule(n) {
            activeModule = n;
            $$('.module-panel').forEach(p => p.classList.toggle('active', Number(p.dataset.module) === n));
            renderRail();
            if (onModuleChange) onModuleChange(n);
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

        return {
            session, Storage, $, $$, escapeHtml,
            showToast, feedback, resetFeedback, logEvent,
            renderRail, goToModule, markModuleDone, awardStampIfComplete,
            get activeModule() { return activeModule; },
            set onModuleChange(fn) { onModuleChange = fn; },
            set onAllComplete(fn) { onAllComplete = fn; },
            isModuleDone: n => moduleDone[n],
            allDone: () => modules.every(m => moduleDone[m.n])
        };
    }

    global.PS = global.PS || {};
    global.PS.Storage = Storage;
    global.PS.loadSession = loadSession;
    global.PS.createLessonShell = createLessonShell;
    global.PS.$ = $;
    global.PS.$$ = $$;
    global.PS.escapeHtml = escapeHtml;
})(window);

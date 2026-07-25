/* Small HTML-builder helpers for the simulated PowerPoint chrome (spec §2/§3).
   Pure string builders — no state, no network — so each lesson can compose the
   mock window it needs (start screen, a ribbon tab, a canvas) without repeating
   the same markup. Hotspot wiring (which tab/button is the target, and what
   happens on click) is done by each lesson's own JS, since that's lesson-specific.
   The visual styling lives in shared/presentationSkills.css. */
(function (global) {
    "use strict";

    function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

    const ALL_TABS = ['File', 'Home', 'Insert', 'Design', 'Transitions', 'Animations', 'Slide Show', 'Review', 'View'];

    // titlebar + tab strip. `activeTab` is highlighted; `hotspotTab` gets the
    // pulsing ring (used by Explore steps). Tabs carry data-tab for click wiring.
    function chrome(opts) {
        opts = opts || {};
        const filename = opts.filename || 'Presentation1 — PowerPoint';
        const tabs = opts.tabs || ALL_TABS;
        const active = opts.activeTab || 'Home';
        const hotspot = opts.hotspotTab || null;
        const tabsHtml = tabs.map(t =>
            `<button class="ppt-tab ${t === active ? 'active' : ''} ${t === hotspot ? 'hotspot' : ''}" data-tab="${esc(t)}">${esc(t)}</button>`
        ).join('');
        return `
            <div class="ppt-titlebar">
                <span class="ppt-logo">P</span>
                <span class="ppt-filename">${esc(filename)}</span>
                <span class="ppt-dots"><span></span><span></span><span></span></span>
            </div>
            <div class="ppt-tabs">${tabsHtml}</div>
        `;
    }

    // A ribbon button. `id` (optional) + `hotspot` flag for Explore targets.
    function btn(b) {
        return `<button class="ppt-btn ${b.big ? 'big' : ''} ${b.hotspot ? 'hotspot' : ''}" ${b.id ? `id="${esc(b.id)}"` : ''} data-btn="${esc(b.key || b.label)}">
            <span class="ppt-btn-icon">${b.icon || '▫️'}</span>
            <span class="ppt-btn-label">${esc(b.label)}</span>
        </button>`;
    }

    // A labeled group of ribbon buttons.
    function group(label, buttons) {
        return `<div class="ppt-group"><div class="ppt-group-btns">${buttons.map(btn).join('')}</div><div class="ppt-group-label">${esc(label)}</div></div>`;
    }

    function ribbon(groupsHtml) {
        return `<div class="ppt-ribbon">${groupsHtml}</div>`;
    }

    // Renders a single slide's content onto the main canvas.
    function canvas(slide) {
        slide = slide || {};
        let inner = '';
        const title = slide.title
            ? `<div class="slide-title">${esc(slide.title)}</div>`
            : `<div class="slide-title placeholder">Click to add title</div>`;
        if (slide.bullets && slide.bullets.length) {
            inner = `<ul>${slide.bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>`;
        } else if (slide.subtitle !== undefined) {
            inner = slide.subtitle
                ? `<div class="slide-sub">${esc(slide.subtitle)}</div>`
                : `<div class="slide-sub placeholder">Click to add subtitle</div>`;
        }
        return `<div class="ppt-canvas-wrap"><div class="ppt-canvas">${title}${inner}</div></div>`;
    }

    function window(innerHtml) {
        return `<div class="ppt-window">${innerHtml}</div>`;
    }

    // ---- tiny chart renderer (bar / line / pie), pure SVG, no libraries ----
    const CHART_COLORS = ['#C43E1C', '#2E7D5B', '#3a6ea5', '#E8A33D'];

    function chartSVG(type, data, opts) {
        opts = opts || {};
        const w = 300, h = 180, pad = 28;
        const max = Math.max(...data.map(d => d.value), 1);
        if (type === 'bar') {
            const bw = (w - pad * 2) / data.length - 10;
            const bars = data.map((d, i) => {
                const bh = (d.value / max) * (h - pad * 2);
                const x = pad + i * ((w - pad * 2) / data.length) + 5;
                const y = h - pad - bh;
                return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${CHART_COLORS[i % CHART_COLORS.length]}" rx="3"/>
                        <text x="${x + bw / 2}" y="${h - pad + 14}" font-size="9" text-anchor="middle" fill="#605e5c">${esc(d.label)}</text>
                        <text x="${x + bw / 2}" y="${y - 4}" font-size="9" text-anchor="middle" fill="#201f1e">${esc(String(d.value))}</text>`;
            }).join('');
            return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">${bars}<line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#c8c6c4"/></svg>`;
        }
        if (type === 'line') {
            const stepX = (w - pad * 2) / (data.length - 1 || 1);
            const pts = data.map((d, i) => `${pad + i * stepX},${h - pad - (d.value / max) * (h - pad * 2)}`);
            const dots = data.map((d, i) => {
                const x = pad + i * stepX, y = h - pad - (d.value / max) * (h - pad * 2);
                return `<circle cx="${x}" cy="${y}" r="3.5" fill="${CHART_COLORS[0]}"/><text x="${x}" y="${h - pad + 14}" font-size="9" text-anchor="middle" fill="#605e5c">${esc(d.label)}</text>`;
            }).join('');
            return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%"><polyline points="${pts.join(' ')}" fill="none" stroke="${CHART_COLORS[0]}" stroke-width="2.5"/>${dots}<line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#c8c6c4"/></svg>`;
        }
        // pie
        const total = data.reduce((s, d) => s + d.value, 0) || 1;
        const cx = w / 2, cy = h / 2 + 6, r = 62;
        let angle = -Math.PI / 2;
        const slices = data.map((d, i) => {
            const frac = d.value / total;
            const a0 = angle, a1 = angle + frac * Math.PI * 2;
            angle = a1;
            const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
            const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
            const large = frac > 0.5 ? 1 : 0;
            return `<path d="M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z" fill="${CHART_COLORS[i % CHART_COLORS.length]}" stroke="#fff" stroke-width="1.5"/>`;
        }).join('');
        const legend = data.map((d, i) => `<rect x="${w - 74}" y="${16 + i * 14}" width="9" height="9" fill="${CHART_COLORS[i % CHART_COLORS.length]}"/><text x="${w - 61}" y="${24 + i * 14}" font-size="8" fill="#605e5c">${esc(d.label)}</text>`).join('');
        return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%">${slices}${legend}</svg>`;
    }

    global.PS_PPT = { esc, chrome, btn, group, ribbon, canvas, window, chartSVG, ALL_TABS };
})(window);

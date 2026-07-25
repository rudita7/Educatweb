/* SVG bar/column chart renderer (spec §2.4).

   DEVIATION FLAGGED: the spec asks this to be imported unmodified from the
   Spreadsheet Mastery track's chartRenderer.js. As of this build, the
   Spreadsheet Mastery track (webapp/spreadsheet-lesson.html) is a single
   self-contained lesson page with no extracted chart component to import —
   there is nothing to reuse yet. Rather than duplicate a hypothetical
   future file, this is a fresh, dependency-free implementation, deliberately
   named/scoped so that IF/WHEN Spreadsheet Mastery is rebuilt as a track
   with its own chartRenderer.js, this file can be deleted and both tracks
   can point at one shared copy (e.g. moved to a top-level shared/ location)
   with no interface changes on either side. No SVG/DOM library dependency,
   no network fetch — pure function in, SVG string out. */
(function (global) {
    "use strict";

    function escapeHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

    /**
     * @param {{labels:string[], values:number[], title?:string}} chartData
     * @param {{accent?:string, ink?:string}} [opts]
     * @returns {string} an inline SVG bar chart
     */
    function renderBarChartSVG(chartData, opts) {
        opts = opts || {};
        const accent = opts.accent || '#E8A33D';
        const ink = opts.ink || '#1C2B2E';
        const labels = chartData.labels || [];
        const values = (chartData.values || []).map(v => Number(v) || 0);
        const width = 480, height = 220, padding = { top: 16, right: 12, bottom: 34, left: 12 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const maxVal = Math.max(...values, 1);
        const n = Math.max(values.length, 1);
        const gap = 14;
        const barW = Math.max((chartW - gap * (n - 1)) / n, 8);

        let bars = '';
        values.forEach((v, i) => {
            const barH = maxVal > 0 ? (v / maxVal) * chartH : 0;
            const x = padding.left + i * (barW + gap);
            const y = padding.top + (chartH - barH);
            bars += `
                <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(barH, 1).toFixed(1)}" rx="4" fill="${accent}"></rect>
                <text x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11" font-family="IBM Plex Mono, monospace" fill="${ink}">${escapeHtml(String(v))}</text>
                <text x="${(x + barW / 2).toFixed(1)}" y="${(height - padding.bottom + 16).toFixed(1)}" text-anchor="middle" font-size="10" font-family="Inter, sans-serif" fill="${ink}">${escapeHtml(String(labels[i] != null ? labels[i] : ''))}</text>
            `;
        });

        return `
            <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="${escapeHtml(chartData.title || 'Bar chart')}">
                <line x1="${padding.left}" y1="${(height - padding.bottom).toFixed(1)}" x2="${width - padding.right}" y2="${(height - padding.bottom).toFixed(1)}" stroke="${ink}" stroke-opacity="0.25" />
                ${bars}
            </svg>
        `;
    }

    function renderBarChart(container, chartData, opts) {
        if (typeof container === 'string') container = document.querySelector(container);
        if (!container) return;
        container.innerHTML = renderBarChartSVG(chartData, opts);
    }

    global.PS = global.PS || {};
    global.PS.chartRenderer = { renderBarChartSVG, renderBarChart };
})(window);

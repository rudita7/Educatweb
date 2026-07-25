/* Hand-rolled SVG bar chart (build spec §2.7). Takes a selected range's
   categories + values and renders a minimal column chart -- no external
   charting library, matching the offline-first / low-RAM constraint.
   Pure function: returns an SVG markup string, no DOM coupling, so it's
   testable in Node and just as usable via innerHTML in the browser.
   Lesson 4 Module 3.
   UMD-wrapped like the other engines. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SM = root.SM || {};
        root.SM.chartRenderer = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    "use strict";

    function escapeXml(s) {
        return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    /* renderBarChart(categories, values, opts) -> SVG markup string.
       opts: { width, height, barColor, title } all optional. */
    function renderBarChart(categories, values, opts) {
        opts = opts || {};
        const width = opts.width || 480;
        const height = opts.height || 260;
        const barColor = opts.barColor || '#E6493C';
        const padding = { top: 26, right: 16, bottom: 44, left: 16 };
        const chartW = Math.max(1, width - padding.left - padding.right);
        const chartH = Math.max(1, height - padding.top - padding.bottom);

        if (!categories || !categories.length) {
            return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Empty chart">` +
                `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" fill="currentColor" opacity="0.5" font-size="13">No data selected</text></svg>`;
        }

        const nums = values.map(v => (typeof v === 'number' && isFinite(v)) ? v : 0);
        const maxVal = Math.max(1, ...nums.map(v => Math.abs(v)));
        const gap = 12;
        const barW = Math.max(4, (chartW - gap * (nums.length - 1)) / nums.length);

        let bars = '';
        let labels = '';
        nums.forEach((v, i) => {
            const barH = (Math.abs(v) / maxVal) * chartH;
            const x = padding.left + i * (barW + gap);
            const y = padding.top + (chartH - barH);
            bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, barH).toFixed(1)}" fill="${barColor}" rx="3" />`;
            bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11" fill="currentColor">${escapeXml(v)}</text>`;
            labels += `<text x="${(x + barW / 2).toFixed(1)}" y="${(height - padding.bottom + 18).toFixed(1)}" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">${escapeXml(categories[i])}</text>`;
        });

        const axisX = `<line x1="${padding.left}" y1="${(height - padding.bottom).toFixed(1)}" x2="${(width - padding.right).toFixed(1)}" y2="${(height - padding.bottom).toFixed(1)}" stroke="currentColor" stroke-opacity="0.25" />`;
        const titleEl = opts.title ? `<text x="${padding.left}" y="16" font-size="12" font-weight="600" fill="currentColor">${escapeXml(opts.title)}</text>` : '';

        return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="${escapeXml(opts.title || 'Bar chart')}">${titleEl}${axisX}${bars}${labels}</svg>`;
    }

    return { renderBarChart, escapeXml };
});

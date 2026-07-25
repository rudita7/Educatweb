/* Renders a "slide" from structured data — never an image — reused across
   every lesson that needs to show a slide: the layout taxonomy (L2M1), the
   editor live preview (L3/L4), the slide sorter (L2M2), proofreading
   (L5M1), and Present/Presenter Mode (L5M3/M4). One implementation instead
   of five near-duplicates. */
(function (global) {
    "use strict";

    const esc = global.PS.escapeHtml;

    function themeStyleVars(theme) {
        return `--slide-accent:${theme.accent};--slide-bg:${theme.bg};--slide-ink:${theme.ink};--slide-font:${theme.font};`;
    }

    function imageBlockHtml(slide) {
        if (!slide.imageId) return '<div class="ps-slide-img-placeholder ps-slide-img-empty">🖼️ No image selected</div>';
        const icon = global.PS.iconById(slide.imageId);
        if (!icon) return '<div class="ps-slide-img-placeholder ps-slide-img-empty">🖼️ No image selected</div>';
        return `<div class="ps-slide-img-placeholder"><span class="ps-slide-img-emoji">${icon.emoji}</span><span class="ps-slide-img-label">${esc(icon.label)}</span></div>`;
    }

    function chartBlockHtml(slide, theme) {
        if (!slide.chartData || !slide.chartData.values || !slide.chartData.values.length) {
            return '<div class="ps-slide-chart-placeholder">📊 No chart added</div>';
        }
        return `<div class="ps-slide-chart">${global.PS.chartRenderer.renderBarChartSVG(slide.chartData, { accent: theme.accent, ink: theme.ink })}</div>`;
    }

    function bulletsHtml(slide) {
        if (!slide.bullets.length) return '<div class="ps-slide-empty-hint">(no bullets yet)</div>';
        return `<ul class="ps-slide-bullets">${slide.bullets.map(b => b.trim()
            ? `<li>${esc(b)}</li>`
            : `<li class="ps-slide-empty-bullet">(empty bullet)</li>`).join('')}</ul>`;
    }

    /** Full slide preview — headline + body appropriate to its layout. */
    function previewHtml(slide, theme, opts) {
        opts = opts || {};
        const headlineClass = 'ps-slide-headline ' + (slide.headlineStyle === 'small' ? 'ps-h-small' : 'ps-h-large') + (slide.headline.trim() ? '' : ' ps-empty');
        const headlineText = slide.headline.trim() ? esc(slide.headline) : '(no headline)';

        let body = '';
        switch (slide.layout) {
            case 'title':
                body = `<div class="ps-slide-subtitle">${slide.bullets[0] ? esc(slide.bullets[0]) : '(subtitle / your name)'}</div>`;
                break;
            case 'sectionHeader':
                body = `<div class="ps-slide-section-rule"></div>`;
                break;
            case 'imageOnly':
                body = imageBlockHtml(slide);
                break;
            case 'twoContent':
                body = `<div class="ps-slide-two-col">
                    <div>${bulletsHtml(slide)}</div>
                    <div>${slide.chartData ? chartBlockHtml(slide, theme) : imageBlockHtml(slide)}</div>
                </div>`;
                break;
            case 'titleContent':
            default:
                body = slide.chartData ? chartBlockHtml(slide, theme) : bulletsHtml(slide);
                break;
        }

        return `
            <div class="ps-slide-preview" style="${themeStyleVars(theme)}">
                <div class="${headlineClass}">${headlineText}</div>
                <div class="ps-slide-body">${body}</div>
                ${opts.showTransitionBadge && slide.transition !== 'none' ? `<span class="ps-slide-badge">${esc(slide.transition)}</span>` : ''}
            </div>
        `;
    }

    /** Small thumbnail for lists / the sorter — headline + layout icon only. */
    function thumbHtml(slide, index, theme) {
        const layout = global.PS.deckStore.layoutById(slide.layout);
        return `
            <div class="ps-slide-thumb" style="${themeStyleVars(theme)}">
                <span class="ps-thumb-num">${index + 1}</span>
                <span class="ps-thumb-layout">${layout.icon}</span>
                <span class="ps-thumb-headline">${slide.headline.trim() ? esc(slide.headline) : '(untitled)'}</span>
            </div>
        `;
    }

    global.PS = global.PS || {};
    global.PS.slideRenderer = { previewHtml, thumbHtml, imageBlockHtml, chartBlockHtml, bulletsHtml, themeStyleVars };
})(window);

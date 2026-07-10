/* Field-level and character-level diffing (spec §2.3).
   Powers Version Checking, Compare Records, and any "was this corrected
   properly" check across the Track. */
(function (global) {
    "use strict";

    // Classic LCS-based char diff -> merged run-length array of
    // { type: 'equal' | 'add' | 'del', value }.
    function diffStrings(a, b) {
        a = a == null ? '' : String(a);
        b = b == null ? '' : String(b);
        const n = a.length, m = b.length;
        const dp = [];
        for (let i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
        for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
                dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }
        const ops = [];
        let i = 0, j = 0;
        while (i < n && j < m) {
            if (a[i] === b[j]) { ops.push({ type: 'equal', value: a[i] }); i++; j++; }
            else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'del', value: a[i] }); i++; }
            else { ops.push({ type: 'add', value: b[j] }); j++; }
        }
        while (i < n) { ops.push({ type: 'del', value: a[i] }); i++; }
        while (j < m) { ops.push({ type: 'add', value: b[j] }); j++; }

        const merged = [];
        ops.forEach(function (op) {
            const last = merged[merged.length - 1];
            if (last && last.type === op.type) last.value += op.value;
            else merged.push({ type: op.type, value: op.value });
        });
        return merged;
    }

    // Field-level diff between two flat-ish records.
    function diffRecords(a, b, opts) {
        opts = opts || {};
        const ignore = {};
        (opts.ignoreFields || ['id']).forEach(function (f) { ignore[f] = true; });
        const keySet = {};
        Object.keys(a || {}).forEach(function (k) { keySet[k] = true; });
        Object.keys(b || {}).forEach(function (k) { keySet[k] = true; });

        const fields = [];
        Object.keys(keySet).forEach(function (field) {
            if (ignore[field]) return;
            const before = a ? a[field] : undefined;
            const after = b ? b[field] : undefined;
            const changed = JSON.stringify(before) !== JSON.stringify(after);
            fields.push({ field: field, before: before, after: after, changed: changed });
        });
        return fields;
    }

    global.T3 = global.T3 || {};
    global.T3.diff = { diffStrings: diffStrings, diffRecords: diffRecords };
})(window);

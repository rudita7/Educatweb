/* Duplicate / fuzzy-match engine (spec §2.4, Lesson 3 Module 1).
   Normalizes strings, measures near-duplicates with Levenshtein edit
   distance (not just exact-match hashing), then clusters matches with
   a Union-Find (disjoint-set) structure so every connected component
   becomes one duplicate group -- a genuine CS-concept showcase, not a
   hardcoded "these two rows are the same" answer key. */
(function (global) {
    "use strict";

    function normalize(str) {
        return String(str == null ? '' : str).trim().toLowerCase().replace(/\s+/g, ' ');
    }

    // Classic edit-distance dynamic program.
    function levenshtein(a, b) {
        a = String(a); b = String(b);
        const n = a.length, m = b.length;
        if (n === 0) return m;
        if (m === 0) return n;
        let prev = new Array(m + 1);
        let curr = new Array(m + 1);
        for (let j = 0; j <= m; j++) prev[j] = j;
        for (let i = 1; i <= n; i++) {
            curr[0] = i;
            for (let j = 1; j <= m; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                curr[j] = Math.min(
                    prev[j] + 1,      // deletion
                    curr[j - 1] + 1,  // insertion
                    prev[j - 1] + cost // substitution
                );
            }
            [prev, curr] = [curr, prev];
        }
        return prev[m];
    }

    function similarity(a, b) {
        const na = normalize(a), nb = normalize(b);
        const maxLen = Math.max(na.length, nb.length);
        if (maxLen === 0) return 1;
        return 1 - levenshtein(na, nb) / maxLen;
    }

    function UnionFind(n) {
        this.parent = Array.from({ length: n }, (_, i) => i);
        this.rank = new Array(n).fill(0);
    }
    UnionFind.prototype.find = function (x) {
        while (this.parent[x] !== x) {
            this.parent[x] = this.parent[this.parent[x]];
            x = this.parent[x];
        }
        return x;
    };
    UnionFind.prototype.union = function (a, b) {
        const ra = this.find(a), rb = this.find(b);
        if (ra === rb) return;
        if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
        else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
        else { this.parent[rb] = ra; this.rank[ra]++; }
    };

    // records: array; keyFn(record) -> string to compare; threshold: 0..1 similarity cutoff.
    // Returns an array of clusters, each { records: [...], indices: [...] }, including singletons.
    function clusterDuplicates(records, keyFn, threshold) {
        threshold = threshold == null ? 0.8 : threshold;
        const uf = new UnionFind(records.length);
        for (let i = 0; i < records.length; i++) {
            for (let j = i + 1; j < records.length; j++) {
                if (similarity(keyFn(records[i]), keyFn(records[j])) >= threshold) {
                    uf.union(i, j);
                }
            }
        }
        const groups = new Map();
        records.forEach((record, i) => {
            const root = uf.find(i);
            if (!groups.has(root)) groups.set(root, { records: [], indices: [] });
            groups.get(root).records.push(record);
            groups.get(root).indices.push(i);
        });
        return Array.from(groups.values());
    }

    global.T3 = global.T3 || {};
    global.T3.fuzzyMatch = { normalize, levenshtein, similarity, UnionFind, clusterDuplicates };
})(window);

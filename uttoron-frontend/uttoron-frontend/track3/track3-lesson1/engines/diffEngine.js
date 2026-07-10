function diffRecords(a, b) {
    const diffs = {};
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

    for (const key of allKeys) {
        if (a[key] !== b[key]) {
            diffs[key] = {
                original: a[key] !== undefined ? a[key] : null,
                corrupted: b[key] !== undefined ? b[key] : null,
                charDiff: diffStrings(String(a[key]), String(b[key]))
            };
        }
    }
    return diffs;
}

function diffStrings(a, b) {
    // Simple character-level diff for highlighting changes
    // This is a basic implementation and can be improved with more sophisticated diffing algorithms
    if (a === b) return { type: 'exact', value: a };

    const lenA = a.length;
    const lenB = b.length;
    const dp = Array(lenA + 1).fill(0).map(() => Array(lenB + 1).fill(0));

    for (let i = 0; i <= lenA; i++) {
        for (let j = 0; j <= lenB; j++) {
            if (i === 0) {
                dp[i][j] = j;
            } else if (j === 0) {
                dp[i][j] = i;
            } else if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }

    let i = lenA;
    let j = lenB;
    const result = [];

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
            result.unshift({ char: a[i - 1], type: 'common' });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] <= dp[i - 1][j])) {
            result.unshift({ char: b[j - 1], type: 'added' });
            j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] > dp[i - 1][j])) {
            result.unshift({ char: a[i - 1], type: 'removed' });
            i--;
        } else { // Fallback for when dp[i-1][j] === dp[i][j-1] === dp[i-1][j-1] (e.g. substitution)
            result.unshift({ char: b[j - 1], type: 'changed' }); // Prefer showing the new char as changed
            i--;
            j--;
        }
    }
    return { type: 'diff', value: result };
}

export { diffRecords, diffStrings };

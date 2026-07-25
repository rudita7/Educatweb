/* Formula engine v2 (build spec §2.3) -- a real recursive-descent parser,
   replacing the old regex-only "=FUNC(range)" matcher. Supports:
     - arithmetic: + - * / and parentheses, e.g. =A1*1.05, =(A1+A2)/2
     - cell references, relative (A1) and absolute ($A$1, A$1, $A1)
     - range functions: SUM, AVERAGE, MIN, MAX, COUNT, COUNTA
     - comparisons: > < >= <= = <>  (formulas can return TRUE/FALSE, and
       IF/AND/OR conditions use them)
     - string literals ("Late", "Reorder") so IF can return text, not just
       numbers
     - logical functions: IF (with nesting), AND, OR
     - conditional aggregates: COUNTIF(range, criteria), SUMIF(range,
       criteria, sumRange) using Excel-style string criteria (">100",
       "Late", "<>Paid")
     - lookup: LOOKUP(value, lookupRange, resultRange) -- single-column
       exact match only, not full VLOOKUP's column-index/approximate-match
     - visible errors instead of silent blanks/NaN: #ERROR, #REF!,
       #DIV/0!, #VALUE!, #CIRCULAR!, #N/A
   This module only evaluates ONE formula string given a resolveCellFn
   that returns another cell's already-computed value (number, blank
   string, text, boolean, or an error-code string starting with "#"). It
   does not know about the grid or about recursion across cells -- that
   lazy, cycle-safe recursion lives in cellModel.recomputeGrid, which
   supplies the resolveCellFn. Kept dependency-free from cellModel.js on
   purpose so this file is independently testable (see
   formulaEngine.test.js).
   UMD-wrapped: works as <script src> (window.SM.formulaEngine) and via
   require() in Node. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SM = root.SM || {};
        root.SM.formulaEngine = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    "use strict";

    function FormulaError(code) {
        this.code = code;
        this.message = code;
    }
    FormulaError.prototype = Object.create(Error.prototype);
    FormulaError.prototype.constructor = FormulaError;

    // ---------- small col/row helpers (deliberately local, not shared
    // with cellModel.js -- see file header) ----------
    function colLetterToIndex(letter) {
        let n = 0;
        for (let i = 0; i < letter.length; i++) n = n * 26 + (letter.charCodeAt(i) - 64);
        return n - 1;
    }
    function colIndexToLetter(index) {
        let n = index + 1, s = '';
        while (n > 0) { const rem = (n - 1) % 26; s = String.fromCharCode(65 + rem) + s; n = Math.floor((n - 1) / 26); }
        return s;
    }
    function parseRefParts(ref) {
        const m = /^(\$?)([A-Za-z]+)(\$?)([0-9]+)$/.exec(ref);
        if (!m) throw new FormulaError('#REF!');
        return { colAbs: m[1] === '$', col: m[2].toUpperCase(), colIndex: colLetterToIndex(m[2].toUpperCase()), rowAbs: m[3] === '$', row: parseInt(m[4], 10) };
    }
    function stripAbs(ref) { return ref.replace(/\$/g, ''); }

    // ---------- tokenizer ----------
    const CELLREF_RE = /^\$?[A-Za-z]+\$?[0-9]+/;
    const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*/;
    const NUMBER_RE = /^[0-9]+(\.[0-9]+)?/;
    const TWO_CHAR_OPS = ['>=', '<=', '<>'];

    function tokenize(str) {
        const tokens = [];
        let i = 0;
        const n = str.length;
        while (i < n) {
            const ch = str[i];
            if (/\s/.test(ch)) { i++; continue; }
            if (ch === '"') {
                let j = i + 1, s = '';
                while (j < n && str[j] !== '"') { s += str[j]; j++; }
                if (j >= n) throw new FormulaError('#ERROR'); // unterminated string
                tokens.push({ type: 'STRING', value: s });
                i = j + 1;
                continue;
            }
            if (/[0-9]/.test(ch)) {
                const m = NUMBER_RE.exec(str.slice(i));
                tokens.push({ type: 'NUMBER', value: parseFloat(m[0]) });
                i += m[0].length;
                continue;
            }
            if (ch === '$' || /[A-Za-z]/.test(ch)) {
                const rest = str.slice(i);
                const refM = CELLREF_RE.exec(rest);
                if (refM) {
                    tokens.push({ type: 'CELLREF', value: refM[0].toUpperCase() });
                    i += refM[0].length;
                    continue;
                }
                const idM = IDENT_RE.exec(rest);
                if (idM) {
                    tokens.push({ type: 'IDENT', value: idM[0].toUpperCase() });
                    i += idM[0].length;
                    continue;
                }
                throw new FormulaError('#ERROR');
            }
            const two = str.substr(i, 2);
            if (TWO_CHAR_OPS.indexOf(two) !== -1) {
                tokens.push({ type: two });
                i += 2;
                continue;
            }
            if ('+-*/(),:<>='.indexOf(ch) !== -1) {
                tokens.push({ type: ch });
                i++;
                continue;
            }
            throw new FormulaError('#ERROR');
        }
        tokens.push({ type: 'EOF' });
        return tokens;
    }

    // ---------- recursive-descent parser ----------
    // comparison := expression ( ('>'|'<'|'>='|'<='|'='|'<>') expression )?
    // expression := term (('+'|'-') term)*
    // term       := factor (('*'|'/') factor)*
    // factor     := ('-'|'+') factor | primary
    // primary    := NUMBER | STRING | CELLREF | IDENT '(' argList ')' | '(' comparison ')'
    // arg        := CELLREF ':' CELLREF | comparison   (range only valid as a function arg)
    const COMPARE_OPS = ['>', '<', '>=', '<=', '=', '<>'];

    function Parser(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }
    Parser.prototype.peek = function () { return this.tokens[this.pos]; };
    Parser.prototype.next = function () { return this.tokens[this.pos++]; };
    Parser.prototype.expect = function (type) {
        const t = this.next();
        if (t.type !== type) throw new FormulaError('#ERROR');
        return t;
    };
    Parser.prototype.parseComparison = function () {
        let node = this.parseExpression();
        if (COMPARE_OPS.indexOf(this.peek().type) !== -1) {
            const op = this.next().type;
            node = { type: 'Compare', op: op, left: node, right: this.parseExpression() };
        }
        return node;
    };
    Parser.prototype.parseExpression = function () {
        let node = this.parseTerm();
        while (this.peek().type === '+' || this.peek().type === '-') {
            const op = this.next().type;
            node = { type: 'BinOp', op: op, left: node, right: this.parseTerm() };
        }
        return node;
    };
    Parser.prototype.parseTerm = function () {
        let node = this.parseFactor();
        while (this.peek().type === '*' || this.peek().type === '/') {
            const op = this.next().type;
            node = { type: 'BinOp', op: op, left: node, right: this.parseFactor() };
        }
        return node;
    };
    Parser.prototype.parseFactor = function () {
        if (this.peek().type === '-') { this.next(); return { type: 'Neg', value: this.parseFactor() }; }
        if (this.peek().type === '+') { this.next(); return this.parseFactor(); }
        return this.parsePrimary();
    };
    Parser.prototype.parsePrimary = function () {
        const t = this.peek();
        if (t.type === 'NUMBER') { this.next(); return { type: 'Number', value: t.value }; }
        if (t.type === 'STRING') { this.next(); return { type: 'String', value: t.value }; }
        if (t.type === 'CELLREF') { this.next(); return { type: 'CellRef', ref: t.value }; }
        if (t.type === '(') {
            this.next();
            const expr = this.parseComparison();
            this.expect(')');
            return expr;
        }
        if (t.type === 'IDENT') {
            this.next();
            this.expect('(');
            const args = this.parseArgList();
            this.expect(')');
            return { type: 'Call', name: t.value, args: args };
        }
        throw new FormulaError('#ERROR');
    };
    Parser.prototype.parseArgList = function () {
        const args = [];
        if (this.peek().type === ')') return args;
        args.push(this.parseArg());
        while (this.peek().type === ',') { this.next(); args.push(this.parseArg()); }
        return args;
    };
    Parser.prototype.parseArg = function () {
        if (this.peek().type === 'CELLREF' && this.tokens[this.pos + 1] && this.tokens[this.pos + 1].type === ':') {
            const start = this.next().value;
            this.next(); // ':'
            const end = this.expect('CELLREF').value;
            return { type: 'Range', start: start, end: end };
        }
        return this.parseComparison();
    };

    function parse(body) {
        const tokens = tokenize(body);
        const parser = new Parser(tokens);
        const ast = parser.parseComparison();
        if (parser.peek().type !== 'EOF') throw new FormulaError('#ERROR');
        return ast;
    }

    // ---------- evaluator ----------
    function looksLikeErrorCode(v) { return typeof v === 'string' && v.charAt(0) === '#'; }

    // Strict coercion for direct arithmetic (=A1+B2): text where a number
    // is expected is a real error, not silently 0 -- matches how a real
    // spreadsheet (and an entry-level screening test) treats it.
    function coerceNumber(v) {
        if (looksLikeErrorCode(v)) throw new FormulaError(v);
        if (typeof v === 'number') return v;
        if (typeof v === 'boolean') return v ? 1 : 0;
        if (v === '' || v === undefined || v === null) return 0;
        if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
        throw new FormulaError('#VALUE!');
    }

    function coerceBool(v) {
        if (looksLikeErrorCode(v)) throw new FormulaError(v);
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        throw new FormulaError('#VALUE!');
    }

    // Lenient coercion for range aggregates (=SUM(A1:A5)): blank/text
    // cells are skipped rather than erroring, same as real SUM/AVERAGE --
    // but a genuine upstream error inside the range still propagates.
    function safeCoerceForAggregate(v) {
        if (looksLikeErrorCode(v)) throw new FormulaError(v);
        if (typeof v === 'number') return v;
        if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
        return null;
    }

    function isNumericValue(v) {
        return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));
    }

    function compareValues(l, r, op) {
        if (looksLikeErrorCode(l)) throw new FormulaError(l);
        if (looksLikeErrorCode(r)) throw new FormulaError(r);
        if (isNumericValue(l) && isNumericValue(r)) {
            const ln = Number(l), rn = Number(r);
            switch (op) {
                case '>': return ln > rn;
                case '<': return ln < rn;
                case '>=': return ln >= rn;
                case '<=': return ln <= rn;
                case '=': return ln === rn;
                case '<>': return ln !== rn;
            }
        }
        const ls = String(l).trim().toLowerCase(), rs = String(r).trim().toLowerCase();
        switch (op) {
            case '=': return ls === rs;
            case '<>': return ls !== rs;
            case '>': return ls > rs;
            case '<': return ls < rs;
            case '>=': return ls >= rs;
            case '<=': return ls <= rs;
        }
        throw new FormulaError('#ERROR');
    }

    function valuesEqual(a, b) {
        if (isNumericValue(a) && isNumericValue(b)) return Number(a) === Number(b);
        return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
    }

    // Excel-style criteria matching for COUNTIF/SUMIF: criteria is either
    // a bare value (equality match, text or number) or a string with a
    // comparison-operator prefix, e.g. ">100", "<>Paid", "=Late".
    function matchesCriteria(cellValue, criteria) {
        if (looksLikeErrorCode(cellValue)) return false;
        if (typeof criteria === 'number') {
            return isNumericValue(cellValue) && Number(cellValue) === criteria;
        }
        const s = String(criteria).trim();
        const m = /^(<=|>=|<>|<|>|=)(.*)$/.exec(s);
        const op = m ? m[1] : '=';
        const rhsRaw = m ? m[2].trim() : s;
        if (isNumericValue(cellValue) && rhsRaw !== '' && !isNaN(Number(rhsRaw))) {
            const cellNum = Number(cellValue), rhsNum = Number(rhsRaw);
            switch (op) {
                case '>': return cellNum > rhsNum;
                case '<': return cellNum < rhsNum;
                case '>=': return cellNum >= rhsNum;
                case '<=': return cellNum <= rhsNum;
                case '=': return cellNum === rhsNum;
                case '<>': return cellNum !== rhsNum;
            }
        }
        const cellStr = String(cellValue).trim().toLowerCase();
        const rhsStr = rhsRaw.toLowerCase();
        if (op === '=') return cellStr === rhsStr;
        if (op === '<>') return cellStr !== rhsStr;
        return false; // >, <, >=, <= against non-numeric text isn't meaningful here
    }

    function collectRange(rangeNode, resolveCellFn) {
        const s = parseRefParts(rangeNode.start);
        const e = parseRefParts(rangeNode.end);
        const c0 = Math.min(s.colIndex, e.colIndex), c1 = Math.max(s.colIndex, e.colIndex);
        const r0 = Math.min(s.row, e.row), r1 = Math.max(s.row, e.row);
        const raw = [];
        for (let c = c0; c <= c1; c++) {
            for (let r = r0; r <= r1; r++) {
                raw.push(resolveCellFn(colIndexToLetter(c) + r));
            }
        }
        return raw;
    }

    const AGGREGATE_FUNCTIONS = {
        SUM: nums => nums.reduce((a, b) => a + b, 0),
        AVERAGE: nums => { if (!nums.length) throw new FormulaError('#DIV/0!'); return nums.reduce((a, b) => a + b, 0) / nums.length; },
        MIN: nums => nums.length ? Math.min.apply(null, nums) : 0,
        MAX: nums => nums.length ? Math.max.apply(null, nums) : 0
    };

    function evalFunction(node, resolveCellFn) {
        const name = node.name;
        const args = node.args;

        if (name === 'IF') {
            if (args.length !== 3) throw new FormulaError('#ERROR');
            const cond = coerceBool(evalNode(args[0], resolveCellFn));
            return cond ? evalNode(args[1], resolveCellFn) : evalNode(args[2], resolveCellFn);
        }
        if (name === 'AND' || name === 'OR') {
            if (args.length < 1) throw new FormulaError('#ERROR');
            const vals = args.map(a => coerceBool(evalNode(a, resolveCellFn)));
            return name === 'AND' ? vals.every(v => v) : vals.some(v => v);
        }
        if (name === 'COUNTIF') {
            if (args.length !== 2 || args[0].type !== 'Range') throw new FormulaError('#ERROR');
            const raw = collectRange(args[0], resolveCellFn);
            const criteria = evalNode(args[1], resolveCellFn);
            return raw.filter(v => matchesCriteria(v, criteria)).length;
        }
        if (name === 'SUMIF') {
            if (args.length !== 3 || args[0].type !== 'Range' || args[2].type !== 'Range') throw new FormulaError('#ERROR');
            const raw = collectRange(args[0], resolveCellFn);
            const criteria = evalNode(args[1], resolveCellFn);
            const sumRaw = collectRange(args[2], resolveCellFn);
            if (raw.length !== sumRaw.length) throw new FormulaError('#ERROR');
            let total = 0;
            raw.forEach((v, i) => {
                if (matchesCriteria(v, criteria)) {
                    const n = safeCoerceForAggregate(sumRaw[i]);
                    if (n !== null) total += n;
                }
            });
            return total;
        }
        if (name === 'LOOKUP') {
            if (args.length !== 3 || args[1].type !== 'Range' || args[2].type !== 'Range') throw new FormulaError('#ERROR');
            const lookupVal = evalNode(args[0], resolveCellFn);
            const lookupRaw = collectRange(args[1], resolveCellFn);
            const resultRaw = collectRange(args[2], resolveCellFn);
            if (lookupRaw.length !== resultRaw.length) throw new FormulaError('#ERROR');
            for (let i = 0; i < lookupRaw.length; i++) {
                if (!looksLikeErrorCode(lookupRaw[i]) && valuesEqual(lookupRaw[i], lookupVal)) return resultRaw[i];
            }
            throw new FormulaError('#N/A');
        }
        if (name === 'COUNTA') {
            if (args.length !== 1 || args[0].type !== 'Range') throw new FormulaError('#ERROR');
            const raw = collectRange(args[0], resolveCellFn);
            return raw.filter(v => v !== '' && v !== undefined && v !== null).length;
        }
        if (name === 'COUNT') {
            if (args.length !== 1 || args[0].type !== 'Range') throw new FormulaError('#ERROR');
            const raw = collectRange(args[0], resolveCellFn);
            return raw.map(safeCoerceForAggregate).filter(v => v !== null).length;
        }
        if (Object.prototype.hasOwnProperty.call(AGGREGATE_FUNCTIONS, name)) {
            if (args.length !== 1 || args[0].type !== 'Range') throw new FormulaError('#ERROR');
            const raw = collectRange(args[0], resolveCellFn);
            const nums = raw.map(safeCoerceForAggregate).filter(v => v !== null);
            return AGGREGATE_FUNCTIONS[name](nums);
        }
        // Genuinely unknown function name -- fails loudly, not silently.
        throw new FormulaError('#ERROR');
    }

    function evalNode(node, resolveCellFn) {
        switch (node.type) {
            case 'Number': return node.value;
            case 'String': return node.value;
            case 'Neg': return -coerceNumber(evalNode(node.value, resolveCellFn));
            case 'Compare': return compareValues(evalNode(node.left, resolveCellFn), evalNode(node.right, resolveCellFn), node.op);
            case 'BinOp': {
                const l = coerceNumber(evalNode(node.left, resolveCellFn));
                const r = coerceNumber(evalNode(node.right, resolveCellFn));
                switch (node.op) {
                    case '+': return l + r;
                    case '-': return l - r;
                    case '*': return l * r;
                    case '/': if (r === 0) throw new FormulaError('#DIV/0!'); return l / r;
                }
                throw new FormulaError('#ERROR');
            }
            case 'CellRef': return resolveCellFn(stripAbs(node.ref));
            case 'Call': return evalFunction(node, resolveCellFn);
            default: throw new FormulaError('#ERROR');
        }
    }

    /* evaluateFormula(raw, resolveCellFn) -> { ok:true, value } | { ok:false, error }
       raw must start with "=". resolveCellFn(cellId) must return a number,
       blank string, text, boolean, or an error-code string ("#REF!" etc);
       it is free to recurse into other formula cells (that's cellModel's
       job). The result can now be a number, string, or boolean -- e.g.
       =IF(B2>9,"Late","On time") is a valid whole formula, not just
       usable nested inside arithmetic. */
    function evaluateFormula(raw, resolveCellFn) {
        try {
            const trimmed = (raw || '').trim();
            if (trimmed.charAt(0) !== '=') throw new FormulaError('#ERROR');
            const body = trimmed.slice(1).trim();
            if (body === '') throw new FormulaError('#ERROR');
            const ast = parse(body);
            let value = evalNode(ast, resolveCellFn);
            if (looksLikeErrorCode(value)) throw new FormulaError(value);
            if (typeof value === 'number' && !isFinite(value)) throw new FormulaError('#ERROR');
            if (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean') throw new FormulaError('#ERROR');
            return { ok: true, value: value };
        } catch (e) {
            if (e instanceof FormulaError) return { ok: false, error: e.code };
            return { ok: false, error: '#ERROR' };
        }
    }

    return {
        FormulaError,
        tokenize, parse, evaluateFormula,
        colIndexToLetter, colLetterToIndex, parseRefParts,
        matchesCriteria, compareValues
    };
});

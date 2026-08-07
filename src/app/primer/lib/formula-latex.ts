// Converts a trusted slider "formula" (a JavaScript numeric expression in the
// variable x, e.g. "Math.sin(x)", "2**x", "1/(1+x)") into a LaTeX math string so
// it can be rendered with KaTeX like the rest of the lesson. Returns null on any
// parse problem so the caller can fall back to showing the raw formula.

type Node =
  | { t: 'num'; v: string }
  | { t: 'var' }
  | { t: 'const'; tex: string }
  | { t: 'paren'; inner: Node }
  | { t: 'add'; op: '+' | '-'; l: Node; r: Node }
  | { t: 'mul'; l: Node; r: Node }
  | { t: 'mod'; l: Node; r: Node }
  | { t: 'div'; n: Node; d: Node }
  | { t: 'pow'; base: Node; exp: Node }
  | { t: 'neg'; operand: Node }
  | { t: 'call'; name: string; args: Node[] };

type Tok =
  | { k: 'num'; v: string }
  | { k: 'name'; v: string }
  | { k: 'op'; v: string }
  | { k: 'lparen' }
  | { k: 'rparen' }
  | { k: 'comma' }
  | { k: 'dot' };

type OpTok = Extract<Tok, { k: 'op' }>;
type NameTok = Extract<Tok, { k: 'name' }>;
type NumTok = Extract<Tok, { k: 'num' }>;

function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
      let j = i;
      while (j < s.length && /[0-9]/.test(s[j])) j++;
      if (s[j] === '.') { j++; while (j < s.length && /[0-9]/.test(s[j])) j++; }
      toks.push({ k: 'num', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      toks.push({ k: 'name', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '*') {
      if (s[i + 1] === '*') { toks.push({ k: 'op', v: '**' }); i += 2; }
      else { toks.push({ k: 'op', v: '*' }); i += 1; }
      continue;
    }
    if (c === '+' || c === '-' || c === '/' || c === '%') {
      toks.push({ k: 'op', v: c });
      i += 1;
      continue;
    }
    if (c === '(') { toks.push({ k: 'lparen' }); i++; continue; }
    if (c === ')') { toks.push({ k: 'rparen' }); i++; continue; }
    if (c === ',') { toks.push({ k: 'comma' }); i++; continue; }
    if (c === '.') { toks.push({ k: 'dot' }); i++; continue; }
    throw new Error('unexpected character');
  }
  return toks;
}

function constFromName(name: string): Node {
  switch (name) {
    case 'Math.PI': case 'PI': case 'pi': return { t: 'const', tex: '\\pi' };
    case 'Math.E': case 'E': return { t: 'const', tex: 'e' };
    case 'Math.SQRT2': return { t: 'const', tex: '\\sqrt{2}' };
    case 'Math.SQRT1_2': return { t: 'const', tex: '\\tfrac{1}{\\sqrt{2}}' };
    case 'Math.LN2': return { t: 'const', tex: '\\ln 2' };
    case 'Math.LN10': return { t: 'const', tex: '\\ln 10' };
    case 'Math.LOG2E': return { t: 'const', tex: '\\log_{2} e' };
    case 'Math.LOG10E': return { t: 'const', tex: '\\log_{10} e' };
    case 'Math.PHI': case 'PHI': return { t: 'const', tex: '\\varphi' };
    default: return { t: 'const', tex: `\\mathit{${name.replace(/^Math\./, '')}}` };
  }
}

function parse(s: string): Node {
  const toks = tokenize(s);
  let pos = 0;
  const at = (k: Tok['k']) => !!toks[pos] && toks[pos].k === k;
  const atOp = (v: string) => !!toks[pos] && toks[pos].k === 'op' && (toks[pos] as OpTok).v === v;
  const eat = (k: Tok['k']) => {
    const t = toks[pos];
    if (!t || t.k !== k) throw new Error('parse error');
    pos++;
    return t;
  };
  const eatOp = () => (eat('op') as OpTok).v;

  function parseArgs(): Node[] {
    const args = [parseExpr()];
    while (at('comma')) { pos++; args.push(parseExpr()); }
    return args;
  }

  function parsePrimary(): Node {
    if (at('num')) { return { t: 'num', v: (toks[pos++] as NumTok).v }; }
    if (at('lparen')) { pos++; const inner = parseExpr(); eat('rparen'); return { t: 'paren', inner }; }
    if (at('name')) {
      const name = (toks[pos++] as NameTok).v;
      if (name === 'Math') {
        eat('dot');
        const fname = (eat('name') as NameTok).v;
        if (at('lparen')) { pos++; const args = parseArgs(); eat('rparen'); return { t: 'call', name: fname, args }; }
        return constFromName('Math.' + fname);
      }
      if (name !== 'x' && at('lparen')) { pos++; const args = parseArgs(); eat('rparen'); return { t: 'call', name, args }; }
      if (name === 'x') return { t: 'var' };
      return constFromName(name);
    }
    throw new Error('parse error');
  }

  function parsePow(): Node {
    const base = parsePrimary();
    if (atOp('**')) { pos++; return { t: 'pow', base, exp: parseUnary() }; }
    return base;
  }

  function parseUnary(): Node {
    if (atOp('+') || atOp('-')) {
      const op = eatOp();
      const operand = parseUnary();
      return op === '-' ? { t: 'neg', operand } : operand;
    }
    return parsePow();
  }

  function parseMul(): Node {
    let node = parseUnary();
    while (atOp('*') || atOp('/') || atOp('%')) {
      const op = eatOp();
      const r = parseUnary();
      node = op === '/' ? { t: 'div', n: node, d: r } : op === '%' ? { t: 'mod', l: node, r } : { t: 'mul', l: node, r };
    }
    return node;
  }

  function parseAdd(): Node {
    let node = parseMul();
    while (atOp('+') || atOp('-')) {
      const op = eatOp() as '+' | '-';
      node = { t: 'add', op, l: node, r: parseMul() };
    }
    return node;
  }

  function parseExpr(): Node { return parseAdd(); }

  const result = parseExpr();
  if (pos !== toks.length) throw new Error('trailing tokens');
  return result;
}

const isAtom = (n: Node) => n.t === 'num' || n.t === 'var' || n.t === 'const' || n.t === 'call';

function unwrap(n: Node): string {
  return n.t === 'paren' ? emit(n.inner) : emit(n);
}

function emitChild(n: Node): string {
  return n.t === 'neg' ? `\\left( ${emit(n)} \\right)` : emit(n);
}

function emitPowBase(n: Node): string {
  if (n.t === 'paren' || isAtom(n)) return emit(n);
  return `\\left( ${emit(n)} \\right)`;
}

function emitNegOperand(n: Node): string {
  if (isAtom(n) || n.t === 'paren') return emit(n);
  return `\\left( ${emit(n)} \\right)`;
}

function fallback(name: string, args: Node[]): string {
  return `\\operatorname{${name}}\\left( ${args.map(emit).join(', ')} \\right)`;
}

function emitCall(name: string, args: Node[]): string {
  const one = (sym: string) => args.length === 1 ? `${sym}\\left( ${emit(args[0])} \\right)` : fallback(name, args);
  switch (name) {
    case 'sqrt': return args.length === 1 ? `\\sqrt{${emit(args[0])}}` : fallback(name, args);
    case 'log2': return one('\\log_{2}');
    case 'log10': return one('\\log_{10}');
    case 'log': case 'ln': return one('\\ln');
    case 'exp': return args.length === 1 ? `e^{${unwrap(args[0])}}` : fallback(name, args);
    case 'abs': return args.length === 1 ? `\\left|${emit(args[0])}\\right|` : fallback(name, args);
    case 'sin': return one('\\sin');
    case 'cos': return one('\\cos');
    case 'tan': return one('\\tan');
    case 'sec': return one('\\sec');
    case 'csc': return one('\\csc');
    case 'cot': return one('\\cot');
    case 'sinh': return one('\\sinh');
    case 'cosh': return one('\\cosh');
    case 'tanh': return one('\\tanh');
    case 'asin': return one('\\arcsin');
    case 'acos': return one('\\arccos');
    case 'atan': return one('\\arctan');
    case 'floor': return args.length === 1 ? `\\lfloor ${emit(args[0])} \\rfloor` : fallback(name, args);
    case 'ceil': return args.length === 1 ? `\\lceil ${emit(args[0])} \\rceil` : fallback(name, args);
    case 'round': return one('\\operatorname{round}');
    case 'sign': return one('\\operatorname{sgn}');
    case 'pow': return args.length === 2 ? `${emitPowBase(args[0])}^{${unwrap(args[1])}}` : fallback(name, args);
    case 'min': return args.length >= 1 ? `\\min\\left( ${args.map(emit).join(', ')} \\right)` : fallback(name, args);
    case 'max': return args.length >= 1 ? `\\max\\left( ${args.map(emit).join(', ')} \\right)` : fallback(name, args);
    default: return fallback(name, args);
  }
}

function emit(n: Node): string {
  switch (n.t) {
    case 'num': return n.v;
    case 'var': return 'x';
    case 'const': return n.tex;
    case 'paren': return `\\left( ${emit(n.inner)} \\right)`;
    case 'add': return `${emitChild(n.l)} ${n.op} ${emitChild(n.r)}`;
    case 'mul': return `${emitChild(n.l)} \\cdot ${emitChild(n.r)}`;
    case 'mod': return `${emitChild(n.l)} \\bmod ${emitChild(n.r)}`;
    case 'div': return `\\frac{${unwrap(n.n)}}{${unwrap(n.d)}}`;
    case 'pow': return `${emitPowBase(n.base)}^{${unwrap(n.exp)}}`;
    case 'neg': return `-${emitNegOperand(n.operand)}`;
    case 'call': return emitCall(n.name, n.args);
  }
}

export function formulaToLatex(expr: string): string | null {
  try {
    return emit(parse(expr));
  } catch {
    return null;
  }
}

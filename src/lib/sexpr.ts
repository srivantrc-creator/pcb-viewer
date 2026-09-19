// Minimal S-expression parser for KiCad PCB files.
// KiCad's .kicad_pcb format is a Lisp-like S-expression tree, e.g.
//   (kicad_pcb (version 20221018) (general (thickness 1.6)) ...)
// This module tokenizes and parses that text into a nested JS structure:
// each node is either a string/number "atom" or an array whose first
// element is the tag name, e.g. ["general", ["thickness", 1.6]].

export type SExprAtom = string | number;
export type SExprNode = SExprAtom | SExprNode[];

/** Tokenize raw S-expression text into parens, quoted strings, and atoms. */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const c = input[i];

    if (c === " " || c === "\t" || c === "\r" || c === "\n") {
      i++;
      continue;
    }

    if (c === "(" || c === ")") {
      tokens.push(c);
      i++;
      continue;
    }

    if (c === '"') {
      // Quoted string, with backslash escapes.
      let j = i + 1;
      let buf = '"';
      while (j < n && input[j] !== '"') {
        if (input[j] === "\\" && j + 1 < n) {
          buf += input[j] + input[j + 1];
          j += 2;
        } else {
          buf += input[j];
          j++;
        }
      }
      buf += '"';
      tokens.push(buf);
      i = j + 1;
      continue;
    }

    // Bare atom: read until whitespace or paren.
    let j = i;
    while (j < n && !/[\s()]/.test(input[j])) {
      j++;
    }
    tokens.push(input.slice(i, j));
    i = j;
  }

  return tokens;
}

function unquote(tok: string): string {
  if (tok.length >= 2 && tok[0] === '"' && tok[tok.length - 1] === '"') {
    return tok
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return tok;
}

function parseAtom(tok: string): SExprAtom {
  if (tok[0] === '"') return unquote(tok);
  // KiCad numbers are always plain decimal; anything else stays a string
  // (e.g. layer names like F.Cu, or bare keywords like "signal").
  if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(tok)) {
    return parseFloat(tok);
  }
  return tok;
}

/** Parse full token stream into a forest of nodes (KiCad files have one root). */
export function parseSExpr(input: string): SExprNode[] {
  const tokens = tokenize(input);
  let pos = 0;

  function parseNode(): SExprNode {
    const tok = tokens[pos];
    if (tok === "(") {
      pos++; // consume '('
      const list: SExprNode[] = [];
      while (pos < tokens.length && tokens[pos] !== ")") {
        list.push(parseNode());
      }
      pos++; // consume ')'
      return list;
    }
    pos++;
    return parseAtom(tok);
  }

  const roots: SExprNode[] = [];
  while (pos < tokens.length) {
    roots.push(parseNode());
  }
  return roots;
}

// ---- Small helpers for walking the parsed tree ----

export function isList(node: SExprNode): node is SExprNode[] {
  return Array.isArray(node);
}

export function tag(node: SExprNode): string | undefined {
  if (isList(node) && node.length > 0 && typeof node[0] === "string") {
    return node[0];
  }
  return undefined;
}

/** Find all direct children of `list` whose tag matches `name`. */
export function findAll(list: SExprNode[], name: string): SExprNode[][] {
  const out: SExprNode[][] = [];
  for (const child of list) {
    if (isList(child) && tag(child) === name) out.push(child);
  }
  return out;
}

/** Find the first direct child of `list` whose tag matches `name`. */
export function find(list: SExprNode[], name: string): SExprNode[] | undefined {
  for (const child of list) {
    if (isList(child) && tag(child) === name) return child;
  }
  return undefined;
}

/** Get positional atom args after the tag, e.g. (at 10 20 90) -> [10, 20, 90]. */
export function args(node: SExprNode[]): SExprAtom[] {
  return node.slice(1).filter((n) => !isList(n)) as SExprAtom[];
}

export function num(node: SExprNode[] | undefined, index = 0, fallback = 0): number {
  if (!node) return fallback;
  const a = args(node)[index];
  return typeof a === "number" ? a : fallback;
}

export function str(node: SExprNode[] | undefined, index = 0, fallback = ""): string {
  if (!node) return fallback;
  const a = args(node)[index];
  return typeof a === "string" ? a : fallback;
}

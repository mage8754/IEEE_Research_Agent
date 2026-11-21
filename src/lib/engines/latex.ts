/**
 * LaTeX Shield — deterministic protection of LaTeX syntax.
 * Every protected element is replaced by an opaque placeholder before any text
 * transformation (AI or rule-based) and restored afterwards. If a placeholder is
 * lost or duplicated, the transformation is rejected, so protected syntax is never modified.
 */

export type LatexKind = "math" | "citation" | "reference" | "environment" | "command";

export interface LatexToken {
  placeholder: string;
  value: string;
  kind: LatexKind;
  start: number;
  end: number;
}

export interface LatexSegment {
  text: string;
  kind: LatexKind | null;
}

const MATH_ENVS = "equation|align|alignat|flalign|gather|multline|eqnarray|math|displaymath|split|cases|array|matrix|pmatrix|bmatrix|vmatrix|subequations";
/** Layout environments protected as one block (contents included): tables, figures, code, bibliography. */
const BLOCK_ENVS =
  "table|figure|tabular|tabularx|tabulary|longtable|subfigure|subtable|wrapfigure|algorithm|algorithmic|algorithm2e|lstlisting|verbatim|Verbatim|minted|tikzpicture|picture|thebibliography|IEEEbiography|IEEEbiographynophoto";

type Matcher = (text: string, i: number) => number; // returns match length, 0 if none

const rx =
  (re: RegExp): Matcher =>
  (text, i) => {
    re.lastIndex = i;
    const m = re.exec(text);
    return m ? m[0].length : 0;
  };

/** Matches \name*, then any [..] and balanced {..} argument groups. */
const commandMatcher: Matcher = (text, i) => {
  const head = /\\[a-zA-Z@]+\*?/y;
  head.lastIndex = i;
  const m = head.exec(text);
  if (!m) return 0;
  let j = i + m[0].length;
  for (;;) {
    const ch = text[j];
    if (ch === "[") {
      const close = text.indexOf("]", j);
      if (close === -1 || text.slice(j, close).includes("\n\n")) break;
      j = close + 1;
    } else if (ch === "{") {
      let depth = 0;
      let k = j;
      for (; k < text.length; k++) {
        const c = text[k];
        if (c === "\\") {
          k++;
          continue;
        }
        if (c === "{") depth++;
        else if (c === "}" && --depth === 0) break;
      }
      if (depth !== 0 || k >= text.length) break;
      j = k + 1;
    } else break;
  }
  return j - i;
};

const PATTERNS: { kind: LatexKind; match: Matcher; latexOnly?: boolean }[] = [
  // Whole preamble (\documentclass … \begin{document}) and everything from \end{document}.
  { kind: "command", match: rx(/\\documentclass[\s\S]*?\\begin\{document\}/y) },
  { kind: "command", match: rx(/\\end\{document\}[\s\S]*/y) },
  { kind: "math", match: rx(new RegExp(`\\\\begin\\{(${MATH_ENVS})(\\*?)\\}[\\s\\S]*?\\\\end\\{\\1\\2\\}`, "y")) },
  { kind: "environment", match: rx(new RegExp(`\\\\begin\\{(${BLOCK_ENVS})(\\*?)\\}[\\s\\S]*?\\\\end\\{\\1\\2\\}`, "y")) },
  { kind: "math", match: rx(/\$\$[\s\S]+?\$\$/y) },
  { kind: "math", match: rx(/\\\[[\s\S]+?\\\]/y) },
  { kind: "math", match: rx(/\\\([\s\S]+?\\\)/y) },
  { kind: "math", match: rx(/\$(?!\$)(?:\\.|[^$\\\n])+?\$/y) },
  {
    kind: "citation",
    match: rx(
      /\\(?:cite|citep|citet|citealp|citealt|citeauthor|citeyear|parencite|textcite|autocite|footcite|nocite)\*?(?:\[[^\]]*\]){0,2}\{[^}]*\}/y,
    ),
  },
  { kind: "reference", match: rx(/\\(?:ref|eqref|autoref|cref|Cref|pageref|label|nameref|vref)\{[^}]*\}/y) },
  { kind: "command", match: commandMatcher },
  { kind: "command", match: rx(/\\[%&_#${}~^\\,;!:>| ]/y) },
  // Only in LaTeX documents: comments, non-breaking spaces and grouping braces.
  { kind: "command", match: rx(/%[^\n]*/y), latexOnly: true },
  { kind: "command", match: rx(/[~{}&]/y), latexOnly: true },
];

const TRIGGERS = new Set(["\\", "$", "%", "~", "{", "}", "&"]);

/** Text is treated as LaTeX source when it contains at least one LaTeX command. */
export const isLatexSource = (text: string) => /\\[a-zA-Z]{2,}/.test(text);

export const PLACEHOLDER_RE = /⟦L(\d+)⟧/g;
export const placeholderFor = (i: number) => `⟦L${i}⟧`;

/** Find every protected LaTeX element, in order, without overlaps. */
export function findLatexTokens(text: string): Omit<LatexToken, "placeholder">[] {
  const latex = isLatexSource(text);
  const tokens: Omit<LatexToken, "placeholder">[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (TRIGGERS.has(ch)) {
      let matched = false;
      for (const { kind, match, latexOnly } of PATTERNS) {
        if (latexOnly && !latex) continue;
        const len = match(text, i);
        if (len > 0) {
          tokens.push({ kind, value: text.slice(i, i + len), start: i, end: i + len });
          i += len;
          matched = true;
          break;
        }
      }
      if (matched) continue;
    }
    i++;
  }
  return tokens;
}

export function protectLatex(text: string): { masked: string; tokens: LatexToken[] } {
  const found = findLatexTokens(text);
  let masked = "";
  let cursor = 0;
  const tokens = found.map((t, idx) => {
    masked += text.slice(cursor, t.start) + placeholderFor(idx);
    cursor = t.end;
    return { ...t, placeholder: placeholderFor(idx) };
  });
  masked += text.slice(cursor);
  return { masked, tokens };
}

export interface RestoreResult {
  ok: boolean;
  text: string;
  missing: LatexToken[];
  duplicated: LatexToken[];
}

/** Restore placeholders. Fails if any placeholder is missing, duplicated or invented. */
export function restoreLatex(masked: string, tokens: LatexToken[]): RestoreResult {
  const counts = new Map<string, number>();
  for (const m of masked.matchAll(PLACEHOLDER_RE)) counts.set(m[0], (counts.get(m[0]) ?? 0) + 1);
  const missing = tokens.filter((t) => !counts.has(t.placeholder));
  const duplicated = tokens.filter((t) => (counts.get(t.placeholder) ?? 0) > 1);
  const known = new Set(tokens.map((t) => t.placeholder));
  const invented = [...counts.keys()].some((p) => !known.has(p));
  const byPlaceholder = new Map(tokens.map((t) => [t.placeholder, t.value]));
  const text = masked.replace(PLACEHOLDER_RE, (p) => byPlaceholder.get(p) ?? p);
  return {
    ok: missing.length === 0 && duplicated.length === 0 && !invented,
    text,
    missing,
    duplicated,
  };
}

/** Split text into plain and protected segments for highlighting. */
export function segmentLatex(text: string): LatexSegment[] {
  const segments: LatexSegment[] = [];
  let cursor = 0;
  for (const t of findLatexTokens(text)) {
    if (t.start > cursor) segments.push({ text: text.slice(cursor, t.start), kind: null });
    segments.push({ text: t.value, kind: t.kind });
    cursor = t.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), kind: null });
  return segments;
}

/** Confirms every protected element of the original appears unchanged in the output. */
export function verifyLatexPreserved(original: string, output: string) {
  const before = findLatexTokens(original).map((t) => t.value);
  const after = findLatexTokens(output).map((t) => t.value);
  const remaining = [...after];
  const missing: string[] = [];
  for (const v of before) {
    const idx = remaining.indexOf(v);
    if (idx === -1) missing.push(v);
    else remaining.splice(idx, 1);
  }
  return { preserved: missing.length === 0, total: before.length, missing };
}

export function overlapsProtected(text: string, start: number, end: number) {
  return findLatexTokens(text).some((t) => start < t.end && end > t.start);
}

export function summarizeTokens(tokens: { kind: LatexKind }[]) {
  const counts: Record<LatexKind, number> = { math: 0, citation: 0, reference: 0, environment: 0, command: 0 };
  for (const t of tokens) counts[t.kind]++;
  return counts;
}

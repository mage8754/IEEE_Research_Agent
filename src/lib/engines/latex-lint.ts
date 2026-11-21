/**
 * LaTeX Code Improver — deterministic, local checks for common LaTeX code issues.
 * Fixes only change markup around content (delimiters, spacing, font commands);
 * equation bodies, citation keys and labels are never changed (see latexFingerprint).
 */
import { findLatexTokens } from "./latex";
import { applyEdits } from "./text";

export type LintRule =
  | "display-dollar"
  | "old-font"
  | "nbsp-ref"
  | "nbsp-cite"
  | "merge-cites"
  | "dots"
  | "quotes"
  | "eqnarray"
  | "float-label"
  | "float-caption"
  | "label-order"
  | "duplicate-label"
  | "undefined-ref";

export interface LintFinding {
  id: string;
  rule: LintRule;
  title: string;
  message: string;
  severity: "fix" | "warning" | "info";
  line: number;
  start: number;
  end: number;
  original: string;
  /** Replacement for text[start, end) — only for auto-fixable findings. */
  fix?: string;
}

export const RULE_TITLE: Record<LintRule, string> = {
  "display-dollar": "Deprecated $$…$$ display math",
  "old-font": "Obsolete font command",
  "nbsp-ref": "Breakable space before reference",
  "nbsp-cite": "Breakable space before citation",
  "merge-cites": "Consecutive \\cite commands",
  dots: "Three periods instead of \\dots",
  quotes: "Straight double quotes",
  eqnarray: "Deprecated eqnarray environment",
  "float-label": "Figure or table without \\label",
  "float-caption": "Figure or table without \\caption",
  "label-order": "\\label placed before \\caption",
  "duplicate-label": "Duplicate \\label",
  "undefined-ref": "Reference to a label not in this file",
};

const FONT: Record<string, string> = { bf: "textbf", it: "textit", em: "emph", rm: "textrm", tt: "texttt", sc: "textsc", sf: "textsf" };

type Range = [number, number];
const overlaps = (ranges: Range[], s: number, e: number) => ranges.some(([a, b]) => s < b && e > a);

function regions(text: string) {
  const code: Range[] = [];
  for (const m of text.matchAll(/(?<!\\)%[^\n]*/g)) code.push([m.index!, m.index! + m[0].length]);
  for (const m of text.matchAll(/\\begin\{(verbatim|Verbatim|lstlisting|minted)\*?\}[\s\S]*?\\end\{\1\*?\}/g))
    code.push([m.index!, m.index! + m[0].length]);
  const pre = text.search(/\\begin\{document\}/);
  if (pre > 0) code.push([0, pre + "\\begin{document}".length]);
  const math: Range[] = findLatexTokens(text)
    .filter((t) => t.kind === "math")
    .map((t) => [t.start, t.end]);
  return { code, math };
}

const lineAt = (text: string, idx: number) => text.slice(0, idx).split("\n").length;

export function lintLatex(text: string): LintFinding[] {
  const { code, math } = regions(text);
  const skipText = [...code, ...math];
  const raw: Omit<LintFinding, "id" | "line" | "title">[] = [];
  const add = (f: Omit<LintFinding, "id" | "line" | "title">) => raw.push(f);

  // $$…$$ → \[…\]
  for (const t of findLatexTokens(text)) {
    if (t.kind !== "math" || !t.value.startsWith("$$") || overlaps(code, t.start, t.end)) continue;
    add({ rule: "display-dollar", severity: "fix", start: t.start, end: t.end, original: t.value, fix: `\\[${t.value.slice(2, -2)}\\]`, message: "Plain TeX $$…$$ gives inconsistent spacing in LaTeX. Use \\[…\\] (or an equation environment)." });
  }
  // {\bf text} → \textbf{text}
  for (const m of text.matchAll(/\{\\(bf|it|em|rm|tt|sc|sf)\s+([^{}]*)\}/g)) {
    const s = m.index!, e = s + m[0].length;
    if (overlaps(skipText, s, e)) continue;
    add({ rule: "old-font", severity: "fix", start: s, end: e, original: m[0], fix: `\\${FONT[m[1]!]}{${m[2]}}`, message: `\\${m[1]} is an obsolete LaTeX 2.09 command. Use \\${FONT[m[1]!]}{…}.` });
  }
  // Fig. \ref → Fig.~\ref
  for (const m of text.matchAll(/\b(Figs?\.|Figures?|Tables?|Eqs?\.|Equations?|Sections?|Sec\.|Algorithms?|Alg\.|Chapters?|Appendix)([ \t]+)(?=\\(?:ref|eqref|autoref|cref)\{)/g)) {
    const s = m.index! + m[1]!.length, e = s + m[2]!.length;
    if (overlaps(skipText, s, e)) continue;
    add({ rule: "nbsp-ref", severity: "fix", start: s, end: e, original: m[2]!, fix: "~", message: `Use a non-breaking space so “${m[1]}” and its number never split across lines.` });
  }
  // word \cite → word~\cite
  for (const m of text.matchAll(/([A-Za-z0-9)\]])([ \t]+)(?=\\cite[a-z]*\*?[[{])/g)) {
    const s = m.index! + 1, e = s + m[2]!.length;
    if (overlaps(skipText, s, e)) continue;
    add({ rule: "nbsp-cite", severity: "fix", start: s, end: e, original: m[2]!, fix: "~", message: "IEEE style keeps citations attached to the preceding word with a non-breaking space (~)." });
  }
  // \cite{a}\cite{b} → \cite{a,b}
  for (const m of text.matchAll(/\\cite\{[^}]+\}(?:[\s~,]*\\cite\{[^}]+\})+/g)) {
    const s = m.index!, e = s + m[0].length;
    if (overlaps(code, s, e)) continue;
    const keys = [...m[0].matchAll(/\\cite\{([^}]+)\}/g)].map((k) => k[1]!.trim());
    add({ rule: "merge-cites", severity: "fix", start: s, end: e, original: m[0], fix: `\\cite{${keys.join(", ")}}`, message: "Combine consecutive citations into one \\cite{…} so IEEE style can render them as a range like [1]–[3]." });
  }
  // ... → \dots
  for (const m of text.matchAll(/(?<!\.)\.\.\.(?!\.)/g)) {
    const s = m.index!, e = s + 3;
    if (overlaps(skipText, s, e)) continue;
    const fix = /\s/.test(text[e] ?? "") ? "\\dots{}" : "\\dots";
    add({ rule: "dots", severity: "fix", start: s, end: e, original: "...", fix, message: "Three periods are spaced too tightly. \\dots gives correct ellipsis spacing." });
  }
  // "text" → ``text''
  for (const m of text.matchAll(/(?<![\\\w])"([^"\n]{1,200})"/g)) {
    const s = m.index!, e = s + m[0].length;
    if (overlaps(skipText, s, e)) continue;
    add({ rule: "quotes", severity: "fix", start: s, end: e, original: m[0], fix: `\`\`${m[1]}''`, message: "Straight quotes render as two closing quotes. Use ``…'' in LaTeX." });
  }
  // Report-only checks
  for (const m of text.matchAll(/\\begin\{eqnarray\*?\}/g)) {
    if (overlaps(code, m.index!, m.index! + 1)) continue;
    add({ rule: "eqnarray", severity: "warning", start: m.index!, end: m.index! + m[0].length, original: m[0], message: "eqnarray produces uneven spacing around = signs. Consider align from amsmath (requires changing & placement, so it is not done automatically)." });
  }
  for (const m of text.matchAll(/\\begin\{(figure|table)(\*?)\}[\s\S]*?\\end\{\1\2\}/g)) {
    const s = m.index!, e = s + m[0].length;
    if (overlaps(code, s, s + 1)) continue;
    const body = m[0];
    const cap = body.search(/\\caption\b/);
    const lab = body.search(/\\label\{/);
    const head = body.slice(0, body.indexOf("}") + 1);
    if (cap === -1) add({ rule: "float-caption", severity: "warning", start: s, end: s + head.length, original: head, message: `This ${m[1]} has no \\caption. IEEE requires captions on every figure and table.` });
    if (lab === -1) add({ rule: "float-label", severity: "info", start: s, end: s + head.length, original: head, message: `This ${m[1]} has no \\label, so it cannot be referenced with \\ref.` });
    if (cap !== -1 && lab !== -1 && lab < cap) add({ rule: "label-order", severity: "warning", start: s + lab, end: s + lab + (body.slice(lab).match(/\\label\{[^}]*\}/)?.[0].length ?? 6), original: body.slice(lab).match(/\\label\{[^}]*\}/)?.[0] ?? "\\label", message: "Place \\label after \\caption, otherwise \\ref prints the section number instead of the figure/table number." });
  }
  const labels = new Map<string, number[]>();
  for (const m of text.matchAll(/\\label\{([^}]*)\}/g)) {
    if (overlaps(code, m.index!, m.index! + 1)) continue;
    labels.set(m[1]!, [...(labels.get(m[1]!) ?? []), m.index!]);
  }
  for (const [key, idxs] of labels) {
    for (const idx of idxs.slice(1)) add({ rule: "duplicate-label", severity: "warning", start: idx, end: idx + key.length + 8, original: `\\label{${key}}`, message: `The label “${key}” is defined ${idxs.length} times; references to it will be ambiguous.` });
  }
  for (const m of text.matchAll(/\\(?:ref|eqref|autoref|cref|Cref|pageref)\{([^}]*)\}/g)) {
    if (overlaps(code, m.index!, m.index! + 1)) continue;
    for (const key of m[1]!.split(",").map((k) => k.trim())) {
      if (key && !labels.has(key))
        add({ rule: "undefined-ref", severity: "info", start: m.index!, end: m.index! + m[0].length, original: m[0], message: `No \\label{${key}} in this file. Fine if it is defined in another file; otherwise LaTeX prints “??”.` });
    }
  }

  // Order, drop overlapping fixes (keep the first), assign ids and line numbers.
  raw.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: LintFinding[] = [];
  let lastFixEnd = -1;
  for (const f of raw) {
    if (f.fix !== undefined) {
      if (f.start < lastFixEnd) continue;
      lastFixEnd = f.end;
    }
    out.push({ ...f, id: `f${out.length}`, title: RULE_TITLE[f.rule], line: lineAt(text, f.start) });
  }
  return out;
}

/** Applies the chosen auto-fixes to the original text. */
export function applyLintFixes(text: string, findings: LintFinding[], chosen: ReadonlySet<string>) {
  return applyEdits(
    text,
    findings.filter((f) => f.fix !== undefined && chosen.has(f.id)).map((f) => ({ start: f.start, end: f.end, suggestion: f.fix! })),
  );
}

/** Content that must survive any code fix: citation keys, labels, references and equation bodies. */
export function latexFingerprint(text: string) {
  const keys = (re: RegExp) =>
    [...text.matchAll(re)].flatMap((m) => m[1]!.split(",").map((k) => k.trim())).filter(Boolean).sort();
  const math = findLatexTokens(text)
    .filter((t) => t.kind === "math")
    .map((t) =>
      t.value
        .replace(/^\$\$|\$\$$/g, "")
        .replace(/^\\\[|\\\]$/g, "")
        .replace(/^\\\(|\\\)$/g, "")
        .replace(/^\$|\$$/g, "")
        .replace(/\s+/g, ""),
    );
  return JSON.stringify({
    cites: keys(/\\cite[a-z]*\*?(?:\[[^\]]*\]){0,2}\{([^}]*)\}/g),
    labels: keys(/\\label\{([^}]*)\}/g),
    refs: keys(/\\(?:ref|eqref|autoref|cref|Cref|pageref)\{([^}]*)\}/g),
    math,
  });
}

export const contentPreserved = (before: string, after: string) => latexFingerprint(before) === latexFingerprint(after);

/**
 * Local, deterministic change detection between an original text and an AI rewrite.
 * LaTeX elements are atomic anchors: change hunks never span them, so any mix of
 * accepted/rejected hunks keeps every protected element exactly once, in order.
 */
import { diffWordsWithSpace } from "diff";
import { findLatexTokens } from "./latex";

export interface DiffHunk {
  id: string;
  before: string;
  after: string;
}
export type DiffPart = { type: "same"; text: string } | { type: "change"; hunk: DiffHunk };

type Raw = { type: "same"; text: string } | { type: "change"; before: string; after: string };

function diffProse(a: string, b: string): Raw[] {
  if (a === b) return a ? [{ type: "same", text: a }] : [];
  const out: Raw[] = [];
  for (const c of diffWordsWithSpace(a, b)) {
    const last = out[out.length - 1];
    if (!c.added && !c.removed) out.push({ type: "same", text: c.value });
    else if (last?.type === "change") {
      if (c.added) last.after += c.value;
      else last.before += c.value;
    } else out.push({ type: "change", before: c.removed ? c.value : "", after: c.added ? c.value : "" });
  }
  // Merge changes separated only by whitespace or one short word into phrase-level hunks.
  const merged: Raw[] = [];
  for (let i = 0; i < out.length; i++) {
    const cur = out[i]!;
    const prev = merged[merged.length - 1];
    const next = out[i + 1];
    if (cur.type === "same" && prev?.type === "change" && next?.type === "change" && /^\s*\S{0,3}\s*$/.test(cur.text)) {
      prev.before += cur.text + next.before;
      prev.after += cur.text + next.after;
      i++;
      continue;
    }
    if (cur.type === "change" && prev?.type === "change") {
      prev.before += cur.before;
      prev.after += cur.after;
      continue;
    }
    merged.push(cur.type === "same" ? { ...cur } : { ...cur });
  }
  return merged;
}

/** Splits text into prose segments around LaTeX tokens. */
function split(text: string) {
  const tokens = findLatexTokens(text);
  const prose: string[] = [];
  let cursor = 0;
  for (const t of tokens) {
    prose.push(text.slice(cursor, t.start));
    cursor = t.end;
  }
  prose.push(text.slice(cursor));
  return { tokens: tokens.map((t) => t.value), prose };
}

export function buildDiff(original: string, improved: string): { parts: DiffPart[]; granular: boolean } {
  const a = split(original);
  const b = split(improved);
  const sameAnchors = a.tokens.length === b.tokens.length && a.tokens.every((t, i) => t === b.tokens[i]);
  let raw: Raw[];
  if (!sameAnchors) {
    raw = original === improved ? [{ type: "same", text: original }] : [{ type: "change", before: original, after: improved }];
  } else {
    raw = [];
    a.prose.forEach((p, i) => {
      raw.push(...diffProse(p, b.prose[i]!));
      if (i < a.tokens.length) raw.push({ type: "same", text: a.tokens[i]! });
    });
  }
  let n = 0;
  const parts: DiffPart[] = raw
    .filter((r) => (r.type === "same" ? r.text.length > 0 : true))
    .map((r) => (r.type === "same" ? r : { type: "change", hunk: { id: `h${n++}`, before: r.before, after: r.after } }));
  return { parts, granular: sameAnchors };
}

/** Builds the final text: accepted hunks use the rewrite, rejected hunks keep the original. */
export function composeDiff(parts: DiffPart[], rejected: ReadonlySet<string>) {
  return parts.map((p) => (p.type === "same" ? p.text : rejected.has(p.hunk.id) ? p.hunk.before : p.hunk.after)).join("");
}

export const countHunks = (parts: DiffPart[]) => parts.filter((p) => p.type === "change").length;

export const countWords = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

export const normalizeSpace = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** True when `quote` appears in `source`, ignoring whitespace and case differences. */
export function quoteAppearsIn(source: string, quote: string) {
  const q = normalizeSpace(quote).replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  if (q.length < 8) return false;
  const s = normalizeSpace(source).replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  return s.includes(q);
}

/** Locate AI-suggested edits in the original text; drops anything not found verbatim. */
export function locateEdits<T extends { original: string }>(text: string, edits: T[]) {
  const located: (T & { start: number; end: number })[] = [];
  let cursor = 0;
  for (const e of edits) {
    if (!e.original) continue;
    let idx = text.indexOf(e.original, cursor);
    if (idx === -1) idx = text.indexOf(e.original);
    if (idx === -1) continue;
    const end = idx + e.original.length;
    if (located.some((l) => idx < l.end && end > l.start)) continue;
    located.push({ ...e, start: idx, end });
    cursor = end;
  }
  return located.sort((a, b) => a.start - b.start);
}

/** Apply accepted edits (non-overlapping, with start/end) to text. */
export function applyEdits(
  text: string,
  edits: { start: number; end: number; suggestion: string }[],
) {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.suggestion + out.slice(e.end);
  }
  return out;
}

/** Numbers as written (e.g. "95.2", "1,024", "3") — LaTeX placeholders are ignored. */
export function extractNumbers(text: string) {
  return (text.replace(/⟦L\d+⟧/g, " ").match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/[.,]$/, ""));
}

/** Every number in `before` must appear in `after` the same number of times, and no new numbers may appear. */
export function numbersPreserved(before: string, after: string) {
  const a = extractNumbers(before);
  const b = extractNumbers(after);
  const remaining = [...b];
  const missing: string[] = [];
  for (const n of a) {
    const i = remaining.indexOf(n);
    if (i === -1) missing.push(n);
    else remaining.splice(i, 1);
  }
  return { ok: missing.length === 0 && remaining.length === 0, missing, added: remaining, total: a.length };
}

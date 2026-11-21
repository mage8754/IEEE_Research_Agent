/**
 * Citation Consistency Checker — local, deterministic.
 * Compares \cite keys in a manuscript against entries in a BibTeX file.
 * It never claims a reference is externally verified: it only checks internal consistency.
 */

export interface CitationUse {
  key: string;
  line: number;
  command: string;
}

export interface BibEntry {
  key: string;
  type: string;
  line: number;
  fields: Record<string, string>;
}

export interface CitationReport {
  uses: CitationUse[];
  citedKeys: { key: string; count: number; lines: number[] }[];
  entries: BibEntry[];
  missing: { key: string; lines: number[] }[];
  unused: BibEntry[];
  duplicates: { key: string; lines: number[] }[];
  incomplete: { key: string; line: number; missingFields: string[] }[];
  issueCount: number;
}

const CITE_RE =
  /\\(cite|citep|citet|citealp|citealt|citeauthor|citeyear|parencite|textcite|autocite|footcite|nocite)\*?(?:\[[^\]]*\]){0,2}\{([^}]*)\}/g;

const lineAt = (text: string, index: number) => text.slice(0, index).split("\n").length;

export function extractCitations(tex: string): CitationUse[] {
  const uses: CitationUse[] = [];
  // Ignore commented-out lines.
  const cleaned = tex.replace(/(^|[^\\])%.*$/gm, (m, p1) => p1 + " ".repeat(m.length - p1.length));
  for (const m of cleaned.matchAll(CITE_RE)) {
    const line = lineAt(cleaned, m.index ?? 0);
    for (const raw of (m[2] ?? "").split(",")) {
      const key = raw.trim();
      if (key && key !== "*") uses.push({ key, line, command: `\\${m[1]}` });
    }
  }
  return uses;
}

const REQUIRED: Record<string, string[]> = {
  article: ["author", "title", "journal", "year"],
  inproceedings: ["author", "title", "booktitle", "year"],
  conference: ["author", "title", "booktitle", "year"],
  book: ["title", "publisher", "year"],
  incollection: ["author", "title", "booktitle", "year"],
  phdthesis: ["author", "title", "school", "year"],
  mastersthesis: ["author", "title", "school", "year"],
  techreport: ["author", "title", "institution", "year"],
  misc: ["title"],
  online: ["title", "url"],
};

export function parseBibtex(bib: string): BibEntry[] {
  const entries: BibEntry[] = [];
  const headRe = /@([a-zA-Z]+)\s*\{\s*([^,\s]+)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = headRe.exec(bib))) {
    const type = (m[1] ?? "").toLowerCase();
    if (type === "comment" || type === "string" || type === "preamble") continue;
    // Find the matching closing brace for this entry.
    let depth = 1;
    let i = bib.indexOf("{", m.index) + 1;
    while (i < bib.length && depth > 0) {
      if (bib[i] === "{") depth++;
      else if (bib[i] === "}") depth--;
      i++;
    }
    const body = bib.slice(headRe.lastIndex, i - 1);
    const fields: Record<string, string> = {};
    const fieldRe = /([a-zA-Z_-]+)\s*=\s*(\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)"|(\w+))/g;
    let f: RegExpExecArray | null;
    while ((f = fieldRe.exec(body))) {
      fields[(f[1] ?? "").toLowerCase()] = (f[3] ?? f[4] ?? f[5] ?? "").trim();
    }
    entries.push({ key: m[2] ?? "", type, line: lineAt(bib, m.index), fields });
    headRe.lastIndex = i;
  }
  return entries;
}

export function checkCitations(tex: string, bib: string): CitationReport {
  const uses = extractCitations(tex);
  const entries = parseBibtex(bib);

  const cited = new Map<string, number[]>();
  for (const u of uses) cited.set(u.key, [...(cited.get(u.key) ?? []), u.line]);
  const citedKeys = [...cited.entries()].map(([key, lines]) => ({ key, count: lines.length, lines }));

  const entryKeys = new Map<string, number[]>();
  for (const e of entries) entryKeys.set(e.key, [...(entryKeys.get(e.key) ?? []), e.line]);

  const missing = citedKeys.filter((c) => !entryKeys.has(c.key)).map(({ key, lines }) => ({ key, lines }));
  const unused = entries.filter(
    (e, idx) => !cited.has(e.key) && entries.findIndex((x) => x.key === e.key) === idx,
  );
  const duplicates = [...entryKeys.entries()]
    .filter(([, lines]) => lines.length > 1)
    .map(([key, lines]) => ({ key, lines }));
  const incomplete = entries
    .map((e) => ({
      key: e.key,
      line: e.line,
      missingFields: (REQUIRED[e.type] ?? ["title"]).filter((f) => !e.fields[f]),
    }))
    .filter((e) => e.missingFields.length > 0);

  return {
    uses,
    citedKeys,
    entries,
    missing,
    unused,
    duplicates,
    incomplete,
    issueCount: missing.length + unused.length + duplicates.length + incomplete.length,
  };
}

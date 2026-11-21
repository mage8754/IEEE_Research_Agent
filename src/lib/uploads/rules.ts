/**
 * File-upload rules per module. Pure functions shared by the browser (instant
 * feedback) and the server (authoritative check before any analysis runs).
 * Files are never converted: a file that does not match the rules is rejected.
 */
import { z } from "zod";

export type UploadKind = "tex" | "bib" | "pdf";
export type UploadModule =
  | "humanizer"
  | "grammar"
  | "writing"
  | "latex"
  | "latexcode"
  | "pdf"
  | "citations"
  | "literature"
  | "reviewer";

/** "any" = pasted text allowed, "latex" = pasted text must be LaTeX source, "none" = files only. */
export type PasteRule = "any" | "latex" | "none";

export const UPLOAD_RULES: Record<UploadModule, { name: string; kinds: UploadKind[]; paste: PasteRule; summary: string }> = {
  humanizer: { name: "AI Humanizer", kinds: ["tex"], paste: "any", summary: "pasted text or .tex files" },
  grammar: { name: "Grammar Checker", kinds: ["tex"], paste: "any", summary: "pasted text or .tex files" },
  writing: { name: "Academic Writing Assistant", kinds: ["tex"], paste: "any", summary: "pasted text or .tex files" },
  latex: { name: "LaTeX Shield", kinds: ["tex"], paste: "latex", summary: ".tex files (or pasted LaTeX source) only" },
  latexcode: { name: "LaTeX Code Improver", kinds: ["tex"], paste: "latex", summary: ".tex files (or pasted LaTeX source) only" },
  pdf: { name: "PDF Research Analyzer", kinds: ["pdf"], paste: "none", summary: ".pdf files only" },
  citations: { name: "Citation Checker", kinds: ["tex", "bib"], paste: "any", summary: ".tex and .bib files" },
  literature: { name: "Literature Review", kinds: ["pdf"], paste: "any", summary: ".pdf files or pasted research text" },
  reviewer: { name: "IEEE Reviewer", kinds: ["tex", "pdf"], paste: "any", summary: ".tex or .pdf files" },
};

export const MAX_TEXT_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

const ACCEPT: Record<UploadKind, string> = { tex: ".tex", bib: ".bib", pdf: ".pdf,application/pdf" };
export const acceptFor = (kinds: UploadKind[]) => kinds.map((k) => ACCEPT[k]).join(",");
export const kindsLabel = (kinds: UploadKind[]) => kinds.map((k) => `.${k}`).join(" or ");

export function extensionOf(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

export function kindFromName(fileName: string): UploadKind | null {
  const ext = extensionOf(fileName);
  return ext === "tex" || ext === "bib" || ext === "pdf" ? ext : null;
}

export type Check<T = UploadKind> = { ok: true; kind: T } | { ok: false; error: string };

/** Checks the file name and size against the module's rules. */
export function checkFileMeta(
  module: UploadModule,
  file: { fileName: string; size?: number },
  allowed: UploadKind[] = UPLOAD_RULES[module].kinds,
): Check {
  const rule = UPLOAD_RULES[module];
  const permitted = allowed.filter((k) => rule.kinds.includes(k));
  const kind = kindFromName(file.fileName);
  const ext = extensionOf(file.fileName);
  if (!kind || !permitted.includes(kind)) {
    const what = ext ? `.${ext} files are` : "Files without an extension are";
    return { ok: false, error: `${what} not supported here. ${rule.name} accepts ${kindsLabel(permitted)} files only.` };
  }
  if (file.size !== undefined) {
    if (file.size === 0) return { ok: false, error: `“${file.fileName}” is empty.` };
    const max = kind === "pdf" ? MAX_PDF_BYTES : MAX_TEXT_FILE_BYTES;
    if (file.size > max) return { ok: false, error: `“${file.fileName}” is larger than ${max / 1024 / 1024} MB.` };
  }
  return { ok: true, kind };
}

const looksBinary = (text: string) => {
  if (text.includes("\u0000")) return true;
  const sample = text.slice(0, 20000);
  const bad = sample.match(/[\uFFFD\u0001-\u0008\u000E-\u001F]/g)?.length ?? 0;
  return sample.length > 0 && bad / sample.length > 0.01;
};

/** True when text contains LaTeX syntax (a command such as \section or inline math). */
export const looksLikeLatex = (text: string) => /\\[a-zA-Z]{2,}/.test(text) || /\$[^$\n]+\$/.test(text);

export function checkTexContent(text: string): string | null {
  if (!text.trim()) return "This .tex file is empty.";
  if (looksBinary(text)) return "This file has a .tex name but contains binary data, not LaTeX source.";
  if (!looksLikeLatex(text)) return "This file has a .tex name but doesn't contain LaTeX source (no LaTeX commands found).";
  return null;
}

export function checkBibContent(text: string): string | null {
  if (!text.trim()) return "This .bib file is empty.";
  if (looksBinary(text)) return "This file has a .bib name but contains binary data, not BibTeX.";
  if (!/@[a-zA-Z]+\s*[{(]/.test(text)) return "This file has a .bib name but contains no BibTeX entries (like @article{key, …}).";
  return null;
}

const ascii = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join("");

/** Checks the first and last bytes of a PDF: it must start with a %PDF- header and end with %%EOF. */
export function checkPdfBytes(head: Uint8Array, tail: Uint8Array): string | null {
  if (!ascii(head.slice(0, 1024)).includes("%PDF-")) return "This file has a .pdf name but is not a PDF document.";
  if (!ascii(tail).includes("%%EOF")) return "This PDF appears to be incomplete or damaged.";
  return null;
}

export function bytesToBase64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function base64ToBytes(b64: string) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Checks pasted (non-file) text against the module's paste rule. */
export function checkPastedText(module: UploadModule, text: string): string | null {
  const rule = UPLOAD_RULES[module];
  if (rule.paste === "none") return `${rule.name} accepts ${rule.summary}. Please upload a file.`;
  if (rule.paste === "latex" && !looksLikeLatex(text))
    return `${rule.name} accepts ${rule.summary}. This text contains no LaTeX — use the Writing Assistant or AI Humanizer for plain text.`;
  return null;
}

/** Where the analysed text came from. Sent with every analysis so the server can re-check it. */
export const sourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("paste") }),
  z.object({ kind: z.literal("tex"), fileName: z.string().min(1).max(255) }),
  z.object({ kind: z.literal("bib"), fileName: z.string().min(1).max(255) }),
  z.object({
    kind: z.literal("pdf"),
    fileName: z.string().min(1).max(255),
    head: z.string().max(4000),
    tail: z.string().max(4000),
  }),
]);
export type UploadSource = z.infer<typeof sourceSchema>;
export const PASTED: UploadSource = { kind: "paste" };

/** Validates a source + its text for a module. Returns an error message, or null when allowed. */
export function checkSource(module: UploadModule, source: UploadSource, text: string, allowed?: UploadKind[]): string | null {
  if (source.kind === "paste") return checkPastedText(module, text);
  const meta = checkFileMeta(module, { fileName: source.fileName }, allowed);
  if (!meta.ok) return meta.error;
  if (meta.kind !== source.kind) return `“${source.fileName}” does not match its declared file type.`;
  if (source.kind === "tex") return checkTexContent(text);
  if (source.kind === "bib") return checkBibContent(text);
  try {
    return checkPdfBytes(base64ToBytes(source.head), base64ToBytes(source.tail));
  } catch {
    return "This PDF could not be checked. Please upload it again.";
  }
}

/** Server-side guard: throws a user-readable error when the source is not allowed. */
export function assertSource(module: UploadModule, source: UploadSource, text: string, allowed?: UploadKind[]) {
  const error = checkSource(module, source, text, allowed);
  if (error) throw new Error(error);
}

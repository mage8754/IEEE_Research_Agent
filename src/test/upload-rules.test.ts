import { describe, expect, it } from "vitest";
import { bytesToBase64, checkFileMeta, checkSource, UPLOAD_RULES } from "@/lib/uploads/rules";

const enc = (s: string) => new TextEncoder().encode(s);
const pdfSource = (head: string, tail: string) => ({
  kind: "pdf" as const,
  fileName: "paper.pdf",
  head: bytesToBase64(enc(head)),
  tail: bytesToBase64(enc(tail)),
});

describe("Allowed file types per module", () => {
  it("AI Humanizer, Grammar Checker and Writing Assistant accept text and .tex only", () => {
    for (const m of ["humanizer", "grammar", "writing"] as const) {
      expect(UPLOAD_RULES[m].kinds).toEqual(["tex"]);
      expect(UPLOAD_RULES[m].paste).toBe("any");
    }
  });
  it("LaTeX Shield and LaTeX Code Improver accept only .tex (pasted text must be LaTeX)", () => {
    for (const m of ["latex", "latexcode"] as const) {
      expect(UPLOAD_RULES[m].kinds).toEqual(["tex"]);
      expect(checkSource(m, { kind: "paste" }, "Plain sentence without any markup at all.")).not.toBeNull();
      expect(checkSource(m, { kind: "paste" }, "See \\cite{a} and $x$.")).toBeNull();
    }
  });
  it("PDF Analyzer accepts only .pdf and no pasted text", () => {
    expect(UPLOAD_RULES.pdf.kinds).toEqual(["pdf"]);
    expect(checkSource("pdf", { kind: "paste" }, "x".repeat(500))).not.toBeNull();
  });
  it("Citation Checker accepts .tex and .bib", () => {
    expect(UPLOAD_RULES.citations.kinds).toEqual(["tex", "bib"]);
  });
  it("Literature Review accepts .pdf files and pasted text", () => {
    expect(UPLOAD_RULES.literature.kinds).toEqual(["pdf"]);
    expect(UPLOAD_RULES.literature.paste).toBe("any");
  });
  it("IEEE Reviewer accepts .tex or .pdf", () => {
    expect(UPLOAD_RULES.reviewer.kinds).toEqual(["tex", "pdf"]);
  });
  it("rejects unsupported extensions with a clear message", () => {
    const r = checkFileMeta("grammar", { fileName: "paper.docx", size: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(".docx files are not supported");
    expect(checkFileMeta("pdf", { fileName: "paper.tex", size: 100 }).ok).toBe(false);
    expect(checkFileMeta("reviewer", { fileName: "paper.bib", size: 100 }).ok).toBe(false);
  });
});

describe("Content checks (not just extensions)", () => {
  it("rejects a .tex file that contains no LaTeX", () => {
    expect(checkSource("grammar", { kind: "tex", fileName: "a.tex" }, "just words here")).not.toBeNull();
    expect(checkSource("grammar", { kind: "tex", fileName: "a.tex" }, "\\section{Intro} words")).toBeNull();
  });
  it("rejects a .bib file without BibTeX entries", () => {
    expect(checkSource("citations", { kind: "bib", fileName: "r.bib" }, "hello")).not.toBeNull();
    expect(checkSource("citations", { kind: "bib", fileName: "r.bib" }, "@article{k, title={T}}")).toBeNull();
  });
  it("rejects a renamed file that is not really a PDF", () => {
    expect(checkSource("pdf", pdfSource("PK\u0003\u0004 zip data", "end"), "")).not.toBeNull();
    expect(checkSource("pdf", pdfSource("%PDF-1.7\n...", "...\n%%EOF\n"), "")).toBeNull();
  });
  it("rejects a declared file type that does not match the file name", () => {
    expect(checkSource("reviewer", { kind: "tex", fileName: "paper.pdf" }, "\\section{A}")).not.toBeNull();
  });
});

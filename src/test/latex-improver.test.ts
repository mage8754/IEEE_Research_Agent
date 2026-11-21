import { describe, expect, it } from "vitest";
import { applyLintFixes, contentPreserved, lintLatex } from "@/lib/engines/latex-lint";
import { findLatexTokens, protectLatex } from "@/lib/engines/latex";

const DOC = `As shown in Fig. \\ref{fig:a}, results improve \\cite{x}\\cite{y}. We use {\\bf bold} words "quoted" and so on...
$$ E = mc^2 $$
\\begin{figure}
\\label{fig:a}
\\caption{Overview}
\\end{figure}
% {\\bf comment} must stay
See Table \\ref{tab:missing}.`;

describe("LaTeX Code Improver", () => {
  const findings = lintLatex(DOC);
  const rules = findings.map((f) => f.rule);

  it("finds the common code issues", () => {
    for (const r of ["nbsp-ref", "merge-cites", "old-font", "quotes", "dots", "display-dollar", "label-order", "undefined-ref"] as const)
      expect(rules).toContain(r);
  });

  it("never touches comments", () => {
    expect(findings.some((f) => f.original.includes("comment"))).toBe(false);
  });

  it("applying all fixes keeps citation keys, labels, references and equation bodies", () => {
    const all = new Set(findings.filter((f) => f.fix).map((f) => f.id));
    const fixed = applyLintFixes(DOC, findings, all);
    expect(fixed).toContain("Fig.~\\ref{fig:a}");
    expect(fixed).toContain("\\cite{x, y}");
    expect(fixed).toContain("\\textbf{bold}");
    expect(fixed).toContain("\\[ E = mc^2 \\]");
    expect(contentPreserved(DOC, fixed)).toBe(true);
  });

  it("applies nothing when every fix is rejected", () => {
    expect(applyLintFixes(DOC, findings, new Set())).toBe(DOC);
  });
});

describe("LaTeX Shield protects tables, figures, environments and the preamble", () => {
  const TEX = `\\documentclass{IEEEtran}
\\usepackage{amsmath}
\\begin{document}
\\author{\\IEEEauthorblockN{A. Person}\\IEEEauthorblockA{\\textit{Dept.}\\\\ Uni}}
Our model was trained for 10 epochs.
\\begin{table}[t]\\caption{Results}\\begin{tabular}{|c|c|}0.91 & 0.88\\\\\\end{tabular}\\end{table}
\\begin{itemize}\\item first point\\end{itemize}
% reviewer note
\\end{document}`;

  it("masks the preamble, table contents, nested-brace commands and comments as whole blocks", () => {
    const { masked } = protectLatex(TEX);
    expect(masked).not.toContain("documentclass");
    expect(masked).not.toContain("0.91");
    expect(masked).not.toContain("IEEEauthorblockA");
    expect(masked).not.toContain("reviewer note");
    expect(masked).not.toMatch(/[{}]/);
    expect(masked).toContain("Our model was trained for 10 epochs.");
    expect(masked).toContain("first point");
  });

  it("counts table and figure blocks as environments", () => {
    expect(findLatexTokens(TEX).some((t) => t.kind === "environment" && t.value.startsWith("\\begin{table}"))).toBe(true);
  });

  it("leaves a percent sign in plain text alone", () => {
    expect(protectLatex("We reach 95% accuracy on the test set.").tokens).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import { protectLatex, restoreLatex, verifyLatexPreserved, findLatexTokens } from "@/lib/engines/latex";

const SAMPLE =
  "As shown in \\cite{he2016deep}, the loss $\\mathcal{L} = \\sum_i x_i$ converges (see Eq.~\\eqref{eq:loss}).\n\\begin{equation}\\label{eq:loss} y = Wx + b \\end{equation}";

describe("LaTeX Shield", () => {
  it("protects citations, references, inline math and equation environments", () => {
    const kinds = findLatexTokens(SAMPLE).map((t) => t.kind);
    expect(kinds).toContain("citation");
    expect(kinds).toContain("reference");
    expect(kinds.filter((k) => k === "math").length).toBe(2);
  });

  it("masks protected syntax so it never reaches the rewriter", () => {
    const { masked } = protectLatex(SAMPLE);
    expect(masked).not.toContain("\\cite");
    expect(masked).not.toContain("\\begin{equation}");
    expect(masked).not.toContain("$");
  });

  it("restores the original exactly when placeholders survive", () => {
    const { masked, tokens } = protectLatex(SAMPLE);
    const result = restoreLatex(masked.replace("As shown in", "As demonstrated in"), tokens);
    expect(result.ok).toBe(true);
    expect(verifyLatexPreserved(SAMPLE, result.text).preserved).toBe(true);
  });

  it("rejects output where a protected element was removed", () => {
    const { masked, tokens } = protectLatex(SAMPLE);
    const result = restoreLatex(masked.replace(tokens[0]!.placeholder, ""), tokens);
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(1);
  });

  it("rejects output where a protected element was duplicated", () => {
    const { masked, tokens } = protectLatex(SAMPLE);
    const result = restoreLatex(masked + " " + tokens[0]!.placeholder, tokens);
    expect(result.ok).toBe(false);
  });
});

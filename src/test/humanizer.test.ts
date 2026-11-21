import { describe, expect, it } from "vitest";
import { buildDiff, composeDiff, countHunks } from "@/lib/engines/diff";
import { numbersPreserved } from "@/lib/engines/text";
import { verifyLatexPreserved } from "@/lib/engines/latex";

const ORIGINAL = "So basically we got 95.2\\% accuracy \\cite{a} on 3 datasets, as in Eq.~\\eqref{eq:1}, which is really good.";
const IMPROVED = "Our method achieves 95.2\\% accuracy \\cite{a} on 3 datasets, as in Eq.~\\eqref{eq:1}, which is a notable result.";

describe("AI Humanizer change review", () => {
  it("accepting every change gives the improved text; rejecting every change gives the original", () => {
    const { parts } = buildDiff(ORIGINAL, IMPROVED);
    const ids = parts.flatMap((p) => (p.type === "change" ? [p.hunk.id] : []));
    expect(ids.length).toBeGreaterThan(0);
    expect(composeDiff(parts, new Set())).toBe(IMPROVED);
    expect(composeDiff(parts, new Set(ids))).toBe(ORIGINAL);
  });

  it("any mix of accepted and rejected changes keeps every LaTeX element", () => {
    const { parts, granular } = buildDiff(ORIGINAL, IMPROVED);
    expect(granular).toBe(true);
    const ids = parts.flatMap((p) => (p.type === "change" ? [p.hunk.id] : []));
    for (let mask = 0; mask < 1 << ids.length; mask++) {
      const rejected = new Set(ids.filter((_, i) => mask & (1 << i)));
      expect(verifyLatexPreserved(ORIGINAL, composeDiff(parts, rejected)).preserved).toBe(true);
    }
  });

  it("falls back to a single change when LaTeX elements were reordered", () => {
    const { parts, granular } = buildDiff("A \\cite{x} then $y$.", "Then $y$ and A \\cite{x}.");
    expect(granular).toBe(false);
    expect(countHunks(parts)).toBe(1);
  });

  it("detects changed, dropped or invented numbers", () => {
    expect(numbersPreserved(ORIGINAL, IMPROVED).ok).toBe(true);
    expect(numbersPreserved("accuracy of 95.2% on 3 sets", "accuracy of 95% on 3 sets").ok).toBe(false);
    expect(numbersPreserved("on 3 sets", "on 3 sets in 2024").ok).toBe(false);
  });
});

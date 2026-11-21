import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  grammarAiSchema,
  humanizerAiSchema,
  humanizerFocus,
  humanizerStyles,
  latexReviewAiSchema,
  type HumanizerResult,
  type LatexReviewResult,
  literatureAiSchema,
  pdfAiSchema,
  reviewerAiSchema,
  writingAiSchema,
  writingGoals,
  type GrammarResult,
  type LiteratureResult,
  type ModuleId,
  type PdfResult,
  type ReviewerResult,
  type WritingResult,
} from "./schemas";
import { overlapsProtected, protectLatex, restoreLatex, findLatexTokens } from "@/lib/engines/latex";
import { countWords, locateEdits, numbersPreserved, quoteAppearsIn } from "@/lib/engines/text";
import { buildDiff, countHunks } from "@/lib/engines/diff";
import { assertSource, sourceSchema } from "@/lib/uploads/rules";

type Ctx = { supabase: { from: (t: "research_activity") => any }; userId: string };

async function saveActivity(
  context: Ctx,
  row: { module: ModuleId; title: string; summary: string; issues_found?: number; improvements?: number; result?: unknown },
) {
  const { error } = await context.supabase.from("research_activity").insert({
    user_id: context.userId,
    module: row.module,
    title: row.title.slice(0, 200),
    summary: row.summary.slice(0, 500),
    issues_found: row.issues_found ?? 0,
    improvements: row.improvements ?? 0,
    result: row.result ?? null,
  });
  if (error) console.error("Failed to save activity", error.message);
}

const titleFrom = (text: string) => {
  const first = text.replace(/\\[a-zA-Z]+\*?(\{[^}]*\})?/g, "").trim().split(/\s+/).slice(0, 8).join(" ");
  return first ? `${first}…` : "Untitled text";
};

// ---------------------------------------------------------------- Grammar
export const checkGrammar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ text: z.string().trim().min(20).max(15000), source: sourceSchema.default({ kind: "paste" }) }))
  .handler(async ({ data, context }): Promise<GrammarResult> => {
    assertSource("grammar", data.source, data.text);
    const ai = await generateJsonLazy(
      grammarAiSchema,
      `Task: proofread academic text for grammar, spelling and punctuation errors (and clear style errors).
Return {"issues":[{"original": exact substring copied character-for-character from the text (short, 1-8 words, unique enough to locate), "suggestion": corrected replacement for that substring, "category": "grammar"|"spelling"|"punctuation"|"style", "explanation": one short sentence}]}.
List issues in order of appearance. Never edit LaTeX commands, math between $ signs, \\cite, \\ref or \\label. Keep technical terms. If there are no issues return {"issues":[]}.`,
      data.text,
    );
    const located = locateEdits(
      data.text,
      ai.issues.filter((i) => i.original !== i.suggestion),
    )
      .filter((i) => !overlapsProtected(data.text, i.start, i.end))
      .map((i, idx) => ({ ...i, id: `g${idx}` }));
    const result = { issues: located, protectedCount: findLatexTokens(data.text).length };
    await saveActivity(context as Ctx, {
      module: "grammar",
      title: titleFrom(data.text),
      summary: `${located.length} grammar, spelling or punctuation issue(s) found in ${countWords(data.text)} words.`,
      issues_found: located.length,
      improvements: located.length,
    });
    return result;
  });

// ---------------------------------------------------------------- Writing (with LaTeX Shield)
const GOAL_TEXT: Record<(typeof writingGoals)[number], string> = {
  formal: "Improve academic English and use a formal academic tone suitable for IEEE publications.",
  clarity: "Improve clarity and readability: simplify convoluted sentences, fix ambiguity, improve flow.",
  concise: "Make the text concise: remove redundancy and wordiness without losing information.",
  paraphrase: "Rewrite the sentences professionally in fresh wording while preserving the exact meaning.",
};

export const improveWriting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      text: z.string().trim().min(20).max(15000),
      goal: z.enum(writingGoals),
      module: z.enum(["writing", "latex"]).default("writing"),
      source: sourceSchema.default({ kind: "paste" }),
    }),
  )
  .handler(async ({ data, context }): Promise<WritingResult> => {
    assertSource(data.module, data.source, data.text);
    const { masked, tokens } = protectLatex(data.text);
    const task = `Task: ${GOAL_TEXT[data.goal]}
Maintain the technical meaning exactly. Do not add claims, numbers or references.
The text contains protected placeholders like ⟦L0⟧, ⟦L1⟧ that stand for LaTeX (equations, citations, references, commands).
Copy every placeholder into your output exactly once, unchanged, in a grammatically sensible position. Never remove, renumber, merge or invent placeholders.
Return {"improved": the full rewritten text, "changes": [{"before": short original phrase, "after": the replacement, "reason": short reason}] (max 12 most important), "notes": [up to 3 short readability observations]}.`;

    let restored: ReturnType<typeof restoreLatex> | null = null;
    let ai: Awaited<ReturnType<typeof generateJsonLazy<typeof writingAiSchema._output>>> | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      ai = await generateJsonLazy(writingAiSchema, task, masked);
      restored = restoreLatex(ai.improved, tokens);
      if (restored.ok) break;
    }
    if (!ai || !restored || !restored.ok) {
      throw new Error(
        "LaTeX Shield rejected the rewrite because a protected element was changed. Your text was not modified — please try again.",
      );
    }
    const changes = ai.changes.map((c) => ({
      before: restoreLatex(c.before, tokens).text,
      after: restoreLatex(c.after, tokens).text,
      reason: c.reason,
    }));
    await saveActivity(context as Ctx, {
      module: data.module,
      title: titleFrom(data.text),
      summary: `${changes.length} improvement(s) · goal: ${data.goal} · ${tokens.length} LaTeX element(s) protected.`,
      improvements: changes.length,
    });
    return {
      improved: restored.text,
      changes,
      notes: ai.notes,
      protectedCount: tokens.length,
      latexVerified: true,
    };
  });

// ---------------------------------------------------------------- PDF analysis
export const analyzePaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      fileName: z.string().min(1).max(200),
      pageCount: z.number().int().min(0).max(2000),
      text: z.string().trim().min(200).max(90000),
      source: sourceSchema,
    }),
  )
  .handler(async ({ data, context }): Promise<PdfResult> => {
    assertSource("pdf", data.source, data.text);
    const ai = await generateJsonLazy(
      pdfAiSchema,
      `Task: analyze the research paper text extracted from a PDF.
Return {"title", "abstract" (copy the abstract verbatim if present, else ""), "objectives", "methodology", "datasets", "results", "limitations", "summary"}.
Each list item is {"point": your concise description, "quote": a short supporting sentence copied verbatim from the text}.
Only include items supported by the text. For results, report numbers exactly as written. If a section has no support, return an empty list.
"summary": a structured 4-6 sentence summary of the paper using only stated information.`,
      data.text,
    );
    const verify = (items: { point: string; quote: string }[]) =>
      items.map((i) => ({ ...i, verified: quoteAppearsIn(data.text, i.quote) }));
    const result: PdfResult = {
      ...ai,
      abstractVerified: ai.abstract ? quoteAppearsIn(data.text, ai.abstract.slice(0, 200)) : false,
      objectives: verify(ai.objectives),
      methodology: verify(ai.methodology),
      datasets: verify(ai.datasets),
      results: verify(ai.results),
      limitations: verify(ai.limitations),
      fileName: data.fileName,
      pageCount: data.pageCount,
      wordCount: countWords(data.text),
    };
    await saveActivity(context as Ctx, {
      module: "pdf",
      title: ai.title || data.fileName,
      summary: ai.summary.slice(0, 400) || `Analyzed ${data.fileName}`,
      issues_found: result.limitations.length,
      result,
    });
    return result;
  });

// ---------------------------------------------------------------- Literature review
export const compareLiterature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      topic: z.string().trim().max(200).default(""),
      papers: z
        .array(
          z.object({
            title: z.string().trim().min(2).max(300),
            text: z.string().trim().min(100).max(30000),
            source: sourceSchema.default({ kind: "paste" }),
          }),
        )
        .min(2)
        .max(5),
    }),
  )
  .handler(async ({ data, context }): Promise<LiteratureResult> => {
    for (const p of data.papers) assertSource("literature", p.source, p.text);
    const sources = data.papers.map((p, i) => ({ id: `P${i + 1}`, title: p.title }));
    const input = data.papers
      .map((p, i) => `=== SOURCE P${i + 1}: ${p.title} ===\n${p.text}`)
      .join("\n\n");
    const ai = await generateJsonLazy(
      literatureAiSchema,
      `Task: compare the provided research papers${data.topic ? ` on the topic "${data.topic}"` : ""}.
Return {"papers": [{"id": "P1", "methodology", "datasets", "results", "limitations"}] (one per source, short phrases, numbers exactly as written),
"gaps": [{"gap": research gap, "sources": ["P1", ...] supporting ids}],
"draft": a structured literature review draft in Markdown with headings (Overview, Methodological Approaches, Datasets and Evaluation, Reported Results, Research Gaps). Every factual sentence must end with source markers like [P1] or [P2, P3]. Only use the given sources.}`,
      input,
    );
    const valid = new Set(sources.map((s) => s.id));
    const result: LiteratureResult = {
      papers: ai.papers.filter((p) => valid.has(p.id)),
      gaps: ai.gaps.map((g) => ({ ...g, sources: g.sources.filter((s) => valid.has(s)) })),
      draft: ai.draft,
      sources,
    };
    await saveActivity(context as Ctx, {
      module: "literature",
      title: data.topic || `Comparison of ${sources.length} papers`,
      summary: `Compared ${sources.length} papers · ${result.gaps.length} research gap(s) identified.`,
      issues_found: result.gaps.length,
      result,
    });
    return result;
  });

// ---------------------------------------------------------------- IEEE reviewer
export const reviewManuscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      title: z.string().trim().max(300).default(""),
      text: z.string().trim().min(300).max(60000),
      source: sourceSchema.default({ kind: "paste" }),
    }),
  )
  .handler(async ({ data, context }): Promise<ReviewerResult> => {
    assertSource("reviewer", data.source, data.text);
    const ai = await generateJsonLazy(
      reviewerAiSchema,
      `Task: act as a rigorous but constructive IEEE conference/journal reviewer for the manuscript.
Return {"sections": {"abstract","introduction","methodology","results","conclusion"} each {"present": boolean, "score": 0-10, "strengths": [], "weaknesses": [], "suggestions": []},
"unclear": [{"quote": exact sentence copied from the manuscript, "issue": why it is unclear}] (max 6),
"methodologicalWeaknesses": [string],
"overall": {"recommendation": "accept"|"minor_revision"|"major_revision"|"reject", "score": 0-10, "summary": 3-5 sentence reviewer summary, "keyActions": [prioritised revision actions]}}.
If a section is missing, set present=false, score=0 and explain in weaknesses. Be specific and reference the manuscript content.`,
      data.text,
    );
    const result: ReviewerResult = {
      ...ai,
      unclear: ai.unclear.map((u) => ({ ...u, verified: quoteAppearsIn(data.text, u.quote) })),
    };
    await saveActivity(context as Ctx, {
      module: "reviewer",
      title: data.title || titleFrom(data.text),
      summary: `Recommendation: ${ai.overall.recommendation.replace("_", " ")} · score ${ai.overall.score}/10.`,
      issues_found: ai.methodologicalWeaknesses.length + ai.unclear.length,
      result,
    });
    return result;
  });

// ---------------------------------------------------------------- Citation report logging
export const logCitationCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      title: z.string().max(200),
      cited: z.number().int().min(0),
      entries: z.number().int().min(0),
      issues: z.number().int().min(0),
      missing: z.number().int().min(0),
      unused: z.number().int().min(0),
    }),
  )
  .handler(async ({ data, context }) => {
    await saveActivity(context as Ctx, {
      module: "citations",
      title: data.title || "Citation check",
      summary: `${data.cited} cited key(s), ${data.entries} BibTeX entr${data.entries === 1 ? "y" : "ies"} · ${data.missing} missing, ${data.unused} unused.`,
      issues_found: data.issues,
    });
    return { ok: true };
  });

// ---------------------------------------------------------------- AI Humanizer (LaTeX Shield + number check)
const STYLE_TEXT: Record<(typeof humanizerStyles)[number], string> = {
  natural: "Write in natural, fluent academic English as an experienced researcher would: varied sentence length, precise verbs, no filler or hype.",
  ieee: "Write in professional IEEE style: formal, objective, concise, third person or 'we' as in the original, standard IEEE terminology.",
};
const FOCUS_TEXT: Record<(typeof humanizerFocus)[number], string> = {
  clarity: "Improve clarity and readability; resolve ambiguity.",
  flow: "Improve sentence flow and transitions between sentences.",
  repetition: "Reduce unnecessary repetition of words and phrases.",
};

export const humanizeText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      text: z.string().trim().min(20).max(15000),
      style: z.enum(humanizerStyles),
      focus: z.array(z.enum(humanizerFocus)).max(3).default([]),
      source: sourceSchema.default({ kind: "paste" }),
    }),
  )
  .handler(async ({ data, context }): Promise<HumanizerResult> => {
    assertSource("humanizer", data.source, data.text);
    const { masked, tokens } = protectLatex(data.text);
    const task = `Task: refine the academic text so it reads naturally and professionally.
Style: ${STYLE_TEXT[data.style]}
${data.focus.map((f) => `- ${FOCUS_TEXT[f]}`).join("\n")}
Strict rules:
- Preserve the technical meaning exactly. Do not add or remove claims, results, methods, datasets or references.
- Keep every number, unit, percentage and value exactly as written (digits stay digits).
- Keep technical terms, acronyms and proper names unchanged.
- Keep paragraph breaks.
- The text contains protected placeholders like ⟦L0⟧, ⟦L1⟧ that stand for LaTeX (equations, citations, references, commands, tables). Copy every placeholder exactly once, unchanged, in the SAME ORDER as the input. Never remove, renumber, merge or invent placeholders.
Return {"improved": the full refined text, "notes": [up to 3 short observations about what was improved]}.`;

    let failure = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const ai = await generateJsonLazy(humanizerAiSchema, task, masked);
      const restored = restoreLatex(ai.improved, tokens);
      if (!restored.ok) {
        failure = "LaTeX Shield rejected the rewrite because a protected element (equation, citation, reference or command) was changed.";
        continue;
      }
      const nums = numbersPreserved(masked, ai.improved);
      if (!nums.ok) {
        failure = `The rewrite changed numerical values (${[...nums.missing, ...nums.added].slice(0, 4).join(", ")}), so it was rejected.`;
        continue;
      }
      const changeCount = countHunks(buildDiff(data.text, restored.text).parts);
      await saveActivity(context as Ctx, {
        module: "humanizer",
        title: titleFrom(data.text),
        summary: `${changeCount} change(s) · style: ${data.style === "ieee" ? "IEEE" : "natural academic"} · ${tokens.length} LaTeX element(s) and ${nums.total} number(s) preserved.`,
        improvements: changeCount,
      });
      return { improved: restored.text, notes: ai.notes, protectedCount: tokens.length, numbersChecked: nums.total, changeCount };
    }
    throw new Error(`${failure} Your text was not modified — please try again.`);
  });

// ---------------------------------------------------------------- LaTeX Code Improver (AI review, advice only)
export const reviewLatexCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({
      text: z.string().min(20).max(60000),
      source: sourceSchema.default({ kind: "paste" }),
      localFindings: z.number().int().min(0).max(10000),
      fixable: z.number().int().min(0).max(10000),
      fileName: z.string().max(255).default(""),
    }),
  )
  .handler(async ({ data, context }): Promise<LatexReviewResult> => {
    assertSource("latexcode", data.source, data.text);
    const ai = await generateJsonLazy(
      latexReviewAiSchema,
      `Task: review the LaTeX source code quality for an IEEE submission (IEEEtran). Focus on code, not on the scientific content.
Look for: document structure, float placement and sizing, table formatting (e.g. booktabs, vertical rules), math markup (e.g. \\text in math, operators), reference/label conventions, package usage and conflicts, inconsistent notation or macros.
Return {"summary": 2-3 sentence assessment, "suggestions": [{"snippet": a short piece of code copied EXACTLY from the source (max 120 chars), "issue": what is wrong, "recommendation": how to fix it, "category": "structure"|"formatting"|"floats"|"math"|"references"|"packages"|"consistency"}] (max 10, most important first)}.
Do not comment on spelling of prose. Do not invent packages or commands that are not in the source.`,
      data.text,
    );
    const result: LatexReviewResult = {
      summary: ai.summary,
      suggestions: ai.suggestions.map((s) => ({ ...s, verified: s.snippet.trim().length > 0 && data.text.includes(s.snippet.trim()) })),
    };
    await saveActivity(context as Ctx, {
      module: "latexcode",
      title: data.fileName || titleFrom(data.text),
      summary: `${data.localFindings} code issue(s) found locally (${data.fixable} auto-fixable) · ${result.suggestions.length} AI suggestion(s).`,
      issues_found: data.localFindings + result.suggestions.length,
      improvements: data.fixable,
      result,
    });
    return result;
  });

/** Loads the gateway module only on the server, inside handlers. */
async function generateJsonLazy<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, task: string, input: string) {
  const { generateJson } = await import("./gateway.server");
  return generateJson(schema, task, input);
}

import { z } from "zod";

export const MODULES = {
  grammar: "Grammar Checker",
  writing: "Writing Assistant",
  humanizer: "AI Humanizer",
  latex: "LaTeX Shield",
  latexcode: "LaTeX Code Improver",
  pdf: "PDF Analyzer",
  citations: "Citation Checker",
  literature: "Literature Review",
  reviewer: "IEEE Reviewer",
} as const;
export type ModuleId = keyof typeof MODULES;

// ---------- Grammar ----------
export const grammarIssueSchema = z.object({
  original: z.string(),
  suggestion: z.string(),
  category: z.enum(["grammar", "spelling", "punctuation", "style"]).catch("grammar"),
  explanation: z.string().default(""),
});
export const grammarAiSchema = z.object({ issues: z.array(grammarIssueSchema).default([]) });
export type GrammarIssue = z.infer<typeof grammarIssueSchema> & { id: string; start: number; end: number };
export interface GrammarResult {
  issues: GrammarIssue[];
  protectedCount: number;
}

// ---------- Writing ----------
export const writingGoals = ["formal", "clarity", "concise", "paraphrase"] as const;
export type WritingGoal = (typeof writingGoals)[number];
export const writingAiSchema = z.object({
  improved: z.string(),
  changes: z
    .array(z.object({ before: z.string(), after: z.string(), reason: z.string() }))
    .default([]),
  notes: z.array(z.string()).default([]),
});
export interface WritingResult {
  improved: string;
  changes: { before: string; after: string; reason: string }[];
  notes: string[];
  protectedCount: number;
  latexVerified: boolean;
}

// ---------- Humanizer ----------
export const humanizerStyles = ["natural", "ieee"] as const;
export type HumanizerStyle = (typeof humanizerStyles)[number];
export const humanizerFocus = ["clarity", "flow", "repetition"] as const;
export type HumanizerFocus = (typeof humanizerFocus)[number];
export const humanizerAiSchema = z.object({
  improved: z.string(),
  notes: z.array(z.string()).default([]),
});
export interface HumanizerResult {
  improved: string;
  notes: string[];
  protectedCount: number;
  numbersChecked: number;
  changeCount: number;
}

// ---------- LaTeX code review ----------
export const latexReviewAiSchema = z.object({
  summary: z.string().default(""),
  suggestions: z
    .array(
      z.object({
        snippet: z.string().default(""),
        issue: z.string(),
        recommendation: z.string(),
        category: z.enum(["structure", "formatting", "floats", "math", "references", "packages", "consistency"]).catch("formatting"),
      }),
    )
    .default([]),
});
export interface LatexReviewResult {
  summary: string;
  suggestions: (z.infer<typeof latexReviewAiSchema>["suggestions"][number] & { verified: boolean })[];
}

// ---------- PDF ----------
const evidenceItem = z.object({ point: z.string(), quote: z.string().default("") });
export const pdfAiSchema = z.object({
  title: z.string().default(""),
  abstract: z.string().default(""),
  objectives: z.array(evidenceItem).default([]),
  methodology: z.array(evidenceItem).default([]),
  datasets: z.array(evidenceItem).default([]),
  results: z.array(evidenceItem).default([]),
  limitations: z.array(evidenceItem).default([]),
  summary: z.string().default(""),
});
export type EvidenceItem = z.infer<typeof evidenceItem> & { verified: boolean };
export interface PdfResult {
  title: string;
  abstract: string;
  abstractVerified: boolean;
  objectives: EvidenceItem[];
  methodology: EvidenceItem[];
  datasets: EvidenceItem[];
  results: EvidenceItem[];
  limitations: EvidenceItem[];
  summary: string;
  fileName: string;
  pageCount: number;
  wordCount: number;
}

// ---------- Literature ----------
export const literatureAiSchema = z.object({
  papers: z
    .array(
      z.object({
        id: z.string(),
        methodology: z.string().default("Not stated"),
        datasets: z.string().default("Not stated"),
        results: z.string().default("Not stated"),
        limitations: z.string().default("Not stated"),
      }),
    )
    .default([]),
  gaps: z.array(z.object({ gap: z.string(), sources: z.array(z.string()).default([]) })).default([]),
  draft: z.string().default(""),
});
export type LiteratureResult = z.infer<typeof literatureAiSchema> & {
  sources: { id: string; title: string }[];
};

// ---------- Reviewer ----------
const sectionReview = z.object({
  present: z.boolean().default(true),
  score: z.number().min(0).max(10).catch(5),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
});
export const reviewerAiSchema = z.object({
  sections: z.object({
    abstract: sectionReview,
    introduction: sectionReview,
    methodology: sectionReview,
    results: sectionReview,
    conclusion: sectionReview,
  }),
  unclear: z.array(z.object({ quote: z.string(), issue: z.string() })).default([]),
  methodologicalWeaknesses: z.array(z.string()).default([]),
  overall: z.object({
    recommendation: z
      .enum(["accept", "minor_revision", "major_revision", "reject"])
      .catch("major_revision"),
    score: z.number().min(0).max(10).catch(5),
    summary: z.string().default(""),
    keyActions: z.array(z.string()).default([]),
  }),
});
export type ReviewerResult = Omit<z.infer<typeof reviewerAiSchema>, "unclear"> & {
  unclear: { quote: string; issue: string; verified: boolean }[];
};
export type SectionKey = keyof ReviewerResult["sections"];

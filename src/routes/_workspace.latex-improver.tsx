import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileCode2,
  Loader2,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { reviewLatexCode } from "@/lib/ai/research.functions";

import {
  applyLintFixes,
  contentPreserved,
  lintLatex,
  type LintFinding,
} from "@/lib/engines/latex-lint";

import {
  PASTED,
  type UploadSource,
} from "@/lib/uploads/rules";

import { UploadButton } from "@/components/shared/UploadButton";

import {
  downloadText,
  resultFileName,
  type VerifiedFile,
} from "@/hooks/use-upload";

export const Route = createFileRoute("/_workspace/latex-improver")({
  component: LatexImproverPage,
});

function LatexImproverPage() {
  const review = useServerFn(reviewLatexCode);

  // Editor state
  const [text, setText] = useState("");
  const [source, setSource] = useState<UploadSource>(PASTED);
  const [fileName, setFileName] = useState("");

  // Analysis state
  const [selectedFixes, setSelectedFixes] = useState<Set<string>>(
    new Set(),
  );

  const [aiResult, setAiResult] = useState<
    Awaited<ReturnType<typeof review>> | null
  >(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Run local LaTeX analysis whenever source changes.
  const findings = useMemo(() => lintLatex(text), [text]);

  const fixableFindings = findings.filter(
    (finding) => finding.fix !== undefined,
  );

  const issueCount = findings.length;
  const fixCount = fixableFindings.length;

  // Handle editor changes.
  function handleTextChange(value: string) {
    setText(value);
    setSource(PASTED);
    setFileName("");
    setAiResult(null);
    setSelectedFixes(new Set());
    setError("");
    setSuccess("");
  }

  // Handle verified uploads.
  function handleUpload(files: VerifiedFile[]) {
    const uploaded = files[0];

    if (!uploaded) return;

    setText(uploaded.text);
    setSource(uploaded.source);
    setFileName(uploaded.file.name);

    setSelectedFixes(new Set());
    setAiResult(null);
    setError("");
    setSuccess("");
  }

  // Select or deselect individual fixes.
  function toggleFix(id: string) {
    setSelectedFixes((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function selectAllFixes() {
    setSelectedFixes(
      new Set(fixableFindings.map((finding) => finding.id)),
    );
  }

  function clearSelection() {
    setSelectedFixes(new Set());
  }

  // Apply selected automatic fixes safely.
  function applySelectedFixes() {
    if (selectedFixes.size === 0) {
      setError("Select at least one automatic fix.");
      return;
    }

    const updated = applyLintFixes(
      text,
      findings,
      selectedFixes,
    );

    // Verify important document content.
    if (!contentPreserved(text, updated)) {
      setError(
        "Content preservation verification failed. Your original source has not been modified.",
      );
      return;
    }

    setText(updated);
    setSelectedFixes(new Set());
    setAiResult(null);
    setError("");

    setSuccess(
      "Selected fixes applied successfully. Important document content was preserved.",
    );
  }

  // Run AI-powered review.
  async function runAiReview() {
    if (text.trim().length < 20) {
      setError("Enter at least 20 characters of LaTeX source.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setAiResult(null);

    try {
      const result = await review({
        data: {
          text,
          source,
          localFindings: findings.length,
          fixable: fixCount,
          fileName,
        },
      });

      setAiResult(result);
      setSuccess("AI review completed successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete AI review.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Download current source.
  function downloadImprovedFile() {
    if (!text.trim()) return;

    downloadText(
      text,
      resultFileName(source, "improved"),
    );
  }

  // Reset the complete workspace.
  function resetEditor() {
    setText("");
    setSource(PASTED);
    setFileName("");
    setAiResult(null);
    setSelectedFixes(new Set());
    setError("");
    setSuccess("");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">

      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <FileCode2 className="h-7 w-7 text-primary" />

            <h1 className="text-2xl font-bold tracking-tight">
              LaTeX Code Improver
            </h1>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            Analyze, improve and review your LaTeX source code safely.
          </p>
        </div>

        <button
          onClick={resetEditor}
          className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-muted"
        >
          <RefreshCw className="h-4 w-4" />
          Reset
        </button>
      </div>

      {/* STATISTICS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Issues"
          value={issueCount}
          description="Detected by local analysis"
        />

        <StatCard
          title="Auto-fixable"
          value={fixCount}
          description="Safe fixes available"
        />

        <StatCard
          title="AI Suggestions"
          value={aiResult?.suggestions.length ?? 0}
          description="AI review recommendations"
        />
      </div>

      {/* FILE UPLOAD */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-2 font-semibold">
          Upload LaTeX Source
        </h2>

        <p className="mb-4 text-sm text-muted-foreground">
          Upload a .tex file or paste your LaTeX source code below.
        </p>

        <UploadButton
          module="latexcode"
          label="Upload .tex File"
          onFiles={handleUpload}
          onError={(message) => setError(message ?? "")}
        />

        {fileName && (
          <p className="mt-3 text-sm text-green-600">
            Loaded: {fileName}
          </p>
        )}
      </section>

      {/* LATEX EDITOR */}
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">
            LaTeX Source Editor
          </h2>

          <span className="text-xs text-muted-foreground">
            {text.length.toLocaleString()} characters
          </span>
        </div>

        <textarea
          value={text}
          onChange={(event) =>
            handleTextChange(event.target.value)
          }
          placeholder={`\\documentclass{article}

\\begin{document}

\\section{Introduction}

Hello LaTeX!

\\end{document}`}
          spellCheck={false}
          className="min-h-[380px] w-full resize-y rounded-lg border bg-background p-4 font-mono text-sm leading-6 outline-none focus:ring-2 focus:ring-primary"
        />

        <div className="flex flex-wrap gap-3">
          <button
            onClick={runAiReview}
            disabled={loading || text.trim().length < 20}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}

            {loading ? "Reviewing..." : "Analyze with AI"}
          </button>

          <button
            onClick={downloadImprovedFile}
            disabled={!text.trim()}
            className="inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download .tex
          </button>
        </div>
      </section>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* SUCCESS MESSAGE */}
      {success && (
        <div className="flex items-start gap-3 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-700 dark:bg-green-950/20 dark:text-green-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* LOCAL ANALYSIS */}
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              Local Code Analysis
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Detect common LaTeX source-code issues.
            </p>
          </div>

          <span className="rounded-full bg-muted px-3 py-1 text-sm">
            {issueCount} issues
          </span>
        </div>

        {issueCount === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-green-500" />

            <p className="font-medium">
              No local issues detected
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Enter LaTeX source code to begin analysis.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={selectAllFixes}
                disabled={fixCount === 0}
                className="rounded-md border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50"
              >
                Select all safe fixes
              </button>

              <button
                onClick={clearSelection}
                className="rounded-md border px-3 py-2 text-xs hover:bg-muted"
              >
                Clear selection
              </button>

              <button
                onClick={applySelectedFixes}
                disabled={selectedFixes.size === 0}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50"
              >
                <WandSparkles className="h-4 w-4" />
                Apply {selectedFixes.size} Fixes
              </button>
            </div>

            <div className="space-y-3">
              {findings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  checked={selectedFixes.has(finding.id)}
                  onToggle={() => toggleFix(finding.id)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* AI REVIEW RESULTS */}
      {aiResult && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />

            <h2 className="font-semibold">
              AI Code Review
            </h2>
          </div>

          {/* SUMMARY */}
          <div className="rounded-lg bg-muted/50 p-4">
            <h3 className="mb-2 text-sm font-semibold">
              Overall Assessment
            </h3>

            <p className="text-sm leading-6">
              {aiResult.summary}
            </p>
          </div>

          {/* SUGGESTIONS */}
          {aiResult.suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No additional AI suggestions were generated.
            </p>
          ) : (
            <div className="space-y-3">
              {aiResult.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="space-y-3 rounded-lg border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-md bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">
                      {suggestion.category}
                    </span>

                    <span
                      className={`text-xs ${
                        suggestion.verified
                          ? "text-green-600"
                          : "text-amber-600"
                      }`}
                    >
                      {suggestion.verified
                        ? "✓ Source snippet verified"
                        : "⚠ Source snippet not verified"}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold">
                      Issue
                    </h3>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {suggestion.issue}
                    </p>
                  </div>

                  {suggestion.snippet && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">
                        Original Code
                      </h3>

                      <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                        <code>{suggestion.snippet}</code>
                      </pre>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold">
                      Recommendation
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {suggestion.recommendation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            AI suggestions are advisory. Review recommendations
            before manually changing your LaTeX source.
          </p>
        </section>
      )}
    </div>
  );
}

// STATISTICS CARD
function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">
        {title}
      </p>

      <p className="my-2 text-3xl font-bold">
        {value}
      </p>

      <p className="text-xs text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

// INDIVIDUAL LINT FINDING
function FindingCard({
  finding,
  checked,
  onToggle,
}: {
  finding: LintFinding;
  checked: boolean;
  onToggle: () => void;
}) {
  const severityClass = {
    fix: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    warning:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start gap-3">
        {finding.fix !== undefined && (
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="mt-1 h-4 w-4"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">
              {finding.title}
            </h3>

            <span
              className={`rounded-md px-2 py-1 text-xs ${severityClass[finding.severity]}`}
            >
              {finding.severity}
            </span>

            <span className="text-xs text-muted-foreground">
              Line {finding.line}
            </span>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            {finding.message}
          </p>

          {finding.original && (
            <pre className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-xs">
              <code>{finding.original}</code>
            </pre>
          )}

          {finding.fix === undefined && (
            <p className="mt-2 text-xs text-amber-600">
              Manual review required.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
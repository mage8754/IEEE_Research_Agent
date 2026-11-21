import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { EngineNotice } from "@/components/shared/EngineNotice";
import { TextEditor, CopyButton } from "@/components/shared/TextEditor";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/shared/States";
import { GoalPicker } from "@/components/shared/GoalPicker";
import { KIND_LABEL, KIND_STYLE, LatexHighlight } from "@/components/shared/LatexHighlight";
import { improveWriting } from "@/lib/ai/research.functions";
import type { WritingGoal, WritingResult } from "@/lib/ai/schemas";
import { findLatexTokens, summarizeTokens, verifyLatexPreserved, type LatexKind } from "@/lib/engines/latex";
import { LATEX_SAMPLE } from "@/lib/samples";
import { useAiTask } from "@/hooks/use-ai-task";
import { UploadButton } from "@/components/shared/UploadButton";
import { checkPastedText, PASTED, type UploadSource } from "@/lib/uploads/rules";
import { downloadText, resultFileName } from "@/hooks/use-upload";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workspace/latex-shield")({
  head: () => ({
    meta: [
      { title: "LaTeX Shield — IEEE Research Agent" },
      { name: "description", content: "Rewrite LaTeX manuscripts safely: equations, citations and references are protected and never modified." },
      { property: "og:title", content: "LaTeX Shield — IEEE Research Agent" },
      { property: "og:description", content: "AI rewriting that never touches your LaTeX syntax." },
    ],
  }),
  component: LatexPage,
});

function LatexPage() {
  const [text, setText] = useState("");
  const [goal, setGoal] = useState<WritingGoal>("formal");
  const [original, setOriginal] = useState("");
  const [result, setResult] = useState<WritingResult | null>(null);
  const [source, setSource] = useState<UploadSource>(PASTED);
  const run = useServerFn(improveWriting);
  const task = useAiTask((v: { text: string; goal: WritingGoal }) => run({ data: { ...v, module: "latex", source } }), "Safe rewrite complete");

  const tokens = useMemo(() => findLatexTokens(text), [text]);
  const counts = summarizeTokens(tokens);
  const verification = result ? verifyLatexPreserved(original, result.improved) : null;
  const notLatex = source.kind === "paste" && text.trim().length >= 20 ? checkPastedText("latex", text) : null;
  const invalid = text.trim().length < 20 || text.length > 15000 || !!notLatex;

  const submit = () => {
    if (invalid) return;
    const snapshot = text;
    task.mutate({ text: snapshot, goal }, { onSuccess: (r) => { setResult(r); setOriginal(snapshot); } });
  };

  return (
    <>
      <PageHeader icon={ShieldCheck} title="LaTeX Shield" description="Protect LaTeX commands, equations, citations and references while rewriting the prose around them." />
      <EngineNotice engine="hybrid">
        Detection runs locally in your browser. During rewriting, protected elements are replaced by locked placeholders; any AI output that changes them is rejected.
      </EngineNotice>

      <div className="grid gap-6 xl:grid-cols-2">
        <TextEditor label="LaTeX source" value={text} onChange={setText} sample={LATEX_SAMPLE} onReset={() => setSource(PASTED)} error={notLatex} hint={source.kind === "tex" ? `Loaded from ${source.fileName}` : "Upload a .tex file or paste LaTeX source"} actions={<UploadButton module="latex" maxChars={15000} disabled={task.isPending} onFiles={([f]) => { if (f) { setText(f.text); setSource(f.source); setResult(null); } }} />} mono rows={14} minLength={20} disabled={task.isPending} placeholder="Paste LaTeX source, e.g. a paragraph with \cite{…}, $math$ and equations…" />
        <Panel title="Protected elements" description={`${tokens.length} element${tokens.length === 1 ? "" : "s"} detected · live preview`}>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {(Object.keys(counts) as LatexKind[]).map((k) => (
              <div key={k} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn("size-2.5 rounded-sm", KIND_STYLE[k])} />
                  {KIND_LABEL[k]}
                </span>
                <span className="font-display text-lg font-semibold text-foreground">{counts[k]}</span>
              </div>
            ))}
          </div>
          {text ? (
            <div className="max-h-72 overflow-auto rounded-lg border bg-muted/20 p-3">
              <LatexHighlight text={text} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Protected elements will be highlighted here as you type.</p>
          )}
        </Panel>
      </div>

      <div className="space-y-3">
        <GoalPicker value={goal} onChange={setGoal} disabled={task.isPending} />
        <Button variant="premium" size="lg" onClick={submit} disabled={task.isPending || invalid}>
          {task.isPending ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          {task.isPending ? "Rewriting safely…" : "Rewrite safely"}
        </Button>
        {task.error && <ErrorState message={task.error.message} onRetry={submit} />}
      </div>

      {task.isPending ? (
        <LoadingState title="Rewriting with LaTeX Shield" steps={[`Locking ${tokens.length} protected elements`, "Rewriting prose with Gemini", "Verifying every element is unchanged"]} />
      ) : result && verification ? (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] animate-fade-up">
          <Panel title="Rewritten LaTeX" actions={<div className="flex gap-2"><CopyButton text={result.improved} label="Copy LaTeX" /><Button size="sm" variant="outline" onClick={() => downloadText(result.improved, resultFileName(source.kind === "tex" ? source : { kind: "tex", fileName: "rewritten.tex" }, "shielded"))}><Download />Download .tex</Button></div>}>
            <div className="max-h-96 overflow-auto rounded-lg border bg-muted/20 p-3">
              <LatexHighlight text={result.improved} />
            </div>
            <Button className="mt-4" variant="navy" onClick={() => { setText(result.improved); setResult(null); }}>Use rewritten text</Button>
          </Panel>
          <Panel title="Verification report">
            <div className={cn("flex items-start gap-3 rounded-lg p-3", verification.preserved ? "bg-success/10" : "bg-destructive/10")}>
              {verification.preserved ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <ShieldAlert className="size-5 shrink-0 text-destructive" />}
              <div className="text-sm">
                <p className="font-semibold text-foreground">
                  {verification.preserved ? `All ${verification.total} protected elements preserved` : `${verification.missing.length} element(s) changed`}
                </p>
                <p className="text-muted-foreground">Checked character-for-character in your browser after rewriting.</p>
              </div>
            </div>
            {result.changes.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm">
                {result.changes.slice(0, 6).map((c, i) => (
                  <li key={i} className="rounded-lg border p-2.5">
                    <span className="text-muted-foreground line-through">{c.before}</span> → <span className="font-medium">{c.after}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : (
        <EmptyState icon={ShieldCheck} title="Ready to rewrite safely" description="Paste LaTeX source, pick a goal and press “Rewrite safely”. You'll get a verification report for every protected element." />
      )}
    </>
  );
}

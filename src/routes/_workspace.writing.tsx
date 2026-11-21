import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, PenLine, ShieldCheck, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { EngineNotice } from "@/components/shared/EngineNotice";
import { TextEditor, CopyButton } from "@/components/shared/TextEditor";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/shared/States";
import { GoalPicker } from "@/components/shared/GoalPicker";
import { improveWriting } from "@/lib/ai/research.functions";
import type { WritingGoal, WritingResult } from "@/lib/ai/schemas";
import { WRITING_SAMPLE } from "@/lib/samples";
import { useAiTask } from "@/hooks/use-ai-task";
import { UploadButton } from "@/components/shared/UploadButton";
import { PASTED, type UploadSource } from "@/lib/uploads/rules";

export const Route = createFileRoute("/_workspace/writing")({
  head: () => ({
    meta: [
      { title: "Academic Writing Assistant — IEEE Research Agent" },
      { name: "description", content: "Improve academic English, clarity and formal tone while preserving technical meaning." },
      { property: "og:title", content: "Academic Writing Assistant — IEEE Research Agent" },
      { property: "og:description", content: "Rewrite research text in formal academic English with AI." },
    ],
  }),
  component: WritingPage,
});

function WritingPage() {
  const [text, setText] = useState("");
  const [goal, setGoal] = useState<WritingGoal>("formal");
  const [original, setOriginal] = useState("");
  const [result, setResult] = useState<WritingResult | null>(null);
  const [source, setSource] = useState<UploadSource>(PASTED);
  const run = useServerFn(improveWriting);
  const task = useAiTask((v: { text: string; goal: WritingGoal }) => run({ data: { ...v, module: "writing", source } }), "Text improved");

  const invalid = text.trim().length < 20 || text.length > 15000;
  const submit = () => {
    if (invalid) return;
    const snapshot = text;
    task.mutate({ text: snapshot, goal }, { onSuccess: (r) => { setResult(r); setOriginal(snapshot); } });
  };

  return (
    <>
      <PageHeader icon={PenLine} title="Academic Writing Assistant" description="Improve academic English, clarity and readability in a formal tone — without changing your technical meaning." />
      <EngineNotice engine="hybrid">
        Gemini rewrites your text. LaTeX Shield hides equations, citations and references from the AI and rejects any result that alters them.
      </EngineNotice>

      <GoalPicker value={goal} onChange={setGoal} disabled={task.isPending} />

      <div className="space-y-3">
        <TextEditor label="Original text" value={text} onChange={setText} sample={WRITING_SAMPLE} onReset={() => setSource(PASTED)} hint={source.kind === "tex" ? `Loaded from ${source.fileName}` : "Paste text or upload a .tex file"} actions={<UploadButton module="writing" maxChars={15000} disabled={task.isPending} onFiles={([f]) => { if (f) { setText(f.text); setSource(f.source); setResult(null); } }} />} minLength={20} rows={9} disabled={task.isPending} placeholder="Paste the text you want to improve…" />
        <Button variant="premium" size="lg" onClick={submit} disabled={task.isPending || invalid}>
          {task.isPending ? <Loader2 className="animate-spin" /> : <Wand2 />}
          {task.isPending ? "Improving…" : "Improve writing"}
        </Button>
        {task.error && <ErrorState message={task.error.message} onRetry={submit} />}
      </div>

      {task.isPending ? (
        <LoadingState title="Improving your text" steps={["Shielding LaTeX elements", "Rewriting with Gemini", "Verifying protected syntax"]} />
      ) : result ? (
        <ResultView original={original} result={result} onUse={() => { setText(result.improved); setResult(null); }} />
      ) : (
        <EmptyState icon={Wand2} title="Your improved text will appear here" description="Choose a goal, paste your text and press “Improve writing” to compare original and improved versions." />
      )}
    </>
  );
}

export function ResultView({ original, result, onUse }: { original: string; result: WritingResult; onUse: () => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] animate-fade-up">
      <Panel
        title="Original vs improved"
        actions={
          result.protectedCount > 0 && (
            <Badge variant="success"><ShieldCheck className="mr-1 size-3" />{result.protectedCount} LaTeX elements preserved</Badge>
          )
        }
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Original</p>
            <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">{original}</div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-primary">Improved</p>
            <div className="whitespace-pre-wrap rounded-lg border border-primary/25 bg-accent/30 p-3 text-sm leading-relaxed">{result.improved}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="navy" onClick={onUse}>Use improved text</Button>
          <CopyButton text={result.improved} label="Copy improved" size="default" />
        </div>
      </Panel>
      <Panel title="What changed" description={`${result.changes.length} key edit${result.changes.length === 1 ? "" : "s"}`}>
        {result.changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No individual changes were reported.</p>
        ) : (
          <ul className="max-h-[420px] space-y-3 overflow-auto pr-1">
            {result.changes.map((c, i) => (
              <li key={i} className="rounded-lg border p-3 text-sm">
                <p><span className="rounded bg-mark-error px-1 line-through decoration-destructive/50">{c.before}</span></p>
                <p className="mt-1"><span className="rounded bg-mark-fix px-1">{c.after}</span></p>
                <p className="mt-1.5 text-xs text-muted-foreground">{c.reason}</p>
              </li>
            ))}
          </ul>
        )}
        {result.notes.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Readability notes</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-foreground/85">
              {result.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}
      </Panel>
    </div>
  );
}

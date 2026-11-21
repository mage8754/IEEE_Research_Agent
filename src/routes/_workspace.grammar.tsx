import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Check, CheckCheck, Loader2, SpellCheck, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { EngineNotice } from "@/components/shared/EngineNotice";
import { TextEditor, CopyButton } from "@/components/shared/TextEditor";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/shared/States";
import { checkGrammar } from "@/lib/ai/research.functions";
import type { GrammarIssue, GrammarResult } from "@/lib/ai/schemas";
import { applyEdits } from "@/lib/engines/text";
import { GRAMMAR_SAMPLE } from "@/lib/samples";
import { useAiTask } from "@/hooks/use-ai-task";
import { UploadButton } from "@/components/shared/UploadButton";
import { PASTED, type UploadSource } from "@/lib/uploads/rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workspace/grammar")({
  head: () => ({
    meta: [
      { title: "Grammar Checker — IEEE Research Agent" },
      { name: "description", content: "Check grammar, spelling and punctuation in academic text, with accept/reject corrections." },
      { property: "og:title", content: "Grammar Checker — IEEE Research Agent" },
      { property: "og:description", content: "AI grammar, spelling and punctuation checks for research papers." },
    ],
  }),
  component: GrammarPage,
});

type Decision = "accepted" | "rejected" | undefined;

const CATEGORY_STYLE: Record<GrammarIssue["category"], string> = {
  grammar: "decoration-destructive",
  spelling: "decoration-warning",
  punctuation: "decoration-primary",
  style: "decoration-success",
};

function GrammarPage() {
  const [text, setText] = useState("");
  const [checkedText, setCheckedText] = useState("");
  const [result, setResult] = useState<GrammarResult | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [active, setActive] = useState<string | null>(null);
  const [source, setSource] = useState<UploadSource>(PASTED);
  const run = useServerFn(checkGrammar);
  const task = useAiTask((t: string) => run({ data: { text: t, source } }));

  const tooShort = text.trim().length < 20;
  const tooLong = text.length > 15000;

  const submit = () => {
    if (tooShort || tooLong) return;
    const snapshot = text;
    task.mutate(snapshot, {
      onSuccess: (r) => {
        setResult(r);
        setCheckedText(snapshot);
        setDecisions({});
      },
    });
  };

  const accepted = useMemo(() => (result?.issues ?? []).filter((i) => decisions[i.id] === "accepted"), [result, decisions]);
  const corrected = useMemo(() => (result ? applyEdits(checkedText, accepted) : ""), [result, checkedText, accepted]);
  const pending = (result?.issues ?? []).filter((i) => !decisions[i.id]).length;
  const counts = (result?.issues ?? []).reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.category]: (acc[i.category] ?? 0) + 1 }), {});

  const setAll = (d: Decision) => setDecisions(Object.fromEntries((result?.issues ?? []).map((i) => [i.id, d])));

  return (
    <>
      <PageHeader
        icon={SpellCheck}
        title="Grammar & Language Checker"
        description="Find grammar, spelling and punctuation errors in academic text. Review each correction and accept or reject it."
      />
      <EngineNotice engine="hybrid">
        Gemini proposes corrections; only edits found word-for-word in your text are shown, and LaTeX commands, math and citations are never flagged.
      </EngineNotice>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <TextEditor
            label="Your text"
            value={text}
            onChange={setText}
            sample={GRAMMAR_SAMPLE}
            onReset={() => setSource(PASTED)}
            hint={source.kind === "tex" ? `Loaded from ${source.fileName}` : "Paste text or upload a .tex file"}
            actions={<UploadButton module="grammar" maxChars={15000} disabled={task.isPending} onFiles={([f]) => { if (f) { setText(f.text); setSource(f.source); setResult(null); } }} />}
            placeholder="Paste a paragraph, abstract or section of your paper…"
            minLength={20}
            rows={16}
            disabled={task.isPending}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="premium" size="lg" onClick={submit} disabled={task.isPending || tooShort || tooLong}>
              {task.isPending ? <Loader2 className="animate-spin" /> : <SpellCheck />}
              {task.isPending ? "Checking…" : "Check grammar"}
            </Button>
            {result && text !== checkedText && <span className="text-xs text-muted-foreground">Text changed since the last check.</span>}
          </div>
          {task.error && <ErrorState message={task.error.message} onRetry={submit} />}
        </div>

        <div>
          {task.isPending ? (
            <LoadingState title="Checking your text with Gemini" steps={["Scanning grammar, spelling and punctuation", "Protecting LaTeX syntax"]} />
          ) : !result ? (
            <EmptyState icon={SpellCheck} title="No results yet" description="Paste your text and press “Check grammar”. Corrections will appear here." />
          ) : result.issues.length === 0 ? (
            <EmptyState icon={CheckCheck} title="No issues found" description="Gemini did not find grammar, spelling or punctuation errors in this text." />
          ) : (
            <Panel
              title={`${result.issues.length} suggestion${result.issues.length === 1 ? "" : "s"}`}
              description={`${pending} pending · ${accepted.length} accepted${result.protectedCount ? ` · ${result.protectedCount} LaTeX elements protected` : ""}`}
              actions={
                <>
                  <Button size="sm" variant="soft" onClick={() => setAll("accepted")}><CheckCheck />Accept all</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAll(undefined)}><Undo2 />Reset</Button>
                </>
              }
            >
              <div className="mb-4 flex flex-wrap gap-1.5">
                {Object.entries(counts).map(([k, v]) => (
                  <Badge key={k} variant="muted" className="capitalize">{k}: {v}</Badge>
                ))}
              </div>
              <Tabs defaultValue="review">
                <TabsList>
                  <TabsTrigger value="review">Review</TabsTrigger>
                  <TabsTrigger value="compare">Original vs corrected</TabsTrigger>
                </TabsList>
                <TabsContent value="review" className="mt-4 space-y-4">
                  <div className="max-h-56 overflow-auto rounded-lg border bg-muted/30 p-4 text-[15px] leading-relaxed">
                    <Highlighted text={checkedText} issues={result.issues} decisions={decisions} active={active} onPick={setActive} />
                  </div>
                  <ul className="max-h-[420px] space-y-2 overflow-auto pr-1">
                    {result.issues.map((i) => (
                      <li
                        key={i.id}
                        onMouseEnter={() => setActive(i.id)}
                        className={cn(
                          "rounded-lg border p-3 transition-colors",
                          active === i.id && "border-primary/50 bg-accent/40",
                          decisions[i.id] === "rejected" && "opacity-55",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="capitalize">{i.category}</Badge>
                          <span className="rounded bg-mark-error px-1.5 text-sm line-through decoration-destructive/60">{i.original}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="rounded bg-mark-fix px-1.5 text-sm font-medium">{i.suggestion || "(remove)"}</span>
                        </div>
                        {i.explanation && <p className="mt-1.5 text-xs text-muted-foreground">{i.explanation}</p>}
                        <div className="mt-2 flex gap-1.5">
                          <Button size="sm" variant={decisions[i.id] === "accepted" ? "default" : "outline"} onClick={() => setDecisions((d) => ({ ...d, [i.id]: "accepted" }))}>
                            <Check />Accept
                          </Button>
                          <Button size="sm" variant={decisions[i.id] === "rejected" ? "secondary" : "ghost"} onClick={() => setDecisions((d) => ({ ...d, [i.id]: "rejected" }))}>
                            <X />Reject
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </TabsContent>
                <TabsContent value="compare" className="mt-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Original</p>
                      <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">{checkedText}</div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Corrected ({accepted.length} applied)</p>
                      <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-success/30 bg-success/5 p-3 text-sm leading-relaxed">{corrected}</div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                <Button
                  variant="navy"
                  disabled={accepted.length === 0}
                  onClick={() => {
                    setText(corrected);
                    setResult(null);
                  }}
                >
                  Apply {accepted.length} accepted to editor
                </Button>
                <CopyButton text={corrected} label="Copy corrected text" size="default" />
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

function Highlighted({
  text,
  issues,
  decisions,
  active,
  onPick,
}: {
  text: string;
  issues: GrammarIssue[];
  decisions: Record<string, Decision>;
  active: string | null;
  onPick: (id: string) => void;
}) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const i of issues) {
    if (i.start > cursor) parts.push(<span key={`t${cursor}`}>{text.slice(cursor, i.start)}</span>);
    const d = decisions[i.id];
    parts.push(
      <button
        key={i.id}
        type="button"
        onClick={() => onPick(i.id)}
        title={`${i.category}: ${i.suggestion}`}
        className={cn(
          "rounded-sm px-0.5 underline decoration-2 decoration-wavy underline-offset-4",
          CATEGORY_STYLE[i.category],
          d === "accepted" ? "bg-mark-fix no-underline" : d === "rejected" ? "no-underline" : "bg-mark-error/60",
          active === i.id && "ring-2 ring-primary/40",
        )}
      >
        {d === "accepted" ? i.suggestion : text.slice(i.start, i.end)}
      </button>,
    );
    cursor = i.end;
  }
  parts.push(<span key="end">{text.slice(cursor)}</span>);
  return <p className="whitespace-pre-wrap">{parts}</p>;
}

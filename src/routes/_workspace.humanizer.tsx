import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Check, CheckCheck, CheckCircle2, Download, Feather, Hash, Loader2, ShieldCheck, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { EngineNotice } from "@/components/shared/EngineNotice";
import { TextEditor, CopyButton } from "@/components/shared/TextEditor";
import { UploadButton } from "@/components/shared/UploadButton";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/shared/States";
import { humanizeText } from "@/lib/ai/research.functions";
import type { HumanizerFocus, HumanizerResult, HumanizerStyle } from "@/lib/ai/schemas";
import { buildDiff, composeDiff, type DiffPart } from "@/lib/engines/diff";
import { verifyLatexPreserved } from "@/lib/engines/latex";
import { numbersPreserved } from "@/lib/engines/text";
import { PASTED, type UploadSource } from "@/lib/uploads/rules";
import { HUMANIZER_SAMPLE } from "@/lib/samples";
import { useAiTask } from "@/hooks/use-ai-task";
import { downloadText, resultFileName } from "@/hooks/use-upload";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workspace/humanizer")({
  head: () => ({
    meta: [
      { title: "AI Humanizer — IEEE Research Agent" },
      { name: "description", content: "Refine academic text into natural, readable IEEE-style English while equations, citations and numbers stay exactly as written." },
      { property: "og:title", content: "AI Humanizer — IEEE Research Agent" },
      { property: "og:description", content: "Natural academic English with change-by-change review and locked LaTeX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HumanizerPage,
});

const STYLES: { id: HumanizerStyle; title: string; text: string }[] = [
  { id: "natural", title: "Natural academic English", text: "Fluent, varied sentences as an experienced researcher writes" },
  { id: "ieee", title: "Professional IEEE style", text: "Formal, objective and concise for IEEE venues" },
];
const FOCUS: { id: HumanizerFocus; label: string }[] = [
  { id: "clarity", label: "Clarity & readability" },
  { id: "flow", label: "Sentence flow" },
  { id: "repetition", label: "Reduce repetition" },
];

function HumanizerPage() {
  const [text, setText] = useState("");
  const [source, setSource] = useState<UploadSource>(PASTED);
  const [style, setStyle] = useState<HumanizerStyle>("natural");
  const [focus, setFocus] = useState<HumanizerFocus[]>(["clarity", "flow", "repetition"]);
  const [original, setOriginal] = useState("");
  const [runSource, setRunSource] = useState<UploadSource>(PASTED);
  const [result, setResult] = useState<HumanizerResult | null>(null);
  const run = useServerFn(humanizeText);
  const task = useAiTask(
    (v: { text: string; style: HumanizerStyle; focus: HumanizerFocus[]; source: UploadSource }) => run({ data: v }),
    "Text refined",
  );

  const invalid = text.trim().length < 20 || text.length > 15000;
  const submit = () => {
    if (invalid) return;
    const snapshot = text;
    const snapSource = source;
    task.mutate(
      { text: snapshot, style, focus, source: snapSource },
      { onSuccess: (r) => { setResult(r); setOriginal(snapshot); setRunSource(snapSource); } },
    );
  };
  const toggleFocus = (f: HumanizerFocus) => setFocus((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  return (
    <>
      <PageHeader icon={Feather} title="AI Humanizer" description="Turn stiff or repetitive drafts into natural, readable academic English — then accept or reject every change." />
      <EngineNotice engine="hybrid">
        Gemini refines the wording. Equations, citations, references, LaTeX commands and every number are locked and checked after each rewrite. This tool improves writing quality; it does not try to disguise AI-generated text or bypass AI detectors.
      </EngineNotice>

      <div className="space-y-3">
        <div role="radiogroup" aria-label="Writing style" className="grid gap-2 sm:grid-cols-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={style === s.id}
              disabled={task.isPending}
              onClick={() => setStyle(s.id)}
              className={cn(
                "rounded-xl border bg-card p-3 text-left shadow-card transition-all disabled:opacity-60",
                style === s.id ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40",
              )}
            >
              <p className="text-sm font-semibold text-foreground">{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.text}</p>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Improvements">
          <span className="text-xs font-medium text-muted-foreground">Also improve:</span>
          {FOCUS.map((f) => {
            const on = focus.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                disabled={task.isPending}
                onClick={() => toggleFocus(f.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {on && <Check className="size-3" />}
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <TextEditor
          label="Original text"
          value={text}
          onChange={setText}
          sample={HUMANIZER_SAMPLE}
          onReset={() => setSource(PASTED)}
          hint={source.kind === "tex" ? `Loaded from ${source.fileName}` : "Paste text or upload a .tex file"}
          actions={<UploadButton module="humanizer" maxChars={15000} disabled={task.isPending} onFiles={([f]) => { if (f) { setText(f.text); setSource(f.source); setResult(null); } }} />}
          minLength={20}
          rows={9}
          disabled={task.isPending}
          placeholder="Paste a paragraph or section of your paper, or upload a .tex file…"
        />
        <Button variant="premium" size="lg" onClick={submit} disabled={task.isPending || invalid}>
          {task.isPending ? <Loader2 className="animate-spin" /> : <Feather />}
          {task.isPending ? "Refining…" : "Humanize text"}
        </Button>
        {task.error && <ErrorState message={task.error.message} onRetry={submit} />}
      </div>

      {task.isPending ? (
        <LoadingState title="Refining your text" steps={["Locking LaTeX elements and numbers", "Rewriting with Gemini", "Verifying equations, citations and numbers"]} />
      ) : result ? (
        <HumanizerReview
          key={result.improved}
          original={original}
          result={result}
          source={runSource}
          onUse={(t) => { setText(t); setSource(runSource); setResult(null); }}
        />
      ) : (
        <EmptyState icon={Feather} title="Your refined text will appear here" description="Pick a style, paste your text or upload a .tex file, and press “Humanize text”. Every change is highlighted so you can accept or reject it." />
      )}
    </>
  );
}

function HumanizerReview({ original, result, source, onUse }: { original: string; result: HumanizerResult; source: UploadSource; onUse: (text: string) => void }) {
  const { parts, granular } = useMemo(() => buildDiff(original, result.improved), [original, result.improved]);
  const hunks = parts.flatMap((p) => (p.type === "change" ? [p.hunk] : []));
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const final = useMemo(() => composeDiff(parts, rejected), [parts, rejected]);
  const latex = verifyLatexPreserved(original, final);
  const nums = numbersPreserved(original, final);
  const toggle = (id: string, reject: boolean) =>
    setRejected((cur) => {
      const next = new Set(cur);
      if (reject) next.add(id);
      else next.delete(id);
      return next;
    });
  const accepted = hunks.length - rejected.size;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] animate-fade-up">
      <Panel
        title="Review changes"
        description={`${hunks.length} change${hunks.length === 1 ? "" : "s"} · ${accepted} accepted · ${rejected.size} rejected`}
        actions={
          <>
            <Button size="sm" variant="soft" onClick={() => setRejected(new Set())}><CheckCheck />Accept all</Button>
            <Button size="sm" variant="ghost" onClick={() => setRejected(new Set(hunks.map((h) => h.id)))}><Undo2 />Reject all</Button>
          </>
        }
      >
        {!granular && (
          <p className="mb-3 rounded-lg bg-warning/15 p-3 text-xs text-foreground">
            The rewrite moved some LaTeX elements, so it can only be accepted or rejected as a whole.
          </p>
        )}
        {hunks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Gemini found nothing to change in this text.</p>
        ) : (
          <Tabs defaultValue="inline">
            <TabsList>
              <TabsTrigger value="inline">Inline review</TabsTrigger>
              <TabsTrigger value="side">Original vs improved</TabsTrigger>
              <TabsTrigger value="list">Change list</TabsTrigger>
            </TabsList>
            <TabsContent value="inline" className="mt-4">
              <p className="mb-2 text-xs text-muted-foreground">Click a highlighted change to accept or reject it.</p>
              <div className="max-h-[460px] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/20 p-4 text-[15px] leading-relaxed">
                {parts.map((p, i) =>
                  p.type === "same" ? (
                    <span key={i}>{p.text}</span>
                  ) : (
                    <button
                      key={p.hunk.id}
                      type="button"
                      onClick={() => toggle(p.hunk.id, !rejected.has(p.hunk.id))}
                      title={rejected.has(p.hunk.id) ? "Rejected — click to accept" : "Accepted — click to reject"}
                      className="rounded-sm text-left ring-primary/40 hover:ring-2"
                    >
                      {p.hunk.before && (
                        <del className={cn("rounded-sm px-0.5", rejected.has(p.hunk.id) ? "no-underline" : "bg-mark-error text-muted-foreground decoration-destructive/60")}>
                          {p.hunk.before}
                        </del>
                      )}
                      {p.hunk.after && (
                        <ins className={cn("rounded-sm px-0.5 no-underline", rejected.has(p.hunk.id) ? "text-muted-foreground line-through opacity-60" : "bg-mark-fix")}>
                          {p.hunk.after}
                        </ins>
                      )}
                    </button>
                  ),
                )}
              </div>
            </TabsContent>
            <TabsContent value="side" className="mt-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Original</p>
                  <div className="max-h-[460px] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
                    <SideText parts={parts} side="before" rejected={rejected} />
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-primary">Improved ({accepted} applied)</p>
                  <div className="max-h-[460px] overflow-auto whitespace-pre-wrap rounded-lg border border-primary/25 bg-accent/30 p-3 text-sm leading-relaxed">
                    <SideText parts={parts} side="after" rejected={rejected} />
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="list" className="mt-4">
              <ul className="max-h-[460px] space-y-2 overflow-auto pr-1">
                {hunks.map((h) => {
                  const isRejected = rejected.has(h.id);
                  return (
                    <li key={h.id} className={cn("rounded-lg border p-3 text-sm", isRejected && "opacity-60")}>
                      <p>
                        {h.before ? <span className="rounded bg-mark-error px-1 line-through decoration-destructive/50">{h.before}</span> : <span className="text-xs text-muted-foreground">(added)</span>}
                      </p>
                      <p className="mt-1">
                        {h.after ? <span className="rounded bg-mark-fix px-1">{h.after}</span> : <span className="text-xs text-muted-foreground">(removed)</span>}
                      </p>
                      <div className="mt-2 flex gap-1.5">
                        <Button size="sm" variant={!isRejected ? "default" : "outline"} onClick={() => toggle(h.id, false)}><Check />Accept</Button>
                        <Button size="sm" variant={isRejected ? "secondary" : "ghost"} onClick={() => toggle(h.id, true)}><X />Reject</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </TabsContent>
          </Tabs>
        )}
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
          <Button variant="navy" onClick={() => onUse(final)}>Use final text in editor</Button>
          <CopyButton text={final} label="Copy final text" size="default" />
          <Button variant="outline" onClick={() => downloadText(final, resultFileName(source, "humanized"))}>
            <Download />
            Download {source.kind === "tex" ? ".tex" : ".txt"}
          </Button>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel title="Safeguards" description="Checked in your browser on the final text">
          <ul className="space-y-3 text-sm">
            <Safeguard ok={latex.preserved} icon={ShieldCheck} label={latex.total ? `${latex.total} LaTeX element${latex.total === 1 ? "" : "s"} preserved` : "No LaTeX elements in this text"} detail="Equations, citations, references and commands are unchanged." />
            <Safeguard ok={nums.ok} icon={Hash} label={nums.total ? `${nums.total} number${nums.total === 1 ? "" : "s"} preserved` : "No numbers in this text"} detail={nums.ok ? "Every value appears exactly as in your original." : `Changed: ${[...nums.missing, ...nums.added].join(", ")}`} />
          </ul>
        </Panel>
        {result.notes.length > 0 && (
          <Panel title="What was improved">
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-foreground/85">
              {result.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">AI notes — always reread the final text before submitting.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}

function Safeguard({ ok, icon: Icon, label, detail }: { ok: boolean; icon: typeof ShieldCheck; label: string; detail: string }) {
  return (
    <li className={cn("flex items-start gap-3 rounded-lg p-3", ok ? "bg-success/10" : "bg-destructive/10")}>
      {ok ? <CheckCircle2 className="size-5 shrink-0 text-success" /> : <Icon className="size-5 shrink-0 text-destructive" />}
      <div>
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {ok && <Badge variant="success" className="ml-auto shrink-0">OK</Badge>}
    </li>
  );
}

function SideText({ parts, side, rejected }: { parts: DiffPart[]; side: "before" | "after"; rejected: ReadonlySet<string> }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.type === "same") return <span key={i}>{p.text}</span>;
        const isRejected = rejected.has(p.hunk.id);
        if (side === "before") return p.hunk.before ? <mark key={p.hunk.id} className={cn("rounded-sm px-0.5 text-foreground", isRejected ? "bg-transparent" : "bg-mark-error")}>{p.hunk.before}</mark> : null;
        if (isRejected) return <span key={p.hunk.id}>{p.hunk.before}</span>;
        return p.hunk.after ? <mark key={p.hunk.id} className="rounded-sm bg-mark-fix px-0.5 text-foreground">{p.hunk.after}</mark> : null;
      })}
    </>
  );
}

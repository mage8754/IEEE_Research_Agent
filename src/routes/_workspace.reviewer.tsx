import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import { BadgeCheck, CircleAlert, ClipboardCheck, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { PageHeader } from "@/components/shared/PageHeader";
import { EngineNotice } from "@/components/shared/EngineNotice";
import { TextEditor, CopyButton } from "@/components/shared/TextEditor";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/shared/States";
import { reviewManuscript } from "@/lib/ai/research.functions";
import type { ReviewerResult, SectionKey } from "@/lib/ai/schemas";
import { extractPdfText } from "@/lib/pdf/extract";
import { UploadButton } from "@/components/shared/UploadButton";
import type { VerifiedFile } from "@/hooks/use-upload";
import { PASTED, type UploadSource } from "@/lib/uploads/rules";
import { REVIEWER_SAMPLE } from "@/lib/samples";
import { useAiTask } from "@/hooks/use-ai-task";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workspace/reviewer")({
  head: () => ({
    meta: [
      { title: "IEEE Reviewer Agent — IEEE Research Agent" },
      { name: "description", content: "Get constructive IEEE reviewer-style feedback on your abstract, introduction, methodology, results and conclusion." },
      { property: "og:title", content: "IEEE Reviewer Agent — IEEE Research Agent" },
      { property: "og:description", content: "AI pre-review of your manuscript in IEEE reviewer style." },
    ],
  }),
  component: ReviewerPage,
});

const SECTION_LABEL: Record<SectionKey, string> = {
  abstract: "Abstract",
  introduction: "Introduction",
  methodology: "Methodology",
  results: "Experimental results",
  conclusion: "Conclusion",
};

const REC: Record<ReviewerResult["overall"]["recommendation"], { label: string; variant: "success" | "info" | "warning" | "destructive" }> = {
  accept: { label: "Accept", variant: "success" },
  minor_revision: { label: "Minor revision", variant: "info" },
  major_revision: { label: "Major revision", variant: "warning" },
  reject: { label: "Reject", variant: "destructive" },
};

function ReviewerPage() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [source, setSource] = useState<UploadSource>(PASTED);
  const [result, setResult] = useState<ReviewerResult | null>(null);
  const run = useServerFn(reviewManuscript);
  const task = useAiTask((v: { title: string; text: string }) => run({ data: { ...v, source } }), "Review report ready");
  const invalid = text.trim().length < 300 || text.length > 60000;

  const importFile = async (f: VerifiedFile) => {
    const baseName = f.file.name.replace(/\.(pdf|tex)$/i, "");
    if (f.kind === "tex") {
      if (f.text.length > 60000) {
        toast.error(`“${f.file.name}” is longer than 60,000 characters. Upload the main sections only.`);
        return;
      }
      setText(f.text);
      setSource(f.source);
      if (!title) setTitle(baseName);
      toast.success("Manuscript imported");
      return;
    }
    setImporting(true);
    try {
      const { text: t } = await extractPdfText(f.file, 60000);
      if (t.length < 300) throw new Error();
      setText(t);
      setSource(f.source);
      if (!title) setTitle(baseName);
      toast.success("Manuscript imported");
    } catch {
      toast.error("Couldn't read text from this PDF. It may be scanned, encrypted or damaged.");
    } finally {
      setImporting(false);
    }
  };

  const submit = () => {
    if (!invalid) task.mutate({ title, text }, { onSuccess: setResult });
  };

  return (
    <>
      <PageHeader icon={ClipboardCheck} title="IEEE Reviewer Agent" description="Receive constructive, reviewer-style feedback on each section of your manuscript and an overall review report." />
      <EngineNotice engine="ai">
        An AI pre-review to help you revise before submission. It is not an official IEEE review and does not predict acceptance.
      </EngineNotice>

      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="ms-title">Manuscript title (optional)</Label>
          <Input id="ms-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} className="h-11 bg-card" placeholder="e.g. Edge-Deployed Anomaly Detection for Smart Grid Sensors" />
        </div>
        <div className="flex items-center gap-2">
          {importing && <Loader2 className="size-4 animate-spin text-primary" />}
          <UploadButton module="reviewer" label="Import .tex or .pdf" className="h-11 rounded-lg px-4 text-sm" disabled={importing || task.isPending} onFiles={([f]) => (f ? importFile(f) : undefined)} />
        </div>
      </div>
      <TextEditor label="Manuscript text" value={text} onChange={setText} sample={REVIEWER_SAMPLE} onReset={() => setSource(PASTED)} hint={source.kind !== "paste" ? `Imported from ${source.fileName}` : "Paste text or import a .tex or .pdf file"} maxLength={60000} minLength={300} rows={14} disabled={task.isPending} placeholder="Paste your full manuscript, including abstract, introduction, methodology, results and conclusion…" />
      <Button variant="premium" size="lg" onClick={submit} disabled={task.isPending || invalid} className="w-fit">
        {task.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {task.isPending ? "Reviewing…" : "Generate review report"}
      </Button>
      {task.error && <ErrorState message={task.error.message} onRetry={submit} />}

      {task.isPending ? (
        <LoadingState title="Reviewing your manuscript" steps={["Reading each section", "Assessing methodology and evidence", "Writing the review report"]} />
      ) : result ? (
        <ReviewReport result={result} title={title} />
      ) : (
        <EmptyState icon={ClipboardCheck} title="No review yet" description="Paste your manuscript or import a PDF, then press “Generate review report”." />
      )}
    </>
  );
}

const radarConfig = { score: { label: "Score", color: "var(--chart-1)" } } satisfies ChartConfig;

function reportText(r: ReviewerResult, title: string) {
  const s = (Object.keys(SECTION_LABEL) as SectionKey[])
    .map((k) => {
      const v = r.sections[k];
      return `## ${SECTION_LABEL[k]} (${v.score}/10)\nStrengths:\n${v.strengths.map((x) => `- ${x}`).join("\n") || "- None noted"}\nWeaknesses:\n${v.weaknesses.map((x) => `- ${x}`).join("\n") || "- None noted"}\nSuggestions:\n${v.suggestions.map((x) => `- ${x}`).join("\n") || "- None"}`;
    })
    .join("\n\n");
  return `# Review report${title ? `: ${title}` : ""}\nRecommendation: ${REC[r.overall.recommendation].label} · Overall score ${r.overall.score}/10\n\n${r.overall.summary}\n\n${s}\n\n## Methodological weaknesses\n${r.methodologicalWeaknesses.map((x) => `- ${x}`).join("\n")}\n\n## Key actions\n${r.overall.keyActions.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\n(AI pre-review generated by IEEE Research Agent — not an official IEEE review.)`;
}

function ReviewReport({ result, title }: { result: ReviewerResult; title: string }) {
  const keys = Object.keys(SECTION_LABEL) as SectionKey[];
  const radar = keys.map((k) => ({ section: SECTION_LABEL[k].split(" ")[0], score: result.sections[k].score }));
  const rec = REC[result.overall.recommendation];
  return (
    <div className="space-y-6 animate-fade-up">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Overall assessment" actions={<CopyButton text={reportText(result, title)} label="Copy report" />}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex size-20 flex-col items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow">
              <span className="font-display text-2xl font-semibold leading-none">{result.overall.score}</span>
              <span className="text-[10px] opacity-80">/ 10</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Recommendation</p>
              <Badge variant={rec.variant} className="mt-1 text-sm">{rec.label}</Badge>
            </div>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed text-foreground">{result.overall.summary}</p>
          {result.overall.keyActions.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority revisions</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground/90">
                {result.overall.keyActions.map((a, i) => <li key={i}>{a}</li>)}
              </ol>
            </div>
          )}
        </Panel>
        <Panel title="Section scores">
          <ChartContainer config={radarConfig} className="mx-auto aspect-square max-h-[260px]">
            <RadarChart data={radar}>
              <PolarGrid />
              <PolarAngleAxis dataKey="section" tick={{ fontSize: 11 }} />
              <Radar dataKey="score" stroke="var(--color-score)" fill="var(--color-score)" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ChartContainer>
          <ul className="mt-2 space-y-2">
            {keys.map((k) => (
              <li key={k} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-muted-foreground">{SECTION_LABEL[k]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${result.sections[k].score * 10}%` }} />
                </div>
                <span className="w-10 text-right font-medium">{result.sections[k].score}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Section-by-section feedback">
        <Accordion type="multiple" defaultValue={["abstract"]}>
          {keys.map((k) => {
            const s = result.sections[k];
            return (
              <AccordionItem key={k} value={k}>
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2">
                    {SECTION_LABEL[k]}
                    {!s.present && <Badge variant="destructive">Missing</Badge>}
                    <Badge variant="muted">{s.score}/10</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <FeedbackList title="Strengths" items={s.strengths} tone="text-success" />
                    <FeedbackList title="Weaknesses" items={s.weaknesses} tone="text-destructive" />
                    <FeedbackList title="Suggestions" items={s.suggestions} tone="text-primary" />
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Unclear explanations" description={`${result.unclear.length} passage(s)`}>
          {result.unclear.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unclear passages were flagged.</p>
          ) : (
            <ul className="space-y-3">
              {result.unclear.map((u, i) => (
                <li key={i} className="rounded-lg border p-3 text-sm">
                  <blockquote className="border-l-2 border-warning pl-3 italic text-foreground/80">“{u.quote}”</blockquote>
                  <p className="mt-2 text-foreground">{u.issue}</p>
                  <p className={cn("mt-1 inline-flex items-center gap-1 text-[11px]", u.verified ? "text-success" : "text-warning-foreground")}>
                    {u.verified ? <BadgeCheck className="size-3.5" /> : <CircleAlert className="size-3.5" />}
                    {u.verified ? "Quote found in manuscript" : "Quote not found verbatim"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Methodological weaknesses">
          {result.methodologicalWeaknesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No methodological weaknesses were flagged.</p>
          ) : (
            <ul className="list-disc space-y-2 pl-5 text-sm text-foreground/90">
              {result.methodologicalWeaknesses.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function FeedbackList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <p className={cn("text-xs font-semibold uppercase tracking-wide", tone)}>{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">None noted.</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-foreground/90">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
      )}
    </div>
  );
}

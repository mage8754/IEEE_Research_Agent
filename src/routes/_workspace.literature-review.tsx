import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Library, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { EngineNotice } from "@/components/shared/EngineNotice";
import { CopyButton } from "@/components/shared/TextEditor";
import { Markdown } from "@/components/shared/Markdown";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/shared/States";
import { compareLiterature } from "@/lib/ai/research.functions";
import type { LiteratureResult } from "@/lib/ai/schemas";
import { extractPdfText } from "@/lib/pdf/extract";
import { UploadButton } from "@/components/shared/UploadButton";
import type { VerifiedFile } from "@/hooks/use-upload";
import { PASTED, type UploadSource } from "@/lib/uploads/rules";
import { LITERATURE_SAMPLES } from "@/lib/samples";
import { useAiTask } from "@/hooks/use-ai-task";

export const Route = createFileRoute("/_workspace/literature-review")({
  head: () => ({
    meta: [
      { title: "Literature Review Assistant — IEEE Research Agent" },
      { name: "description", content: "Compare research papers' methods, datasets and results, identify gaps and draft a traceable literature review." },
      { property: "og:title", content: "Literature Review Assistant — IEEE Research Agent" },
      { property: "og:description", content: "Comparison tables and source-traceable literature review drafts." },
    ],
  }),
  component: LiteraturePage,
});

interface PaperInput { id: number; title: string; text: string; source: UploadSource }
let nextId = 3;

function LiteraturePage() {
  const [topic, setTopic] = useState("");
  const [papers, setPapers] = useState<PaperInput[]>([{ id: 1, title: "", text: "", source: PASTED }, { id: 2, title: "", text: "", source: PASTED }]);
  const [importing, setImporting] = useState<number | null>(null);
  const [errors, setErrors] = useState<string | null>(null);
  const [result, setResult] = useState<LiteratureResult | null>(null);
  const run = useServerFn(compareLiterature);
  const task = useAiTask((v: { topic: string; papers: { title: string; text: string; source: UploadSource }[] }) => run({ data: v }), "Comparison ready");

  const update = (id: number, patch: Partial<PaperInput>) => setPapers((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const readPdf = async (f: VerifiedFile) => {
    const { text } = await extractPdfText(f.file, 30000);
    if (text.length < 100) throw new Error("no text");
    return text;
  };

  const importPdf = async (id: number, f: VerifiedFile) => {
    setImporting(id);
    try {
      const text = await readPdf(f);
      update(id, { text, source: f.source, title: papers.find((p) => p.id === id)?.title || f.file.name.replace(/\.pdf$/i, "") });
      toast.success(`Imported ${f.file.name}`);
    } catch {
      toast.error(`Couldn't read text from ${f.file.name}. It may be scanned, encrypted or damaged.`);
    } finally {
      setImporting(null);
    }
  };

  /** Multiple PDFs at once: fill empty paper slots first, then add new ones (max 5). */
  const importMany = async (files: VerifiedFile[]) => {
    setImporting(-1);
    let list = [...papers];
    let added = 0;
    for (const f of files) {
      const slot = list.find((p) => !p.text.trim() && !p.title.trim());
      if (!slot && list.length >= 5) {
        toast.error(`Skipped ${f.file.name}: you can compare at most 5 papers.`);
        continue;
      }
      try {
        const text = await readPdf(f);
        const paper = { title: f.file.name.replace(/\.pdf$/i, ""), text, source: f.source };
        list = slot ? list.map((p) => (p.id === slot.id ? { ...p, ...paper } : p)) : [...list, { id: nextId++, ...paper }];
        added++;
      } catch {
        toast.error(`Couldn't read text from ${f.file.name}. It may be scanned, encrypted or damaged.`);
      }
    }
    setPapers(list);
    setImporting(null);
    if (added) toast.success(`Imported ${added} PDF${added === 1 ? "" : "s"}`);
  };

  const submit = () => {
    const filled = papers.filter((p) => p.title.trim() || p.text.trim());
    if (filled.length < 2) {
      setErrors("Add at least two papers to compare.");
      return;
    }
    const bad = filled.find((p) => p.title.trim().length < 2 || p.text.trim().length < 100);
    if (bad) {
      setErrors("Each paper needs a title and at least 100 characters of text (abstract or full text).");
      return;
    }
    if (filled.some((p) => p.text.length > 30000)) {
      setErrors("Each paper can be at most 30,000 characters.");
      return;
    }
    setErrors(null);
    task.mutate({ topic, papers: filled.map(({ title, text, source }) => ({ title, text, source })) }, { onSuccess: setResult });
  };

  const loadSamples = () => {
    setPapers(LITERATURE_SAMPLES.map((s, i) => ({ id: i + 1, ...s, source: PASTED })));
    nextId = LITERATURE_SAMPLES.length + 1;
    setTopic("Plant disease detection with deep learning");
  };

  return (
    <>
      <PageHeader
        icon={Library}
        title="Literature Review Assistant"
        description="Compare methodologies, datasets and reported results across papers, identify research gaps and draft a literature review."
        actions={
          <>
            <UploadButton module="literature" multiple label="Import PDFs" className="h-9 px-4 text-sm" disabled={importing !== null || task.isPending} onFiles={importMany} />
            <Button variant="outline" onClick={loadSamples}>Load fictional samples</Button>
          </>
        }
      />
      <EngineNotice engine="ai">
        Gemini compares only the papers you provide. Every statement in the draft carries source markers like [P1] so you can trace it back.
      </EngineNotice>

      <div className="space-y-1.5">
        <Label htmlFor="topic">Review topic (optional)</Label>
        <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={200} placeholder="e.g. Lightweight models for on-device plant disease detection" className="h-11 max-w-xl bg-card" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {papers.map((p, idx) => (
          <div key={p.id} className="rounded-xl border bg-card p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="rounded-md bg-accent px-2 py-0.5 font-mono text-xs font-semibold text-accent-foreground">P{idx + 1}</span>
              <div className="flex items-center gap-1">
                {importing === p.id && <Loader2 className="size-3.5 animate-spin text-primary" />}
                <UploadButton module="literature" label="Import PDF" className="border-0 bg-transparent shadow-none" disabled={importing !== null} onFiles={([f]) => (f ? importPdf(p.id, f) : undefined)} />
                <Button variant="ghost" size="icon" aria-label="Remove paper" disabled={papers.length <= 2} onClick={() => setPapers((ps) => ps.filter((x) => x.id !== p.id))}>
                  <Trash2 />
                </Button>
              </div>
            </div>
            <Input value={p.title} onChange={(e) => update(p.id, { title: e.target.value })} placeholder="Paper title" maxLength={300} className="mb-2" />
            <Textarea value={p.text} onChange={(e) => update(p.id, { text: e.target.value, ...(e.target.value ? {} : { source: PASTED }) })} placeholder="Paste the abstract or full text…" rows={7} className="resize-y text-sm" />
            <p className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
              <span className="truncate">{p.source.kind === "pdf" ? `From ${p.source.fileName}` : "Pasted text or .pdf"}</span>
              <span>{p.text.length.toLocaleString()}/30,000</span>
            </p>
          </div>
        ))}
        {papers.length < 5 && (
          <button onClick={() => setPapers((ps) => [...ps, { id: nextId++, title: "", text: "", source: PASTED }])} className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground">
            <Plus className="size-5" />
            Add paper ({papers.length}/5)
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="premium" size="lg" onClick={submit} disabled={task.isPending}>
          {task.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {task.isPending ? "Comparing…" : "Compare & draft review"}
        </Button>
        {errors && <span className="text-sm text-destructive">{errors}</span>}
      </div>
      {task.error && <ErrorState message={task.error.message} onRetry={submit} />}

      {task.isPending ? (
        <LoadingState title="Comparing papers" steps={["Extracting methods, datasets and results", "Identifying research gaps", "Drafting a source-traceable review"]} />
      ) : result ? (
        <LiteratureReport result={result} />
      ) : (
        <EmptyState icon={Library} title="No comparison yet" description="Add two to five papers and press “Compare & draft review”." />
      )}
    </>
  );
}

const ROWS = [
  ["methodology", "Methodology"],
  ["datasets", "Datasets"],
  ["results", "Reported results"],
  ["limitations", "Limitations"],
] as const;

function LiteratureReport({ result }: { result: LiteratureResult }) {
  return (
    <div className="space-y-6 animate-fade-up">
      <Panel title="Sources">
        <ul className="grid gap-2 sm:grid-cols-2">
          {result.sources.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[11px] font-semibold text-accent-foreground">{s.id}</span>
              <span className="text-foreground">{s.title}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Comparison table">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-36">Aspect</TableHead>
                {result.papers.map((p) => <TableHead key={p.id} className="min-w-[200px]">{p.id}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map(([key, label]) => (
                <TableRow key={key}>
                  <TableCell className="align-top font-medium">{label}</TableCell>
                  {result.papers.map((p) => <TableCell key={p.id} className="align-top text-sm text-foreground/85 whitespace-normal">{p[key]}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <Panel title="Research gaps" description={`${result.gaps.length} identified`}>
          {result.gaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gaps were identified from these sources.</p>
          ) : (
            <ul className="space-y-3">
              {result.gaps.map((g, i) => (
                <li key={i} className="rounded-lg border p-3 text-sm">
                  <p className="text-foreground">{g.gap}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {g.sources.map((s) => <span key={s} className="rounded bg-accent px-1.5 py-0.5 font-mono text-[11px] text-accent-foreground">{s}</span>)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Literature review draft" description="AI-generated draft — review and edit before use" actions={<CopyButton text={result.draft} label="Copy draft" />}>
          <Markdown source={result.draft || "No draft returned."} />
        </Panel>
      </div>
    </div>
  );
}

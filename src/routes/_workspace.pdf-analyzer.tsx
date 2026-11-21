import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BadgeCheck, BookOpen, Database, FileSearch, FlaskConical, Loader2, Microscope, Target, TriangleAlert, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { EngineNotice } from "@/components/shared/EngineNotice";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { CopyButton } from "@/components/shared/TextEditor";
import { EvidenceList } from "@/components/shared/EvidenceList";
import { EmptyState, ErrorState, LoadingState, Panel } from "@/components/shared/States";
import { analyzePaper } from "@/lib/ai/research.functions";
import type { EvidenceItem, PdfResult } from "@/lib/ai/schemas";
import { extractPdfText } from "@/lib/pdf/extract";
import { useUploadVerifier } from "@/hooks/use-upload";
import type { UploadSource } from "@/lib/uploads/rules";
import { useAiTask } from "@/hooks/use-ai-task";

export const Route = createFileRoute("/_workspace/pdf-analyzer")({
  head: () => ({
    meta: [
      { title: "Research PDF Analyzer — IEEE Research Agent" },
      { name: "description", content: "Upload a research PDF to extract the abstract, objectives, methodology, datasets, results and limitations." },
      { property: "og:title", content: "Research PDF Analyzer — IEEE Research Agent" },
      { property: "og:description", content: "Evidence-linked structured summaries of research papers." },
    ],
  }),
  component: PdfPage,
});

type Stage = "idle" | "reading" | "analyzing";

function PdfPage() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<UploadSource | null>(null);
  const [checking, setChecking] = useState(false);
  const verifyFile = useUploadVerifier("pdf");
  const [fileError, setFileError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [readError, setReadError] = useState<string | null>(null);
  const [result, setResult] = useState<PdfResult | null>(null);
  const run = useServerFn(analyzePaper);
  const task = useAiTask((v: { fileName: string; pageCount: number; text: string; source: UploadSource }) => run({ data: v }), "Paper analyzed");

  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = async (f: File) => {
    setFileError(null);
    setReadError(null);
    setResult(null);
    setFile(null);
    setSource(null);
    setChecking(true);
    try {
      const v = await verifyFile(f);
      setFile(v.file);
      setSource(v.source);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "This file could not be checked.");
    } finally {
      setChecking(false);
    }
  };

  const analyze = async () => {
    if (!file || !source) return;
    setReadError(null);
    setStage("reading");
    try {
      const { text, pageCount } = await extractPdfText(file);
      if (text.length < 200) {
        setStage("idle");
        setReadError("We couldn't find selectable text in this PDF. It may be a scanned image — please upload a text-based PDF.");
        return;
      }
      setStage("analyzing");
      task.mutate(
        { fileName: file.name, pageCount, text, source },
        { onSuccess: setResult, onSettled: () => setStage("idle") },
      );
    } catch {
      setStage("idle");
      setReadError("This PDF could not be read. It may be encrypted or damaged.");
    }
  };

  const busy = stage !== "idle" || checking;

  return (
    <>
      <PageHeader icon={FileSearch} title="Research PDF Analyzer" description="Upload a paper to get a structured summary: abstract, objectives, methodology, datasets, results and limitations." />
      <EngineNotice engine="hybrid">
        Text is extracted in your browser and analyzed by Gemini. Each finding includes a supporting quote that we check against the document text.
      </EngineNotice>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <FileDropzone accept=".pdf,application/pdf" hint={checking ? "Checking file…" : ".pdf files only · up to 20 MB · text-based (not scanned)"} file={file} onFile={pick} onClear={() => { setFile(null); setSource(null); setResult(null); }} error={fileError} disabled={busy} />
          <Button variant="premium" size="lg" className="w-full" onClick={analyze} disabled={!file || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Microscope />}
            {checking ? "Checking file…" : stage === "reading" ? "Reading PDF…" : stage === "analyzing" ? "Analyzing with Gemini…" : "Extract & analyze"}
          </Button>
          {readError && <ErrorState message={readError} />}
          {task.error && !busy && <ErrorState message={task.error.message} onRetry={analyze} />}
        </div>
        <Panel title="Document preview" className="overflow-hidden">
          {previewUrl ? (
            <iframe src={previewUrl} title="PDF preview" className="h-[440px] w-full rounded-lg border bg-muted" />
          ) : (
            <EmptyState icon={BookOpen} title="No document selected" description="Your PDF preview will appear here after you choose a file." className="h-[440px]" />
          )}
        </Panel>
      </div>

      {stage !== "idle" ? (
        <LoadingState title={stage === "reading" ? "Extracting text from your PDF" : "Analyzing the paper"} steps={["Reading pages in your browser", "Identifying objectives, methods and datasets", "Checking quotes against the document"]} />
      ) : result ? (
        <PdfReport result={result} />
      ) : null}
    </>
  );
}

const SECTIONS: { key: keyof Pick<PdfResult, "objectives" | "methodology" | "datasets" | "results" | "limitations">; title: string; icon: typeof Target }[] = [
  { key: "objectives", title: "Research objectives", icon: Target },
  { key: "methodology", title: "Methodology", icon: FlaskConical },
  { key: "datasets", title: "Datasets", icon: Database },
  { key: "results", title: "Reported results", icon: TrendingUp },
  { key: "limitations", title: "Limitations", icon: TriangleAlert },
];

function toMarkdown(r: PdfResult) {
  const list = (items: EvidenceItem[]) => (items.length ? items.map((i) => `- ${i.point}`).join("\n") : "- Not stated in the document");
  return [`# ${r.title || r.fileName}`, `## Summary\n${r.summary}`, `## Abstract\n${r.abstract || "Not stated"}`, ...SECTIONS.map((s) => `## ${s.title}\n${list(r[s.key])}`)].join("\n\n");
}

function PdfReport({ result }: { result: PdfResult }) {
  return (
    <div className="space-y-6 animate-fade-up">
      <Panel
        title={result.title || result.fileName}
        description={`${result.pageCount} pages · ${result.wordCount.toLocaleString()} words analyzed`}
        actions={<CopyButton text={toMarkdown(result)} label="Copy summary" />}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Structured summary</p>
        <p className="mt-2 text-[15px] leading-relaxed text-foreground">{result.summary || "No summary returned."}</p>
        <div className="mt-5 border-t pt-4">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Abstract</p>
            {result.abstract && (result.abstractVerified ? <Badge variant="success"><BadgeCheck className="mr-1 size-3" />Verbatim from PDF</Badge> : <Badge variant="warning">Not matched verbatim</Badge>)}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{result.abstract || "No abstract found in the document."}</p>
        </div>
      </Panel>
      <div className="grid gap-6 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Panel key={s.key} title={s.title} actions={<s.icon className="size-4 text-primary" />}>
            <EvidenceList items={result[s.key]} />
          </Panel>
        ))}
      </div>
    </div>
  );
}

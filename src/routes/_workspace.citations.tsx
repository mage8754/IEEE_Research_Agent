import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, CircleAlert, Info, Quote, SearchCheck } from "lucide-react";
import { UploadButton } from "@/components/shared/UploadButton";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/PageHeader";
import { EngineNotice } from "@/components/shared/EngineNotice";
import { TextEditor } from "@/components/shared/TextEditor";
import { EmptyState, Panel } from "@/components/shared/States";
import { checkCitations, type CitationReport } from "@/lib/engines/citations";
import { logCitationCheck } from "@/lib/ai/research.functions";
import { CITATION_BIB_SAMPLE, CITATION_TEX_SAMPLE } from "@/lib/samples";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_workspace/citations")({
  head: () => ({
    meta: [
      { title: "Citation Consistency Checker — IEEE Research Agent" },
      { name: "description", content: "Compare \\cite keys in your manuscript with your BibTeX file: find missing, unused, duplicate and incomplete references." },
      { property: "og:title", content: "Citation Consistency Checker — IEEE Research Agent" },
      { property: "og:description", content: "Find missing and unused references in LaTeX manuscripts." },
    ],
  }),
  component: CitationsPage,
});

function CitationsPage() {
  const [tex, setTex] = useState("");
  const [bib, setBib] = useState("");
  const [report, setReport] = useState<CitationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const log = useServerFn(logCitationCheck);
  const queryClient = useQueryClient();

  const run = () => {
    if (!tex.trim() || !bib.trim()) {
      setError("Add both your manuscript and your BibTeX file.");
      return;
    }
    const r = checkCitations(tex, bib);
    if (r.uses.length === 0) {
      setError("No \\cite commands were found in the manuscript.");
      return;
    }
    if (r.entries.length === 0) {
      setError("No BibTeX entries were found. Entries look like @article{key, …}.");
      return;
    }
    setError(null);
    setReport(r);
    log({
      data: {
        title: `Citation check · ${r.citedKeys.length} keys`,
        cited: r.citedKeys.length,
        entries: r.entries.length,
        issues: r.issueCount,
        missing: r.missing.length,
        unused: r.unused.length,
      },
    })
      .then(() => queryClient.invalidateQueries({ queryKey: ["activity"] }))
      .catch(() => toast.error("Report created, but it could not be saved to your history."));
  };

  const missingKeys = new Set(report?.missing.map((m) => m.key));

  return (
    <>
      <PageHeader icon={Quote} title="Citation Consistency Checker" description="Detect citation keys in your LaTeX manuscript and compare them with your BibTeX entries." />
      <EngineNotice engine="local">
        Checked locally for consistency between your manuscript and your BibTeX file. References are not verified against external databases such as IEEE Xplore.
      </EngineNotice>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-2">
          <TextEditor actions={<UploadButton module="citations" kinds={["tex"]} maxChars={200000} onFiles={([f]) => { if (f) { setTex(f.text); toast.success(`Loaded ${f.file.name}`); } }} />} hint="Paste LaTeX or upload a .tex file" label="Manuscript (LaTeX)" value={tex} onChange={setTex} sample={CITATION_TEX_SAMPLE} mono rows={14} maxLength={200000} placeholder="Paste LaTeX containing \cite{…} commands" />
        </div>
        <div className="space-y-2">
          <TextEditor actions={<UploadButton module="citations" kinds={["bib"]} maxChars={200000} onFiles={([f]) => { if (f) { setBib(f.text); toast.success(`Loaded ${f.file.name}`); } }} />} hint="Paste BibTeX or upload a .bib file" label="Bibliography (BibTeX)" value={bib} onChange={setBib} sample={CITATION_BIB_SAMPLE} mono rows={14} maxLength={200000} placeholder="@article{key, author = {…}, title = {…}, year = {…}}" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="premium" size="lg" onClick={run}><SearchCheck />Check citations</Button>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      {!report ? (
        <EmptyState icon={Quote} title="No report yet" description="Paste or load your .tex and .bib files, then press “Check citations”." />
      ) : (
        <div className="space-y-6 animate-fade-up">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["Cited keys", report.citedKeys.length, false],
              ["BibTeX entries", report.entries.length, false],
              ["Missing", report.missing.length, true],
              ["Unused", report.unused.length, true],
              ["Duplicates", report.duplicates.length, true],
              ["Incomplete", report.incomplete.length, true],
            ].map(([label, value, isIssue]) => (
              <div key={label as string} className="rounded-xl border bg-card p-4 shadow-card">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`mt-1 font-display text-2xl font-semibold ${isIssue && (value as number) > 0 ? "text-destructive" : "text-foreground"}`}>{value as number}</p>
              </div>
            ))}
          </div>

          <Panel
            title={report.issueCount === 0 ? "No consistency issues found" : `${report.issueCount} issue${report.issueCount === 1 ? "" : "s"} found`}
            actions={report.issueCount === 0 ? <CheckCircle2 className="size-5 text-success" /> : <CircleAlert className="size-5 text-destructive" />}
          >
            <Tabs defaultValue="missing">
              <TabsList className="flex-wrap">
                <TabsTrigger value="missing">Missing ({report.missing.length})</TabsTrigger>
                <TabsTrigger value="unused">Unused ({report.unused.length})</TabsTrigger>
                <TabsTrigger value="other">Duplicates & incomplete ({report.duplicates.length + report.incomplete.length})</TabsTrigger>
                <TabsTrigger value="all">All citations</TabsTrigger>
              </TabsList>
              <TabsContent value="missing" className="mt-4">
                <IssueList empty="Every cited key has a BibTeX entry." items={report.missing.map((m) => ({ key: m.key, text: `Cited on line ${m.lines.join(", ")} but no BibTeX entry exists.` }))} />
              </TabsContent>
              <TabsContent value="unused" className="mt-4">
                <IssueList empty="Every BibTeX entry is cited." items={report.unused.map((u) => ({ key: u.key, text: `@${u.type} on line ${u.line} of the .bib file is never cited.` }))} />
              </TabsContent>
              <TabsContent value="other" className="mt-4">
                <IssueList
                  empty="No duplicate keys or incomplete entries."
                  items={[
                    ...report.duplicates.map((d) => ({ key: d.key, text: `Defined ${d.lines.length} times (lines ${d.lines.join(", ")}).` })),
                    ...report.incomplete.map((i) => ({ key: i.key, text: `Missing field(s): ${i.missingFields.join(", ")} (line ${i.line}).` })),
                  ]}
                />
              </TabsContent>
              <TabsContent value="all" className="mt-4">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead>Times cited</TableHead>
                        <TableHead>Lines</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.citedKeys.map((c) => (
                        <TableRow key={c.key}>
                          <TableCell className="font-mono text-xs">{c.key}</TableCell>
                          <TableCell>{c.count}</TableCell>
                          <TableCell className="text-muted-foreground">{c.lines.join(", ")}</TableCell>
                          <TableCell>{missingKeys.has(c.key) ? <Badge variant="destructive">Missing entry</Badge> : <Badge variant="success">Matched in .bib</Badge>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
            <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              “Matched” means the key exists in your BibTeX file. It does not confirm the reference exists or that its details are correct.
            </p>
          </Panel>
        </div>
      )}
    </>
  );
}

function IssueList({ items, empty }: { items: { key: string; text: string }[]; empty: string }) {
  if (items.length === 0)
    return <p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" />{empty}</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {items.map((it, i) => (
        <li key={i} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-3">
          <code className="w-fit rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{it.key}</code>
          <span className="text-sm text-muted-foreground">{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

import { segmentLatex, type LatexKind } from "@/lib/engines/latex";
import { cn } from "@/lib/utils";

export const KIND_STYLE: Record<LatexKind, string> = {
  math: "bg-mark-protected text-accent-foreground",
  citation: "bg-mark-fix text-success",
  reference: "bg-warning/20 text-warning-foreground",
  environment: "bg-primary/10 text-primary",
  command: "bg-muted text-foreground/80",
};

export const KIND_LABEL: Record<LatexKind, string> = {
  math: "Equations & math",
  citation: "Citations",
  reference: "References & labels",
  environment: "Tables, figures & blocks",
  command: "Other commands",
};

export function LatexHighlight({ text, className }: { text: string; className?: string }) {
  return (
    <pre className={cn("whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-foreground", className)}>
      {segmentLatex(text).map((s, i) =>
        s.kind ? (
          <mark key={i} className={cn("rounded px-0.5 ring-1 ring-inset ring-border", KIND_STYLE[s.kind])} title={KIND_LABEL[s.kind]}>
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </pre>
  );
}

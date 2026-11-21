import { Fragment, type ReactNode } from "react";

/** Minimal, safe Markdown renderer (headings, lists, bold, paragraphs) with source markers. */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[P\d+(?:,\s*P\d+)*\])/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^\[P\d+(?:,\s*P\d+)*\]$/.test(p))
      return (
        <span key={i} className="mx-0.5 rounded bg-accent px-1 py-px font-mono text-[11px] text-accent-foreground">
          {p.slice(1, -1)}
        </span>
      );
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
          {list.map((li, i) => (
            <li key={i}>{inline(li)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      blocks.push(
        <h3 key={blocks.length} className="mt-5 mb-1.5 font-display text-lg font-semibold text-foreground first:mt-0">
          {h[2]}
        </h3>,
      );
    } else if (/^[-*]\s+/.test(line)) list.push(line.replace(/^[-*]\s+/, ""));
    else {
      flush();
      blocks.push(
        <p key={blocks.length} className="my-2 leading-relaxed">
          {inline(line)}
        </p>,
      );
    }
  }
  flush();
  return <div className="text-[15px] text-foreground/90">{blocks}</div>;
}

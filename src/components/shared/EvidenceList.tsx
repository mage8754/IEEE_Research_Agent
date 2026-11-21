import { BadgeCheck, CircleAlert } from "lucide-react";
import type { EvidenceItem } from "@/lib/ai/schemas";

export function EvidenceList({ items, empty = "Not stated in the document." }: { items: EvidenceItem[]; empty?: string }) {
  if (items.length === 0) return <p className="text-sm italic text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="text-sm">
          <p className="text-foreground">{it.point}</p>
          {it.quote && (
            <blockquote className="mt-1.5 border-l-2 border-primary/40 pl-3 text-xs italic text-muted-foreground">“{it.quote}”</blockquote>
          )}
          <p className="mt-1 flex items-center gap-1 text-[11px]">
            {it.verified ? (
              <span className="inline-flex items-center gap-1 text-success"><BadgeCheck className="size-3.5" />Quote found in document</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-warning-foreground"><CircleAlert className="size-3.5" />Quote not found verbatim — verify manually</span>
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

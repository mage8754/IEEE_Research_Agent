import type { WritingGoal } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";

const GOALS: { id: WritingGoal; title: string; text: string }[] = [
  { id: "formal", title: "Formal tone", text: "Academic English for IEEE venues" },
  { id: "clarity", title: "Clarity", text: "Easier to read, less ambiguity" },
  { id: "concise", title: "Concise", text: "Remove redundancy and wordiness" },
  { id: "paraphrase", title: "Rewrite", text: "Professional rewording, same meaning" },
];

export function GoalPicker({ value, onChange, disabled }: { value: WritingGoal; onChange: (g: WritingGoal) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Writing goal" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {GOALS.map((g) => (
        <button
          key={g.id}
          type="button"
          role="radio"
          aria-checked={value === g.id}
          disabled={disabled}
          onClick={() => onChange(g.id)}
          className={cn(
            "rounded-xl border bg-card p-3 text-left shadow-card transition-all disabled:opacity-60",
            value === g.id ? "border-primary ring-2 ring-primary/20" : "hover:border-primary/40",
          )}
        >
          <p className="text-sm font-semibold text-foreground">{g.title}</p>
          <p className="text-xs text-muted-foreground">{g.text}</p>
        </button>
      ))}
    </div>
  );
}

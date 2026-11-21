import { Sparkles, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tells the user exactly which engine produces the results on a page. */
export function EngineNotice({
  engine,
  children,
  className,
}: {
  engine: "ai" | "local" | "hybrid";
  children: React.ReactNode;
  className?: string;
}) {
  const label =
    engine === "ai" ? "Real AI · Google Gemini" : engine === "local" ? "Local engine · no AI" : "AI + local safeguards";
  const Icon = engine === "local" ? Cpu : Sparkles;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-card sm:flex-row sm:items-center sm:gap-3",
        className,
      )}
    >
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

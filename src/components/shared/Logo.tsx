import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-glow",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5 text-primary-foreground" fill="none" aria-hidden="true">
        <path d="M4 19V5l8 7 8-7v14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="18" r="1.8" fill="currentColor" />
      </svg>
    </div>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-tight">
        <div className={cn("font-display text-[15px] font-semibold", inverted ? "text-navy-foreground" : "text-foreground")}>
          IEEE Research Agent
        </div>
        <div className={cn("text-[11px]", inverted ? "text-navy-muted" : "text-muted-foreground")}>
          AI academic assistant
        </div>
      </div>
    </div>
  );
}

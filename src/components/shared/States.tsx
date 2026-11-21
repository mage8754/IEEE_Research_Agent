import { AlertTriangle, Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed bg-gradient-subtle px-6 py-12 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 font-sans text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ title, steps, className }: { title: string; steps?: string[]; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-12 text-center shadow-card", className)}>
      <div className="relative flex size-14 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/15" />
        <div className="flex size-12 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-glow">
          <Loader2 className="size-5 animate-spin" />
        </div>
      </div>
      <h3 className="mt-5 font-sans text-base font-semibold text-foreground">{title}</h3>
      {steps && (
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center", className)}>
      <AlertTriangle className="size-5 shrink-0 text-destructive" />
      <p className="flex-1 text-sm text-foreground">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
          <div>
            {title && <h2 className="font-sans text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

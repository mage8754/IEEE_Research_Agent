import { Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/shared/Logo";

const POINTS = [
  "IEEE-style reviewer feedback in minutes",
  "LaTeX-safe rewriting that never touches equations or citations",
  "Evidence-linked PDF summaries — no invented results",
];

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-hero p-10 lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
        <Link to="/" className="relative">
          <Logo inverted />
        </Link>
        <div className="relative mt-auto max-w-md">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-navy-muted">IEEE Research Agent</p>
          <h2 className="mt-3 text-4xl leading-tight font-semibold text-navy-foreground text-balance">
            Smarter Research. Better Writing. Stronger Publications.
          </h2>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-navy-foreground/85">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary-glow" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-10 text-xs text-navy-muted">
  © 2026 IEEE Research Agent | Designed & Developed by Magendran P.
</p>
      </aside>
      <main className="flex items-center justify-center bg-background px-5 py-10">
        <div className="w-full max-w-[400px] animate-fade-up">
          <Link to="/" className="mb-8 inline-block lg:hidden">
            <Logo />
          </Link>
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

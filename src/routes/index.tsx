import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/Logo";
import { useAuth } from "@/hooks/use-auth";
import { ALL_NAV } from "@/lib/nav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IEEE Research Agent — AI Academic Research Platform" },
      {
        name: "description",
        content:
          "Improve research papers with AI: grammar, academic writing, LaTeX-safe rewriting, PDF analysis, citation consistency and IEEE-style reviews.",
      },
      { property: "og:title", content: "IEEE Research Agent" },
      { property: "og:description", content: "Smarter Research. Better Writing. Stronger Publications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const MODULES = ALL_NAV.filter((n) => !["/dashboard", "/history", "/settings"].includes(n.to));

function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-gradient-hero">
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Logo inverted />
          <div className="flex items-center gap-2">
            {user ? (
              <Button variant="premium" asChild>
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="heroOutline" asChild className="hidden sm:inline-flex">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button variant="premium" asChild>
                  <Link to="/register">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </header>
        <div className="relative mx-auto max-w-6xl px-5 pt-14 pb-24 md:pt-20 md:pb-32">
          <div className="max-w-3xl animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-navy-foreground/15 bg-navy-foreground/5 px-3 py-1 text-xs text-navy-foreground/80">
              <Sparkles className="size-3.5 text-primary-glow" /> Powered by Google Gemini
            </span>
            <h1 className="mt-6 text-4xl leading-[1.08] font-semibold text-navy-foreground text-balance md:text-6xl">
              Smarter Research. Better Writing. Stronger Publications.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-navy-foreground/75">
              IEEE Research Agent helps engineering students and researchers polish manuscripts, analyze papers,
              validate citations and get reviewer-style feedback — without ever inventing results.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button variant="premium" size="xl" asChild>
                <Link to={user ? "/dashboard" : "/register"}>
                  Start your research <ArrowRight />
                </Link>
              </Button>
              {!user && (
                <Button variant="heroOutline" size="xl" asChild>
                  <Link to="/login">I already have an account</Link>
                </Button>
              )}
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-foreground/70">
              {["Evidence-linked summaries", "LaTeX never modified", "Citations checked locally, not faked"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary-glow" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-14 max-w-6xl px-5 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m, i) => (
            <Link
              key={m.to}
              to={m.to}
              className="group rounded-xl border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elevated animate-fade-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <m.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-sans text-[15px] font-semibold text-foreground">{m.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
            </Link>
          ))}
          <div className="flex flex-col justify-between rounded-xl bg-navy p-5 text-navy-foreground shadow-card">
            <ShieldCheck className="size-6 text-primary-glow" />
            <p className="mt-4 text-sm text-navy-foreground/80">
              Honest by design: every AI claim links back to a quote in your document, and anything unverifiable is
              labelled.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-sm text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} IEEE Research Agent</span>
          <span>Smarter Research. Better Writing. Stronger Publications.</span>
        </div>
      </footer>
    </div>
  );
}

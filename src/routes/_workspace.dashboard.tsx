import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { Activity, ArrowRight, FileText, Files, LayoutDashboard, Quote, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { StatCard } from "@/components/shared/StatCard";
import { EmptyState, ErrorState, Panel } from "@/components/shared/States";
import { useAuth } from "@/hooks/use-auth";
import { activityByDay, activityQuery, computeStats, profileQuery, RESEARCH_MODULES } from "@/lib/activity";
import { MODULES } from "@/lib/ai/schemas";
import { ALL_NAV, MODULE_ICON, MODULE_ROUTE } from "@/lib/nav";

export const Route = createFileRoute("/_workspace/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — IEEE Research Agent" },
      { name: "description", content: "Your research activity, writing improvements and citation checks at a glance." },
      { property: "og:title", content: "Dashboard — IEEE Research Agent" },
      { property: "og:description", content: "Your research activity at a glance." },
    ],
  }),
  component: Dashboard,
});

const chartConfig = {
  writing: { label: "Writing", color: "var(--chart-1)" },
  research: { label: "Research", color: "var(--chart-2)" },
} satisfies ChartConfig;

const QUICK = ALL_NAV.filter((n) => !["/dashboard", "/history", "/settings"].includes(n.to));

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Dashboard() {
  const { user } = useAuth();
  const { data: profile } = useQuery(profileQuery(user?.id));
  const { data: rows, isLoading, error, refetch } = useQuery(activityQuery(user?.id));
  const stats = computeStats(rows ?? []);
  const chart = activityByDay(rows ?? []);
  const first = (profile?.full_name || "").split(" ")[0] || "researcher";
  const documents = (rows ?? []).filter((r) => RESEARCH_MODULES.includes(r.module)).slice(0, 5);

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl bg-gradient-hero p-6 shadow-elevated md:p-8 animate-fade-up">
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_right,black,transparent_70%)]" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-navy-muted">{greeting()},</p>
            <h1 className="mt-1 text-3xl font-semibold text-navy-foreground md:text-4xl">{first}</h1>
            <p className="mt-2 max-w-xl text-sm text-navy-foreground/75">
              Smarter Research. Better Writing. Stronger Publications. Pick up where you left off or start a new analysis.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="premium" asChild>
              <Link to="/reviewer">
                <Sparkles /> Review a manuscript
              </Link>
            </Button>
            <Button variant="heroOutline" asChild>
              <Link to="/pdf-analyzer">Analyze a PDF</Link>
            </Button>
          </div>
        </div>
      </section>

      {error && <ErrorState message="We couldn't load your activity." onRetry={() => refetch()} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[128px] rounded-xl" />)
          : [
              <StatCard key="p" icon={Files} label="Papers analyzed" value={stats.papers} hint="PDF, literature and reviewer runs" />,
              <StatCard key="w" icon={Wand2} label="Writing improvements" value={stats.improvements} hint="Grammar fixes and rewrites suggested" />,
              <StatCard key="c" icon={Quote} label="Citation issues detected" value={stats.citationIssues} hint="Missing, unused, duplicate, incomplete" />,
              <StatCard key="s" icon={Activity} label="Total sessions" value={stats.sessions} hint="All analyses you have run" />,
            ]}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Research productivity" description="Analyses per day · last 14 days">
          {isLoading ? (
            <Skeleton className="h-[260px] w-full" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <AreaChart data={chart} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fillWriting" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-writing)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-writing)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillResearch" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-research)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-research)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="writing" type="monotone" stroke="var(--color-writing)" fill="url(#fillWriting)" strokeWidth={2} />
                <Area dataKey="research" type="monotone" stroke="var(--color-research)" fill="url(#fillResearch)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          )}
        </Panel>

        <Panel title="Recent activity" actions={<Button variant="ghost" size="sm" asChild><Link to="/history">View all</Link></Button>}>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : rows && rows.length > 0 ? (
            <ul className="-my-2 divide-y">
              {rows.slice(0, 5).map((r) => {
                const Icon = MODULE_ICON[r.module] ?? FileText;
                return (
                  <li key={r.id} className="flex items-start gap-3 py-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {MODULES[r.module]} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={LayoutDashboard} title="No activity yet" description="Run your first analysis and it will appear here." className="py-8" />
          )}
        </Panel>
      </div>

      <div className="grid gap-6">
        <div>
          <h2 className="mb-3 font-sans text-sm font-semibold text-foreground">Quick actions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {QUICK.map((q) => (
              <Link key={q.to} to={q.to} className="group flex flex-col rounded-xl border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated">
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <q.icon className="size-4" />
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">{q.title}</p>
                <p className="text-xs text-muted-foreground">{q.description}</p>
              </Link>
            ))}
          </div>
        </div>
        <Panel title="Recent documents">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : documents.length > 0 ? (
            <ul className="space-y-2">
              {documents.map((d) => (
                <li key={d.id}>
                  <Link to={MODULE_ROUTE[d.module] ?? "/history"} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
                    <FileText className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{d.title}</span>
                    <Badge variant="muted">{MODULES[d.module]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Files} title="No documents yet" description="Analyzed papers and reviewed manuscripts show up here." className="py-8" />
          )}
        </Panel>
      </div>
    </>
  );
}

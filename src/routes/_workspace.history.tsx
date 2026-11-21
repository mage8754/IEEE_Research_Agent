import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowUpRight, FileText, History, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState, ErrorState } from "@/components/shared/States";
import { useAuth } from "@/hooks/use-auth";
import { activityQuery } from "@/lib/activity";
import { MODULES, type ModuleId } from "@/lib/ai/schemas";
import { MODULE_ICON, MODULE_ROUTE } from "@/lib/nav";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workspace/history")({
  head: () => ({
    meta: [
      { title: "Research History — IEEE Research Agent" },
      { name: "description", content: "Browse, search and manage every analysis you have run." },
      { property: "og:title", content: "Research History — IEEE Research Agent" },
      { property: "og:description", content: "All your past research analyses in one place." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: rows, isLoading, error, refetch } = useQuery(activityQuery(user?.id));
  const [filter, setFilter] = useState<ModuleId | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      (rows ?? []).filter(
        (r) =>
          (filter === "all" || r.module === filter) &&
          (!q || `${r.title} ${r.summary}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [rows, filter, q],
  );

  const remove = async (id: string) => {
    const { error: err } = await supabase.from("research_activity").delete().eq("id", id);
    if (err) {
      toast.error("Couldn't delete this entry.");
      return;
    }
    toast.success("Entry deleted");
    queryClient.invalidateQueries({ queryKey: ["activity"] });
  };

  return (
    <>
      <PageHeader icon={History} title="Research History" description="Every analysis you run is saved to your account. Search, filter or remove entries." />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles and summaries" className="h-10 bg-card pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...Object.keys(MODULES)] as (ModuleId | "all")[]).map((m) => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === m ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "all" ? "All" : MODULES[m]}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorState message="We couldn't load your history." onRetry={() => refetch()} />}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title={rows && rows.length > 0 ? "No matching entries" : "Your history is empty"}
          description={rows && rows.length > 0 ? "Try another search or filter." : "Run any analysis — it will be saved here automatically."}
          action={!rows?.length && <Button variant="premium" asChild><Link to="/grammar">Check your first paragraph</Link></Button>}
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const Icon = MODULE_ICON[r.module] ?? FileText;
            return (
              <li key={r.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card sm:flex-row sm:items-center">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-foreground">{r.title}</p>
                    <Badge variant="muted">{MODULES[r.module]}</Badge>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{r.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{format(new Date(r.created_at), "d MMM yyyy, HH:mm")}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={MODULE_ROUTE[r.module] ?? "/dashboard"}>Open module <ArrowUpRight /></Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Delete entry"><Trash2 /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                        <AlertDialogDescription>“{r.title}” will be removed from your history. This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(r.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

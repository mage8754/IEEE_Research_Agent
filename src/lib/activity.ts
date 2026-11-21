import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ModuleId } from "@/lib/ai/schemas";

export interface ActivityRow {
  id: string;
  module: ModuleId;
  title: string;
  summary: string;
  issues_found: number;
  improvements: number;
  created_at: string;
}

export const activityQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["activity", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ActivityRow[]> => {
      const { data, error } = await supabase
        .from("research_activity")
        .select("id, module, title, summary, issues_found, improvements, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

export const profileQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, institution, field_of_study")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? { full_name: "", institution: "", field_of_study: "" };
    },
  });

export const RESEARCH_MODULES: ModuleId[] = ["pdf", "reviewer", "literature"];
export const WRITING_MODULES: ModuleId[] = ["grammar", "writing", "humanizer", "latex", "latexcode"];

export function computeStats(rows: ActivityRow[]) {
  return {
    papers: rows.filter((r) => RESEARCH_MODULES.includes(r.module)).length,
    improvements: rows
      .filter((r) => WRITING_MODULES.includes(r.module))
      .reduce((sum, r) => sum + r.improvements, 0),
    citationIssues: rows
      .filter((r) => r.module === "citations")
      .reduce((sum, r) => sum + r.issues_found, 0),
    sessions: rows.length,
  };
}

/** Activity per day for the last `days` days (oldest first). */
export function activityByDay(rows: ActivityRow[], days = 14, now = new Date()) {
  const buckets: { date: string; label: string; writing: number; research: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    buckets.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      writing: 0,
      research: 0,
    });
  }
  for (const r of rows) {
    const d = new Date(r.created_at);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const b = buckets.find((x) => x.date === key);
    if (!b) continue;
    if (WRITING_MODULES.includes(r.module)) b.writing++;
    else b.research++;
  }
  return buckets;
}

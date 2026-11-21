import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { KeyRound, Loader2, LogOut, Settings, ShieldCheck, Sparkles, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Panel } from "@/components/shared/States";
import { useAuth } from "@/hooks/use-auth";
import { profileQuery } from "@/lib/activity";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_workspace/settings")({
  head: () => ({
    meta: [
      { title: "Settings — IEEE Research Agent" },
      { name: "description", content: "Manage your researcher profile, password, AI engine and data." },
      { property: "og:title", content: "Settings — IEEE Research Agent" },
      { property: "og:description", content: "Profile, account and data settings." },
    ],
  }),
  component: SettingsPage,
});

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  institution: z.string().trim().max(150),
  field_of_study: z.string().trim().max(150),
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery(profileQuery(user?.id));
  const [form, setForm] = useState({ full_name: "", institution: "", field_of_study: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name, institution: profile.institution, field_of_study: profile.field_of_study });
  }, [profile]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({ id: user!.id, ...parsed.data });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save your profile.");
      return;
    }
    toast.success("Profile saved");
    queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = !pw.current
      ? "Enter your current password"
      : pw.next.length < 8
        ? "New password must be at least 8 characters"
        : pw.next !== pw.confirm
          ? "New passwords do not match"
          : null;
    if (problem) {
      setPwError(problem);
      return;
    }
    setPwError(null);
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next, current_password: pw.current } as { password: string });
    setPwSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPw({ current: "", next: "", confirm: "" });
    toast.success("Password updated");
  };

  const clearHistory = async () => {
    const { error } = await supabase.from("research_activity").delete().eq("user_id", user!.id);
    if (error) {
      toast.error("Couldn't clear your history.");
      return;
    }
    toast.success("History cleared");
    queryClient.invalidateQueries({ queryKey: ["activity"] });
  };

  const isEmailUser = user?.app_metadata?.provider === "email";

  return (
    <>
      <PageHeader icon={Settings} title="Settings" description="Manage your researcher profile, account security, AI engine and data." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Researcher profile" actions={<UserRound className="size-4 text-primary" />}>
          <form onSubmit={saveProfile} className="space-y-4" noValidate>
            {([
              ["full_name", "Full name", "Priya Sharma"],
              ["institution", "Institution", "Your university or lab"],
              ["field_of_study", "Field of study", "e.g. Computer Science Engineering"],
            ] as const).map(([k, label, ph]) => (
              <div key={k} className="space-y-1.5">
                <Label htmlFor={k}>{label}</Label>
                <Input id={k} value={form[k]} placeholder={ph} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
                {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <Button type="submit" variant="premium" disabled={saving}>{saving && <Loader2 className="animate-spin" />}Save profile</Button>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title="AI engine" actions={<Sparkles className="size-4 text-primary" />}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Google Gemini 3.8 Flash</p>
                <p className="text-xs text-muted-foreground">Served securely through Lovable AI. No API keys are stored in your browser.</p>
              </div>
              <Badge variant="success">Connected</Badge>
            </div>
            <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-success" />Citation checks and LaTeX detection run locally — no AI involved.</li>
              <li className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-success" />AI findings are linked to quotes and checked against your text.</li>
            </ul>
          </Panel>

          {isEmailUser && (
            <Panel title="Change password" actions={<KeyRound className="size-4 text-primary" />}>
              <form onSubmit={changePassword} className="space-y-3" noValidate>
                <Input type="password" placeholder="Current password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input type="password" placeholder="New password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
                  <Input type="password" placeholder="Confirm new password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
                </div>
                {pwError && <p className="text-xs text-destructive">{pwError}</p>}
                <Button type="submit" variant="outline" disabled={pwSaving}>{pwSaving && <Loader2 className="animate-spin" />}Update password</Button>
              </form>
            </Panel>
          )}

          <Panel title="Data & session">
            <div className="flex flex-wrap gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive"><Trash2 />Clear research history</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear all research history?</AlertDialogTitle>
                    <AlertDialogDescription>Every saved analysis will be permanently deleted and your dashboard statistics will reset.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearHistory}>Delete everything</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="ghost" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
                <LogOut />Sign out
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

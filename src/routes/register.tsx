import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { OrDivider, SocialButtons } from "@/components/auth/SocialButtons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — IEEE Research Agent" },
      { name: "description", content: "Create your free IEEE Research Agent account." },
      { property: "og:title", content: "Create account — IEEE Research Agent" },
      { property: "og:description", content: "Start writing stronger research papers with AI." },
    ],
  }),
  component: RegisterPage,
});

const schema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(100),
    institution: z.string().trim().max(150).optional(),
    email: z.string().trim().email("Enter a valid email address").max(255),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(72)
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/\d/, "Include at least one number"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

function RegisterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({ fullName: "", institution: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: parsed.data.fullName, institution: parsed.data.institution ?? "" },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) navigate({ to: "/dashboard" });
    else setSent(true);
  };

  if (sent) {
    return (
      <AuthShell title="Confirm your email" subtitle={`We sent a confirmation link to ${form.email}.`}>
        <div className="flex flex-col items-start gap-4 rounded-xl border bg-card p-5 shadow-card">
          <MailCheck className="size-6 text-primary" />
          <p className="text-sm text-muted-foreground">Click the link in the email to activate your account, then sign in.</p>
          <Button variant="outline" asChild>
            <Link to="/login">Go to sign in</Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  const field = (k: keyof typeof form, label: string, type = "text", extra: Record<string, string> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} type={type} value={form[k]} onChange={set(k)} className="h-11" {...extra} />
      {errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <AuthShell title="Create your account" subtitle="Join researchers writing stronger publications.">
      <SocialButtons onSignedIn={() => navigate({ to: "/dashboard" })} />
      <OrDivider />
      <form onSubmit={submit} className="space-y-4" noValidate>
        {field("fullName", "Full name", "text", { autoComplete: "name", placeholder: "Priya Sharma" })}
        {field("institution", "Institution (optional)", "text", { placeholder: "Your university or lab" })}
        {field("email", "Email", "email", { autoComplete: "email", placeholder: "you@university.edu" })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("password", "Password", "password", { autoComplete: "new-password" })}
          {field("confirm", "Confirm password", "password", { autoComplete: "new-password" })}
        </div>
        <Button type="submit" variant="premium" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}

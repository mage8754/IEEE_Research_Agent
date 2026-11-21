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

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — IEEE Research Agent" },
      { name: "description", content: "Sign in to your IEEE Research Agent workspace." },
      { property: "og:title", content: "Sign in — IEEE Research Agent" },
      { property: "og:description", content: "Access your AI research workspace." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(1, "Enter your password"),
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "forgot" | "sent">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"email" | "password", string>>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard", replace: true });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "forgot") {
      const parsed = schema.shape.email.safeParse(email);
      if (!parsed.success) {
        setErrors({ email: parsed.error.issues[0]!.message });
        return;
      }
      setBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      setMode("sent");
      return;
    }
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
      return;
    }
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  };

  if (mode === "sent") {
    return (
      <AuthShell title="Check your inbox" subtitle={`We sent a password reset link to ${email}.`}>
        <div className="flex flex-col items-start gap-4 rounded-xl border bg-card p-5 shadow-card">
          <MailCheck className="size-6 text-primary" />
          <p className="text-sm text-muted-foreground">Open the link in the email to choose a new password.</p>
          <Button variant="outline" onClick={() => setMode("signin")}>Back to sign in</Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={mode === "forgot" ? "Reset your password" : "Welcome back"}
      subtitle={mode === "forgot" ? "Enter your email and we'll send you a reset link." : "Sign in to continue your research."}
    >
      {mode === "signin" && (
        <>
          <SocialButtons onSignedIn={() => navigate({ to: "/dashboard" })} />
          <OrDivider />
        </>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@university.edu" className="h-11" />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
        {mode === "signin" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setMode("forgot")}>
                Forgot password?
              </button>
            </div>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
        )}
        <Button type="submit" variant="premium" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {mode === "forgot" ? "Send reset link" : "Sign in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "forgot" ? (
          <button className="font-medium text-primary hover:underline" onClick={() => setMode("signin")}>Back to sign in</button>
        ) : (
          <>
            New to IEEE Research Agent?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">Create an account</Link>
          </>
        )}
      </p>
    </AuthShell>
  );
}

import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useAuth } from "@/hooks/use-auth";
import { profileQuery } from "@/lib/activity";
import { ALL_NAV } from "@/lib/nav";

export const Route = createFileRoute("/_workspace")({
  component: WorkspaceLayout,
});

function WorkspaceLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: profile } = useQuery(profileQuery(user?.id));

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const current = ALL_NAV.find((n) => n.to === pathname);
  const name = profile?.full_name || (user.user_metadata?.["full_name"] as string | undefined) || "";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar
          name={name}
          email={user.email ?? ""}
          onSignOut={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
        />
        <SidebarInset className="bg-background">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-6">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border" />
            <nav className="flex min-w-0 items-center gap-1.5 text-sm">
              <Link to="/dashboard" className="hidden text-muted-foreground hover:text-foreground sm:inline">
                Workspace
              </Link>
              <span className="hidden text-muted-foreground sm:inline">/</span>
              <span className="truncate font-medium text-foreground">{current?.title ?? "Workspace"}</span>
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
                <span className="size-1.5 rounded-full bg-success" />
                <Sparkles className="size-3.5 text-primary" />
                Gemini connected
              </span>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

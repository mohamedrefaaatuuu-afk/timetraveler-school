import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    // client-side guard; SSR returns and useAuth handles real check
    if (typeof window !== "undefined") {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" dir="rtl">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/login";
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30" dir="rtl">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 p-4 md:p-6 overflow-x-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

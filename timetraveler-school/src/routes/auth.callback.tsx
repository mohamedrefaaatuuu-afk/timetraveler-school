import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) toast.error(error.message);
      navigate({ to: data.session ? "/dashboard" : "/login" });
    });
  }, [navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center" dir="rtl">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

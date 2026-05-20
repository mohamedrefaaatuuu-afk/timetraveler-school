import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-helpers";

export const Route = createFileRoute("/_app/notifications")({ component: NotificationsPage });

interface Notif {
  id: string; user_id: string; title: string; message: string | null; type: string;
  link: string | null; created_at: string; read_at: string | null;
}

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data as Notif[] ?? [],
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).is("read_at", null); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); toast.success("تم تعليم الكل كمقروء"); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("notifications").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = rows.filter((r) => !r.read_at).length;

  return (
    <div>
      <PageHeader title="الإشعارات" description={`${unread} غير مقروء من ${rows.length}`} action={
        unread > 0 && <Button variant="outline" onClick={() => markAll.mutate()}><Check className="ms-2 h-4 w-4" /> تعليم الكل كمقروء</Button>
      } />
      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
        : rows.length === 0 ? <div className="p-12 text-center text-muted-foreground"><Bell className="h-12 w-12 mx-auto mb-3 opacity-40" /> لا توجد إشعارات</div>
        : <ul className="divide-y">
          {rows.map((n) => (
            <li key={n.id} className={`p-4 flex items-start gap-3 hover:bg-accent/30 ${!n.read_at ? "bg-accent/20" : ""}`}>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${!n.read_at ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                <Bell className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{n.title}</h4>
                  {!n.read_at && <Badge variant="default" className="text-[10px]">جديد</Badge>}
                </div>
                {n.message && <p className="text-sm text-muted-foreground mt-1">{n.message}</p>}
                <p className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("ar-EG")}</p>
              </div>
              <div className="flex gap-1">
                {!n.read_at && <Button variant="ghost" size="icon" onClick={() => markRead.mutate(n.id)}><Check className="h-4 w-4" /></Button>}
                <Button variant="ghost" size="icon" onClick={() => del.mutate(n.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
        </ul>}
      </CardContent></Card>
    </div>
  );
}

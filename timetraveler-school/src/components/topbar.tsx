import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, LogOut, Moon, Sun, User as UserIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function Topbar() {
  const { profile, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setDark(isDark);
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true })
        .eq("user_id", user.id).is("read_at", null);
      setUnread(count ?? 0);
    };
    load();
    const ch = supabase.channel("notif-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const initials = (profile?.full_name ?? "م").slice(0, 2);

  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background/80 backdrop-blur-md flex items-center px-4 gap-3 no-print">
      <SidebarTrigger />
      <div className="flex-1" />
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="تبديل الوضع">
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" asChild className="relative" aria-label="الإشعارات">
        <Link to="/notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -left-1 h-5 min-w-5 px-1 text-[10px]">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 px-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline text-sm">{profile?.full_name ?? "حسابي"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{profile?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
            <UserIcon className="ms-2 h-4 w-4" /> الإعدادات
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
            <LogOut className="ms-2 h-4 w-4" /> تسجيل الخروج
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

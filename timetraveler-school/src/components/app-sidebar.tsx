import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, BookOpen, School, DoorOpen, CalendarDays,
  Wand2, ShieldAlert, UserCheck, BarChart3, Settings, FileText, Bell, Brain,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";

const groups = [
  {
    label: "الرئيسية",
    items: [
      { title: "لوحة التحكم", url: "/dashboard", icon: LayoutDashboard },
      { title: "الإشعارات", url: "/notifications", icon: Bell },
    ],
  },
  {
    label: "البيانات الأكاديمية",
    items: [
      { title: "المعلمون", url: "/teachers", icon: Users },
      { title: "المواد", url: "/subjects", icon: BookOpen },
      { title: "الفصول", url: "/classes", icon: School },
      { title: "القاعات", url: "/classrooms", icon: DoorOpen },
      { title: "متطلبات الحصص", url: "/lessons", icon: FileText },
    ],
  },
  {
    label: "الجدولة",
    items: [
      { title: "الجدول", url: "/schedule", icon: CalendarDays },
      { title: "توليد الجدول", url: "/generator", icon: Wand2 },
      { title: "القيود", url: "/constraints", icon: ShieldAlert },
      { title: "الاحتياطي", url: "/substitutions", icon: UserCheck },
    ],
  },
  {
    label: "التقارير",
    items: [
      { title: "الإحصائيات", url: "/analytics", icon: BarChart3 },
      { title: "التقارير والطباعة", url: "/reports", icon: FileText },
      { title: "تحليل الذكاء الاصطناعي", url: "/ai-analyzer", icon: Brain },
    ],
  },
  {
    label: "النظام",
    items: [
      { title: "الإعدادات", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { profile } = useAuth();

  return (
    <Sidebar collapsible="icon" side="right">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold shadow-glow">
            ج
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold">جدولة برو</span>
              <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                {profile?.full_name ?? "نظام إدارة الجداول"}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            {!collapsed && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const active = path === item.url || path.startsWith(item.url + "/");
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                        <Link to={item.url} className="flex items-center gap-3">
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t">
        {!collapsed && (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            الإصدار 1.0
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

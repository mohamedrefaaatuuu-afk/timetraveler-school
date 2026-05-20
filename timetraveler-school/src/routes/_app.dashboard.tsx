import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, BookOpen, School, DoorOpen, CalendarDays, AlertTriangle,
  UserCheck, TrendingUp, Activity,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { DAYS, dayLabel } from "@/lib/constants";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { schoolId, profile } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [t, s, c, r, e, sub] = await Promise.all([
        supabase.from("teachers").select("*", { count: "exact", head: true }).eq("school_id", schoolId!),
        supabase.from("subjects").select("*", { count: "exact", head: true }).eq("school_id", schoolId!),
        supabase.from("classes").select("*", { count: "exact", head: true }).eq("school_id", schoolId!),
        supabase.from("classrooms").select("*", { count: "exact", head: true }).eq("school_id", schoolId!),
        supabase.from("schedule_entries").select("*", { count: "exact", head: true }).eq("school_id", schoolId!),
        supabase.from("substitutions").select("*", { count: "exact", head: true }).eq("school_id", schoolId!).eq("absence_date", today),
      ]);
      return {
        teachers: t.count ?? 0, subjects: s.count ?? 0, classes: c.count ?? 0,
        classrooms: r.count ?? 0, entries: e.count ?? 0, subsToday: sub.count ?? 0,
      };
    },
  });

  const { data: dist } = useQuery({
    queryKey: ["dashboard-dist", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from("schedule_entries")
        .select("day, subject:subjects(name, color), teacher:teachers(full_name)")
        .eq("school_id", schoolId!);
      const byDay = DAYS.map((d) => ({ day: d.short, count: (data ?? []).filter((e) => e.day === d.value).length }));
      const subj: Record<string, { name: string; value: number; color: string }> = {};
      const teach: Record<string, number> = {};
      (data ?? []).forEach((e) => {
        const s = e.subject as { name: string; color: string } | null;
        const tn = (e.teacher as { full_name: string } | null)?.full_name;
        if (s) { const k = s.name; subj[k] = subj[k] ?? { name: k, value: 0, color: s.color }; subj[k].value++; }
        if (tn) { teach[tn] = (teach[tn] ?? 0) + 1; }
      });
      const topTeachers = Object.entries(teach).map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value).slice(0, 6);
      return { byDay, subjects: Object.values(subj), topTeachers };
    },
  });

  const { data: conflicts } = useQuery({
    queryKey: ["dashboard-conflicts", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from("schedule_entries")
        .select("teacher_id, classroom_id, day, period_no").eq("school_id", schoolId!);
      const map: Record<string, number> = {};
      let teacherConf = 0, roomConf = 0;
      (data ?? []).forEach((e) => {
        const k = `T:${e.teacher_id}:${e.day}:${e.period_no}`;
        map[k] = (map[k] ?? 0) + 1; if (map[k] === 2) teacherConf++;
        if (e.classroom_id) {
          const r = `R:${e.classroom_id}:${e.day}:${e.period_no}`;
          map[r] = (map[r] ?? 0) + 1; if (map[r] === 2) roomConf++;
        }
      });
      return { teacherConf, roomConf, total: teacherConf + roomConf };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["dashboard-recent", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*")
        .eq("school_id", schoolId!).order("created_at", { ascending: false }).limit(8);
      return data ?? [];
    },
  });

  const cards = [
    { title: "المعلمون", value: stats?.teachers ?? 0, icon: Users, color: "from-blue-500 to-blue-600", href: "/teachers" },
    { title: "المواد", value: stats?.subjects ?? 0, icon: BookOpen, color: "from-emerald-500 to-emerald-600", href: "/subjects" },
    { title: "الفصول", value: stats?.classes ?? 0, icon: School, color: "from-violet-500 to-violet-600", href: "/classes" },
    { title: "القاعات", value: stats?.classrooms ?? 0, icon: DoorOpen, color: "from-amber-500 to-amber-600", href: "/classrooms" },
    { title: "الحصص في الجدول", value: stats?.entries ?? 0, icon: CalendarDays, color: "from-cyan-500 to-cyan-600", href: "/schedule" },
    { title: "احتياطي اليوم", value: stats?.subsToday ?? 0, icon: UserCheck, color: "from-pink-500 to-pink-600", href: "/substitutions" },
    { title: "التعارضات", value: conflicts?.total ?? 0, icon: AlertTriangle, color: "from-rose-500 to-rose-600", href: "/schedule" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">مرحبًا، {profile?.full_name ?? "بك"} 👋</h1>
        <p className="text-muted-foreground mt-1">نظرة شاملة على نظام الجدولة في مدرستك</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map((c) => (
          <Link key={c.title} to={c.href as never} className="block">
            <Card className="hover:shadow-elegant transition-shadow cursor-pointer overflow-hidden">
              <CardContent className="p-4">
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center text-white shadow-md mb-3`}>
                  <c.icon className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">{c.title}</p>
                <p className="text-2xl font-bold mt-0.5">{c.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> توزيع الحصص حسب اليوم</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dist?.byDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip contentStyle={{ direction: "rtl" }} />
                <Bar dataKey="count" name="عدد الحصص" fill="oklch(0.55 0.20 250)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>توزيع المواد</CardTitle></CardHeader>
          <CardContent>
            {(dist?.subjects?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">لا توجد حصص بعد</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={dist?.subjects} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {(dist?.subjects ?? []).map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ direction: "rtl" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> أعلى المعلمين ضغطًا</CardTitle></CardHeader>
          <CardContent>
            {(dist?.topTeachers?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dist?.topTeachers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip contentStyle={{ direction: "rtl" }} />
                  <Bar dataKey="value" name="عدد الحصص" fill="oklch(0.65 0.18 155)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> آخر النشاطات</CardTitle></CardHeader>
          <CardContent>
            {(recent?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">لا توجد نشاطات بعد</p>
            ) : (
              <ul className="space-y-2">
                {recent!.map((r) => (
                  <li key={r.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{r.action}</p>
                      {r.entity && <p className="text-xs text-muted-foreground">{r.entity}</p>}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(r.created_at).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

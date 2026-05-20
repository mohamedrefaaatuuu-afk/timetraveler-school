import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { DAYS } from "@/lib/constants";
import { PageHeader } from "@/components/page-helpers";

export const Route = createFileRoute("/_app/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  const { schoolId } = useAuth();

  const { data } = useQuery({
    queryKey: ["analytics", schoolId], enabled: !!schoolId,
    queryFn: async () => {
      const { data: entries } = await supabase.from("schedule_entries")
        .select("day, period_no, teacher_id, subject_id, classroom_id, class_id, subject:subjects(name,color), teacher:teachers(full_name), classroom:classrooms(name), class:classes(name)")
        .eq("school_id", schoolId!);
      const e = entries ?? [];

      const byDay = DAYS.map((d) => ({ day: d.short, count: e.filter((x) => x.day === d.value).length }));
      const byPeriod: { period: string; count: number }[] = [];
      const periodMap: Record<number, number> = {};
      e.forEach((x) => { periodMap[x.period_no] = (periodMap[x.period_no] ?? 0) + 1; });
      Object.entries(periodMap).sort(([a], [b]) => +a - +b).forEach(([p, c]) => byPeriod.push({ period: `ح${p}`, count: c }));

      const subj: Record<string, { name: string; value: number; color: string }> = {};
      const teach: Record<string, number> = {};
      const room: Record<string, number> = {};
      const klass: Record<string, number> = {};
      e.forEach((x) => {
        const s = x.subject as { name: string; color: string } | null;
        const t = (x.teacher as { full_name: string } | null)?.full_name;
        const r = (x.classroom as { name: string } | null)?.name;
        const c = (x.class as { name: string } | null)?.name;
        if (s) { subj[s.name] = subj[s.name] ?? { name: s.name, value: 0, color: s.color }; subj[s.name].value++; }
        if (t) teach[t] = (teach[t] ?? 0) + 1;
        if (r) room[r] = (room[r] ?? 0) + 1;
        if (c) klass[c] = (klass[c] ?? 0) + 1;
      });
      const topTeachers = Object.entries(teach).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
      const topRooms = Object.entries(room).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
      const byClass = Object.entries(klass).map(([name, value]) => ({ name, value }));

      return { byDay, byPeriod, subjects: Object.values(subj), topTeachers, topRooms, byClass, total: e.length };
    },
  });

  return (
    <div>
      <PageHeader title="الإحصائيات والتحليلات" description={`إجمالي ${data?.total ?? 0} حصة موزّعة`} />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle>توزيع الحصص حسب اليوم</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.byDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip contentStyle={{ direction: "rtl" }} />
                <Bar dataKey="count" name="حصص" fill="oklch(0.55 0.2 250)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>توزيع حسب رقم الحصة</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.byPeriod ?? []}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="period" /><YAxis /><Tooltip contentStyle={{ direction: "rtl" }} />
                <Bar dataKey="count" name="حصص" fill="oklch(0.65 0.18 155)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>توزيع المواد</CardTitle></CardHeader>
          <CardContent>
            {(data?.subjects.length ?? 0) === 0 ? <p className="text-muted-foreground text-center py-8">لا بيانات</p> :
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data?.subjects} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} label>
                  {(data?.subjects ?? []).map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip contentStyle={{ direction: "rtl" }} /><Legend />
              </PieChart>
            </ResponsiveContainer>}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>أعلى المعلمين ضغطًا</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.topTeachers ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={100} /><Tooltip contentStyle={{ direction: "rtl" }} />
                <Bar dataKey="value" name="حصص" fill="oklch(0.6 0.2 30)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>استخدام القاعات</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.topRooms ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={100} /><Tooltip contentStyle={{ direction: "rtl" }} />
                <Bar dataKey="value" name="حصص" fill="oklch(0.65 0.16 200)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>حصص الفصول</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data?.byClass ?? []}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip contentStyle={{ direction: "rtl" }} />
                <Bar dataKey="value" name="حصص" fill="oklch(0.6 0.2 300)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logAction } from "@/lib/school";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Wand2, AlertTriangle, CheckCircle2, Gauge, Activity } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-helpers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { DayOfWeek } from "@/lib/constants";
import { runEngine, type EngineResult, type ProgressEvent } from "@/lib/scheduling/engine";

export const Route = createFileRoute("/_app/generator")({ component: GeneratorPage });

function GeneratorPage() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [preserveLocked, setPreserveLocked] = useState(true);
  const [qualityThreshold, setQualityThreshold] = useState(80);
  const [generations, setGenerations] = useState(40);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [result, setResult] = useState<(EngineResult & { missedLabeled: { class_id: string; subject_id: string; missing: number }[] }) | null>(null);

  const run = useMutation({
    mutationFn: async () => {
      setProgress({ phase: "load", progress: 0, message: "جاري تحميل البيانات..." });
      const [settingsR, classesR, teachersR, reqsR, unavR, lockedR, subjMap, classMap] = await Promise.all([
        supabase.from("school_settings").select("*").eq("school_id", schoolId!).maybeSingle(),
        supabase.from("classes").select("id, daily_lessons").eq("school_id", schoolId!),
        supabase.from("teachers").select("id, max_weekly_lessons, max_daily_lessons, working_days").eq("school_id", schoolId!),
        supabase.from("class_subjects").select("class_id, subject_id, teacher_id, weekly_count, double_period, subjects(priority)").eq("school_id", schoolId!),
        supabase.from("teacher_unavailability").select("teacher_id, day, period_no, teachers!inner(school_id)").eq("teachers.school_id", schoolId!),
        supabase.from("schedule_entries").select("*").eq("school_id", schoolId!).eq("is_locked", true),
        supabase.from("subjects").select("id, name").eq("school_id", schoolId!),
        supabase.from("classes").select("id, name").eq("school_id", schoolId!),
      ]);
      if (!settingsR.data) throw new Error("لا توجد إعدادات للمدرسة");

      const requirements = (reqsR.data ?? []).map((r: { class_id: string; subject_id: string; teacher_id: string | null; weekly_count: number; double_period: boolean; subjects?: { priority: number } | null }) => ({
        class_id: r.class_id, subject_id: r.subject_id, teacher_id: r.teacher_id,
        weekly_count: r.weekly_count, double_period: r.double_period,
        priority: r.subjects?.priority ?? 5,
      }));

      const res = await runEngine({
        schoolId: schoolId!,
        workingDays: (settingsR.data.working_days as DayOfWeek[]) ?? ["sunday","monday","tuesday","wednesday","thursday"],
        periodsPerDay: settingsR.data.periods_per_day,
        classes: classesR.data ?? [],
        teachers: (teachersR.data ?? []).map((t) => ({ ...t, working_days: t.working_days as DayOfWeek[] })),
        unavailability: (unavR.data ?? []).map((u) => ({ teacher_id: u.teacher_id, day: u.day as DayOfWeek, period_no: u.period_no })),
        requirements,
        locked: (lockedR.data ?? []).map((l) => ({ id: l.id, class_id: l.class_id, day: l.day as DayOfWeek, period_no: l.period_no, teacher_id: l.teacher_id, subject_id: l.subject_id, classroom_id: l.classroom_id })),
        options: {
          backtrackingTimeoutMs: 5000,
          geneticGenerations: generations,
          geneticPopulation: 20,
          localSearchIterations: 1500,
          qualityThreshold,
          maxRetries: 1,
          onProgress: (p) => setProgress(p),
        },
      });

      // Persist atomically
      if (!preserveLocked) {
        await supabase.from("schedule_entries").delete().eq("school_id", schoolId!);
      } else {
        await supabase.from("schedule_entries").delete().eq("school_id", schoolId!).eq("is_locked", false);
      }
      const toInsert = res.entries.filter((e) => !e.is_locked);
      if (toInsert.length) {
        const rows = toInsert.map((e) => ({ ...e, school_id: schoolId! }));
        const { error } = await supabase.from("schedule_entries").insert(rows as never);
        if (error) throw error;
      }
      await logAction("generate", "schedule", undefined, { placed: res.placed, quality: res.score.quality, missed: res.missed.length });

      const subjectsById = new Map((subjMap.data ?? []).map((s) => [s.id, s.name]));
      const classesById = new Map((classMap.data ?? []).map((c) => [c.id, c.name]));
      const missedLabeled = res.missed.map((m) => ({ ...m, subject_id: subjectsById.get(m.subject_id) ?? m.subject_id, class_id: classesById.get(m.class_id) ?? m.class_id }));
      return { ...res, missedLabeled };
    },
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ["schedule"] });
      toast.success(`تم — جودة ${r.score.quality}% بـ ${r.placed} حصة`);
    },
    onError: (e: Error) => { setProgress(null); toast.error(e.message); },
  });

  return (
    <div>
      <PageHeader title="محرّك الجدولة الذكي" description="Backtracking ذكي + خوارزمية جينية + بحث محلي — جودة قابلة للقياس" />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Wand2 className="h-5 w-5 text-primary" /> إعدادات المحرك</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox id="lock" checked={preserveLocked} onCheckedChange={(v) => setPreserveLocked(!!v)} />
              <Label htmlFor="lock">الحفاظ على الحصص المقفلة</Label>
            </div>
            <div>
              <Label>حد الجودة المقبول ({qualityThreshold}%)</Label>
              <Slider value={[qualityThreshold]} onValueChange={([v]) => setQualityThreshold(v)} min={0} max={100} step={5} />
            </div>
            <div>
              <Label>أجيال الخوارزمية الجينية</Label>
              <Input type="number" value={generations} onChange={(e) => setGenerations(Math.max(10, Math.min(200, Number(e.target.value) || 40)))} />
            </div>
            <Alert>
              <AlertDescription>
                المحرك يطبّق قيوداً صلبة (تعارضات/حدود/توفر) وقيوداً ناعمة (فراغات، توازن، توزيع المواد) ويعيد المحاولة إن كانت الجودة دون الحد.
              </AlertDescription>
            </Alert>
            <Button onClick={() => run.mutate()} disabled={run.isPending} size="lg" className="w-full">
              {run.isPending ? "جاري التوليد..." : <><Wand2 className="ms-2 h-4 w-4" /> ابدأ التوليد</>}
            </Button>
            {run.isPending && progress && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground"><span>{progress.message ?? progress.phase}</span><span>{Math.round(progress.progress * 100)}%</span></div>
                <Progress value={progress.progress * 100} />
                {progress.bestScore !== undefined && <p className="text-xs text-muted-foreground">أفضل نتيجة حتى الآن: {progress.bestScore}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" /> النتيجة</CardTitle></CardHeader>
          <CardContent>
            {!result ? <p className="text-sm text-muted-foreground">شغّل التوليد لعرض النتائج</p> : (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1"><span>الجودة</span><span className="font-bold">{result.score.quality}%</span></div>
                  <Progress value={result.score.quality} />
                  <p className="text-xs text-muted-foreground mt-1">النقاط {result.score.total} من {result.score.base}</p>
                </div>
                <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-5 w-5" /> <span className="font-semibold">{result.placed}</span> حصة موضوعة</div>
                {result.missedLabeled.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-amber-600 mb-2"><AlertTriangle className="h-5 w-5" /> <span className="font-semibold">{result.missedLabeled.length}</span> متطلب لم يكتمل</div>
                    <ul className="text-xs space-y-1 max-h-40 overflow-auto">
                      {result.missedLabeled.map((m, i) => (
                        <li key={i} className="border-b pb-1">{m.class_id} — {m.subject_id} <span className="text-muted-foreground">(نقص {m.missing})</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium"><Activity className="h-4 w-4" /> تفاصيل العقوبات</div>
                  <ul className="text-xs space-y-1">
                    {result.score.penalties.filter((p) => p.count > 0).map((p) => (
                      <li key={p.code} className="flex justify-between border-b pb-1">
                        <span>{p.label}</span><span className="text-muted-foreground">{p.count}× = -{p.total}</span>
                      </li>
                    ))}
                    {result.score.penalties.every((p) => p.count === 0) && <li className="text-emerald-600">لا توجد عقوبات — جدول مثالي 🎉</li>}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

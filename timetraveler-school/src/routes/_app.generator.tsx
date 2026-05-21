import { useState, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Wand2, AlertTriangle, CheckCircle2, Gauge, Activity, Brain, Send, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-helpers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { DayOfWeek } from "@/lib/constants";
import { runEngine, type EngineResult, type ProgressEvent } from "@/lib/scheduling/engine";

export const Route = createFileRoute("/_app/generator")({ component: GeneratorPage });

interface AiMessage {
  role: "ai" | "user";
  text: string;
  type?: "info" | "warning" | "error" | "success" | "tip";
}

interface SchoolStats {
  classes: { id: string; name: string; daily_lessons: number }[];
  teachers: { id: string; full_name: string; max_weekly_lessons: number; max_daily_lessons: number }[];
  subjects: { id: string; name: string; weekly_lessons: number }[];
  requirements: { class_id: string; subject_id: string; teacher_id: string | null; weekly_count: number }[];
  settings: { periods_per_day: number; working_days: string[] } | null;
}

function analyzeSchoolData(stats: SchoolStats, qualityThreshold: number, generations: number): AiMessage[] {
  const msgs: AiMessage[] = [];
  const { classes, teachers, requirements, settings } = stats;

  msgs.push({ role: "ai", text: `📊 تحليل بيانات المدرسة:`, type: "info" });

  if (classes.length === 0) {
    msgs.push({ role: "ai", text: "❌ لا توجد فصول دراسية. أضف الفصول أولاً من صفحة الفصول.", type: "error" });
    return msgs;
  }
  if (teachers.length === 0) {
    msgs.push({ role: "ai", text: "❌ لا يوجد معلمون. أضف المعلمين أولاً من صفحة المعلمين.", type: "error" });
    return msgs;
  }
  if (requirements.length === 0) {
    msgs.push({ role: "ai", text: "❌ لا توجد متطلبات حصص (مواد × فصول × معلمين). أضفها من صفحة متطلبات الحصص.", type: "error" });
    return msgs;
  }

  const periodsPerDay = settings?.periods_per_day ?? 7;
  const workingDays = settings?.working_days?.length ?? 5;
  const totalSlotsPerClass = periodsPerDay * workingDays;

  const totalRequiredLessons = requirements.reduce((s, r) => s + r.weekly_count, 0);
  const totalAvailableSlots = classes.length * totalSlotsPerClass;
  const loadPercent = Math.round((totalRequiredLessons / totalAvailableSlots) * 100);

  msgs.push({ role: "ai", text: `✅ ${classes.length} فصل | ${teachers.length} معلم | ${requirements.length} متطلب | ${totalRequiredLessons} حصة أسبوعية مطلوبة`, type: "info" });

  const unassigned = requirements.filter((r) => !r.teacher_id).length;
  if (unassigned > 0) {
    msgs.push({ role: "ai", text: `⚠️ ${unassigned} متطلب بدون معلم مُعيَّن — المحرك سيحاول التوزيع التلقائي لكن قد تبقى حصص بدون تغطية.`, type: "warning" });
  }

  if (loadPercent > 90) {
    msgs.push({ role: "ai", text: `🔴 الحمل العالي جداً (${loadPercent}%) — احتمالية وجود تعارضات كبيرة. زِد طاقة المعلمين أو قلل المتطلبات.`, type: "error" });
  } else if (loadPercent > 75) {
    msgs.push({ role: "ai", text: `🟡 الحمل مرتفع (${loadPercent}%) — يُنصح برفع عدد الأجيال إلى ${Math.max(generations, 80)} للحصول على جودة أفضل.`, type: "warning" });
    if (generations < 80) msgs.push({ role: "ai", text: `💡 نصيحة: ارفع "أجيال الخوارزمية" إلى 80 أو أكثر لبياناتك.`, type: "tip" });
  } else {
    msgs.push({ role: "ai", text: `🟢 حمل الجدول معقول (${loadPercent}%) — يُتوقع جودة عالية.`, type: "success" });
  }

  const teacherLoad = new Map<string, number>();
  requirements.forEach((r) => { if (r.teacher_id) teacherLoad.set(r.teacher_id, (teacherLoad.get(r.teacher_id) ?? 0) + r.weekly_count); });
  const overloaded = teachers.filter((t) => (teacherLoad.get(t.id) ?? 0) > t.max_weekly_lessons);
  if (overloaded.length > 0) {
    msgs.push({ role: "ai", text: `⚠️ ${overloaded.length} معلم يتجاوز حده الأسبوعي: ${overloaded.slice(0, 2).map((t) => t.full_name).join("، ")}${overloaded.length > 2 ? "..." : ""}`, type: "warning" });
  }

  const classReqCount = new Map<string, number>();
  requirements.forEach((r) => classReqCount.set(r.class_id, (classReqCount.get(r.class_id) ?? 0) + r.weekly_count));
  const overloadedClasses = classes.filter((c) => (classReqCount.get(c.id) ?? 0) > totalSlotsPerClass);
  if (overloadedClasses.length > 0) {
    msgs.push({ role: "ai", text: `🔴 ${overloadedClasses.length} فصل يحتاج حصصاً أكثر من المتاح (${periodsPerDay}×${workingDays}). بعض الحصص ستُهمل.`, type: "error" });
  }

  if (qualityThreshold > 90 && loadPercent > 70) {
    msgs.push({ role: "ai", text: `💡 حد الجودة ${qualityThreshold}% مرتفع جداً مع بياناتك — اخفضه إلى 75–85% لتجنب إعادة المحاولة الزائدة.`, type: "tip" });
  }

  msgs.push({ role: "ai", text: `🚀 البيانات جاهزة. اضغط "ابدأ التوليد" وسأحلل النتائج تلقائياً.`, type: "success" });
  return msgs;
}

function analyzeResult(
  result: EngineResult & { missedLabeled: { class_id: string; subject_id: string; missing: number }[] },
  stats: SchoolStats
): AiMessage[] {
  const msgs: AiMessage[] = [];
  const { score, placed, missed, missedLabeled } = result;

  if (score.quality >= 95) {
    msgs.push({ role: "ai", text: `🎉 ممتاز! جودة ${score.quality}% — جدول شبه مثالي بـ ${placed} حصة.`, type: "success" });
  } else if (score.quality >= 80) {
    msgs.push({ role: "ai", text: `✅ جيد جداً — جودة ${score.quality}% بـ ${placed} حصة. بعض التحسينات ممكنة.`, type: "success" });
  } else if (score.quality >= 60) {
    msgs.push({ role: "ai", text: `🟡 جودة متوسطة ${score.quality}%. يُنصح بمراجعة البيانات وإعادة التوليد.`, type: "warning" });
  } else {
    msgs.push({ role: "ai", text: `🔴 جودة منخفضة ${score.quality}%. تحتاج مراجعة عميقة للبيانات.`, type: "error" });
  }

  if (missedLabeled.length > 0) {
    const topMissed = missedLabeled.slice(0, 3);
    msgs.push({ role: "ai", text: `⚠️ ${missedLabeled.length} متطلب لم يكتمل — أبرزها:\n${topMissed.map((m) => `• ${m.class_id}: ${m.subject_id} (نقص ${m.missing})`).join("\n")}`, type: "warning" });
    const unassigned = stats.requirements.filter((r) => !r.teacher_id).length;
    if (unassigned > 0) msgs.push({ role: "ai", text: `💡 سبب محتمل: ${unassigned} متطلب بلا معلم. عيّن معلمين لكل المواد.`, type: "tip" });
  }

  const topPenalties = score.penalties.filter((p) => p.count > 0).sort((a, b) => b.total - a.total).slice(0, 2);
  if (topPenalties.length > 0) {
    msgs.push({
      role: "ai",
      text: `📊 أكبر مشكلتين في الجودة:\n${topPenalties.map((p) => `• ${p.label}: ${p.count}× (-${p.total} نقطة)`).join("\n")}`,
      type: "info"
    });
    if (topPenalties.some((p) => p.code === "gap")) msgs.push({ role: "ai", text: `💡 لتقليل الفراغات: راجع توافر المعلمين وأيام عملهم.`, type: "tip" });
    if (topPenalties.some((p) => p.code === "overload")) msgs.push({ role: "ai", text: `💡 لتقليل الضغط: ارفع الحد اليومي للمعلمين أو وزّع الحصص على معلمين أكثر.`, type: "tip" });
  }

  if (score.quality >= 80 && missedLabeled.length === 0) {
    msgs.push({ role: "ai", text: `✨ الجدول جاهز للطباعة والتطبيق. يمكنك قفل الحصص المهمة قبل أي توليد جديد.`, type: "tip" });
  } else {
    msgs.push({ role: "ai", text: `🔄 لتحسين النتيجة: راجع التعليقات أعلاه، عدّل البيانات، ثم أعد التوليد.`, type: "tip" });
  }

  return msgs;
}

function GeneratorPage() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [preserveLocked, setPreserveLocked] = useState(true);
  const [qualityThreshold, setQualityThreshold] = useState(80);
  const [generations, setGenerations] = useState(40);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [result, setResult] = useState<(EngineResult & { missedLabeled: { class_id: string; subject_id: string; missing: number }[] }) | null>(null);
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const aiBottomRef = useRef<HTMLDivElement>(null);

  const { data: schoolStats, isLoading: statsLoading } = useQuery<SchoolStats>({
    queryKey: ["school-stats", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const [classesR, teachersR, subjectsR, reqsR, settingsR] = await Promise.all([
        supabase.from("classes").select("id,name,daily_lessons").eq("school_id", schoolId!),
        supabase.from("teachers").select("id,full_name,max_weekly_lessons,max_daily_lessons").eq("school_id", schoolId!),
        supabase.from("subjects").select("id,name,weekly_lessons").eq("school_id", schoolId!),
        supabase.from("class_subjects").select("class_id,subject_id,teacher_id,weekly_count").eq("school_id", schoolId!),
        supabase.from("school_settings").select("periods_per_day,working_days").eq("school_id", schoolId!).maybeSingle(),
      ]);
      return {
        classes: classesR.data ?? [],
        teachers: teachersR.data ?? [],
        subjects: subjectsR.data ?? [],
        requirements: reqsR.data ?? [],
        settings: settingsR.data,
      };
    },
  });

  useEffect(() => {
    if (schoolStats && aiMessages.length === 0) {
      setAiThinking(true);
      setTimeout(() => {
        setAiMessages([{ role: "ai", text: "مرحباً! أنا مساعد الذكاء الاصطناعي للجدولة 🤖\nاضغط \"تحليل البيانات\" لأراجع بيانات مدرستك وأقترح أفضل الإعدادات.", type: "info" }]);
        setAiThinking(false);
      }, 600);
    }
  }, [schoolStats]);

  useEffect(() => { aiBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMessages, aiThinking]);

  const handleAnalyze = () => {
    if (!schoolStats) return;
    setAiThinking(true);
    setTimeout(() => {
      const msgs = analyzeSchoolData(schoolStats, qualityThreshold, generations);
      setAiMessages((prev) => [...prev, ...msgs]);
      setAiThinking(false);
    }, 800);
  };

  const handleUserMessage = () => {
    const text = userInput.trim();
    if (!text || !schoolStats) return;
    setAiMessages((prev) => [...prev, { role: "user", text }]);
    setUserInput("");
    setAiThinking(true);

    setTimeout(() => {
      let reply: AiMessage;
      const t = text.toLowerCase();
      if (t.includes("جودة") || t.includes("نتيجة")) {
        reply = { role: "ai", text: `جودة الجدول تُحسب من عدة معايير:\n• التعارضات (معلم في فصلين = عقوبة كبيرة)\n• الفراغات بين الحصص\n• توازن الحمل اليومي\n• توزيع المواد على الأسبوع\nحد الجودة المقبول الحالي: ${qualityThreshold}%`, type: "info" };
      } else if (t.includes("معلم") || t.includes("teacher")) {
        const overloaded = schoolStats.teachers.filter((t) => {
          const load = schoolStats.requirements.filter((r) => r.teacher_id === t.id).reduce((s, r) => s + r.weekly_count, 0);
          return load > t.max_weekly_lessons;
        });
        reply = { role: "ai", text: overloaded.length > 0 ? `يوجد ${overloaded.length} معلم بحمل زائد: ${overloaded.map((t) => t.full_name).join("، ")}. ارفع حدودهم الأسبوعية.` : `كل المعلمين (${schoolStats.teachers.length}) ضمن حدودهم ✅`, type: overloaded.length > 0 ? "warning" : "success" };
      } else if (t.includes("فصل") || t.includes("class")) {
        reply = { role: "ai", text: `عدد الفصول: ${schoolStats.classes.length}\nعدد المتطلبات: ${schoolStats.requirements.length}\nمعدل المتطلبات لكل فصل: ${schoolStats.classes.length ? Math.round(schoolStats.requirements.length / schoolStats.classes.length) : 0}`, type: "info" };
      } else if (t.includes("تحسين") || t.includes("improve")) {
        reply = { role: "ai", text: `لتحسين الجدول:\n1. تأكد من تعيين معلم لكل متطلب\n2. ارفع حد الجودة للـ 85%\n3. ارفع الأجيال إلى 60-80\n4. تحقق من توافر المعلمين في صفحة القيود`, type: "tip" };
      } else if (t.includes("إعداد") || t.includes("setting") || t.includes("اجيال") || t.includes("أجيال")) {
        const complexity = schoolStats.requirements.length;
        const suggested = complexity > 100 ? 80 : complexity > 50 ? 60 : 40;
        reply = { role: "ai", text: `بناءً على ${complexity} متطلب:\n• الأجيال الموصى بها: ${suggested}\n• حد الجودة المناسب: ${complexity > 80 ? "70-80%" : "80-90%"}\n• الحفاظ على المقفلة: مهم دائماً ✅`, type: "tip" };
      } else {
        reply = { role: "ai", text: `يمكنني مساعدتك في:\n• تحليل بيانات المدرسة\n• اقتراح إعدادات المحرك\n• تفسير نتائج التوليد\n• تشخيص مشاكل الجودة\n\nاسألني مثل: "كيف أحسّن الجودة؟" أو "هل المعلمون مثقلون؟"`, type: "info" };
      }
      setAiMessages((prev) => [...prev, reply]);
      setAiThinking(false);
    }, 700);
  };

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
      if (schoolStats) {
        setAiThinking(true);
        setTimeout(() => {
          const msgs = analyzeResult(r, schoolStats);
          setAiMessages((prev) => [...prev, { role: "ai", text: "✅ اكتمل التوليد! إليك تحليل النتائج:", type: "info" }, ...msgs]);
          setAiThinking(false);
        }, 500);
      }
    },
    onError: (e: Error) => { setProgress(null); toast.error(e.message); },
  });

  const msgColors: Record<string, string> = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    error: "bg-red-50 border-red-200 text-red-900",
    success: "bg-emerald-50 border-emerald-200 text-emerald-900",
    tip: "bg-purple-50 border-purple-200 text-purple-900",
  };

  return (
    <div>
      <PageHeader title="محرّك الجدولة الذكي" description="Backtracking ذكي + خوارزمية جينية + بحث محلي — جودة قابلة للقياس" />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Settings + Progress */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
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

          {/* Results */}
          {result && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" /> نتائج آخر توليد</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>الجودة</span><span className="font-bold">{result.score.quality}%</span></div>
                    <Progress value={result.score.quality} className={result.score.quality >= 80 ? "[&>div]:bg-emerald-500" : result.score.quality >= 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"} />
                    <p className="text-xs text-muted-foreground mt-1">النقاط {result.score.total} من {result.score.base}</p>
                  </div>
                  <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-5 w-5" /> <span className="font-semibold">{result.placed}</span> حصة موضوعة</div>
                  {result.missedLabeled.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-amber-600 mb-2"><AlertTriangle className="h-5 w-5" /> <span className="font-semibold">{result.missedLabeled.length}</span> متطلب لم يكتمل</div>
                      <ul className="text-xs space-y-1 max-h-32 overflow-auto">
                        {result.missedLabeled.map((m, i) => (
                          <li key={i} className="border-b pb-1 flex items-center gap-2">
                            <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                            {m.class_id} — {m.subject_id} <Badge variant="outline" className="text-[10px] py-0">{m.missing} حصة</Badge>
                          </li>
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
              </CardContent>
            </Card>
          )}
        </div>

        {/* AI Assistant Panel */}
        <Card className="flex flex-col" style={{ height: "min(700px, 85vh)" }}>
          <CardHeader className="border-b pb-3 shrink-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-5 w-5 text-purple-600" />
              مساعد الذكاء الاصطناعي
              {statsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">تحليل ذكي + اقتراحات مخصصة لبياناتك</p>
          </CardHeader>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {aiMessages.map((msg, i) => (
              <div key={i} className={`rounded-lg border p-2.5 text-xs leading-relaxed whitespace-pre-line ${msg.role === "user" ? "bg-primary/10 border-primary/20 text-primary-foreground ml-4 text-primary" : msgColors[msg.type ?? "info"]}`}>
                {msg.text}
              </div>
            ))}
            {aiThinking && (
              <div className="bg-muted border rounded-lg p-2.5 text-xs flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> يفكر...
              </div>
            )}
            <div ref={aiBottomRef} />
          </div>

          {/* Actions */}
          <div className="border-t p-3 space-y-2 shrink-0">
            <Button
              size="sm" variant="outline" className="w-full text-xs gap-2"
              onClick={handleAnalyze}
              disabled={!schoolStats || aiThinking || run.isPending}
            >
              <RefreshCw className="h-3.5 w-3.5" /> تحليل البيانات
            </Button>
            <div className="flex gap-2">
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUserMessage()}
                placeholder="اسأل... مثل: كيف أحسّن الجودة؟"
                className="text-xs h-8"
                disabled={aiThinking || !schoolStats}
              />
              <Button size="sm" onClick={handleUserMessage} disabled={!userInput.trim() || aiThinking} className="h-8 px-2">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

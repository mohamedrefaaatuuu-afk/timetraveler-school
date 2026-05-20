import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { analyzeScheduleWithGemini, isGeminiConfigured, type AnalysisOutput } from "@/lib/gemini";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-helpers";
import { Brain, Sparkles, Loader2, TriangleAlert, CheckCircle2, Lightbulb } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/ai-analyzer")({ component: AiAnalyzerPage });

function AiAnalyzerPage() {
  const { schoolId } = useAuth();
  const [result, setResult] = useState<AnalysisOutput | null>(null);

  const analyze = useMutation({
    mutationFn: async () => {
      const [settingsR, entriesR, classesR, subjectsR, teachersR, reqsR] = await Promise.all([
        supabase.from("school_settings").select("*").eq("school_id", schoolId!).maybeSingle(),
        supabase.from("schedule_entries").select("*").eq("school_id", schoolId!),
        supabase.from("classes").select("id, name").eq("school_id", schoolId!),
        supabase.from("subjects").select("id, name").eq("school_id", schoolId!),
        supabase.from("teachers").select("id, name").eq("school_id", schoolId!),
        supabase.from("class_subjects").select("weekly_count").eq("school_id", schoolId!),
      ]);

      if (!settingsR.data) throw new Error("لا توجد إعدادات للمدرسة");
      if (!entriesR.data?.length) throw new Error("لا يوجد جدول حالياً — ولّد الجدول أولاً");

      const classMap = new Map(classesR.data?.map((c) => [c.id, c.name]));
      const subjMap = new Map(subjectsR.data?.map((s) => [s.id, s.name]));
      const teachMap = new Map(teachersR.data?.map((t) => [t.id, t.name]));

      const entries = entriesR.data.map((e) => ({
        class_id: e.class_id,
        class_name: classMap.get(e.class_id) ?? e.class_id,
        subject_name: subjMap.get(e.subject_id) ?? e.subject_id,
        teacher_name: teachMap.get(e.teacher_id) ?? e.teacher_id,
        day: e.day,
        period_no: e.period_no,
      }));

      const totalRequired = (reqsR.data ?? []).reduce((s, r) => s + (r.weekly_count ?? 0), 0);

      return analyzeScheduleWithGemini({
        workingDays: settingsR.data.working_days ?? ["sunday", "monday", "tuesday", "wednesday", "thursday"],
        periodsPerDay: settingsR.data.periods_per_day,
        entries,
        totalRequired,
      });
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(`اكتمل التحليل — التقييم ${data.overall_score}/100`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const severityColor = (s: string) =>
    s === "high" ? "destructive" : s === "medium" ? "secondary" : "outline";

  const severityLabel = (s: string) =>
    s === "high" ? "عالية" : s === "medium" ? "متوسطة" : "منخفضة";

  if (!isGeminiConfigured()) {
    return (
      <div className="p-6">
        <Alert>
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>Gemini غير مُعدّ. تحقق من مفتاح API.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="تحليل الجدول بالذكاء الاصطناعي"
        description="يحلّل Gemini الجدول الحالي ويقترح تحسينات احترافية"
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" /> ابدأ التحليل
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">سيقوم الذكاء الاصطناعي بفحص الجدول الحالي وتقييم:</p>
            <ul className="text-sm space-y-1.5 text-muted-foreground">
              <li>✓ توزيع المواد عبر الأيام</li>
              <li>✓ الفراغات في الجدول</li>
              <li>✓ توزيع عبء المعلمين</li>
              <li>✓ ترتيب المواد الصعبة</li>
              <li>✓ التنوّع داخل اليوم</li>
            </ul>
            <Button
              onClick={() => analyze.mutate()}
              disabled={analyze.isPending}
              size="lg"
              className="w-full"
            >
              {analyze.isPending ? (
                <><Loader2 className="ms-2 h-4 w-4 animate-spin" /> جاري التحليل...</>
              ) : (
                <><Sparkles className="ms-2 h-4 w-4" /> ابدأ التحليل الذكي</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>نتائج التحليل</CardTitle>
          </CardHeader>
          <CardContent>
            {!result && !analyze.isPending && (
              <p className="text-sm text-muted-foreground text-center py-12">
                اضغط "ابدأ التحليل الذكي" لعرض التقرير
              </p>
            )}
            {analyze.isPending && (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-primary" />
                Gemini يحلّل الجدول الآن...
              </div>
            )}
            {result && (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold">التقييم الإجمالي</span>
                    <span className="text-2xl font-bold text-primary">{result.overall_score}/100</span>
                  </div>
                  <Progress value={result.overall_score} className="h-3" />
                </div>

                {result.strengths.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" /> نقاط القوة
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      {result.strengths.map((s, i) => <li key={i}>• {s}</li>)}
                    </ul>
                  </div>
                )}

                {result.issues.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <TriangleAlert className="h-4 w-4 text-amber-500" /> المشاكل المكتشفة
                    </h4>
                    <div className="space-y-3">
                      {result.issues.map((issue, i) => (
                        <div key={i} className="border rounded-lg p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={severityColor(issue.severity) as "destructive" | "secondary" | "outline"}>
                              {severityLabel(issue.severity)}
                            </Badge>
                            <span className="text-sm font-medium">{issue.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{issue.description}</p>
                          <p className="text-xs text-primary">💡 {issue.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.optimization_tips.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" /> نصائح التحسين
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      {result.optimization_tips.map((t, i) => <li key={i}>• {t}</li>)}
                    </ul>
                  </div>
                )}

                <Alert>
                  <AlertDescription className="text-sm">{result.summary}</AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

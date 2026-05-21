import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logAction } from "@/lib/school";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Lock, Trash2, Plus, AlertTriangle, Download, FileSpreadsheet,
  Share2, Copy, Check, Printer, LayoutGrid, Users, BookOpen,
  TrendingUp, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-helpers";
import { DAYS, STAGES, stageLabel, type DayOfWeek, type EducationStage } from "@/lib/constants";
import { downloadScheduleExcel } from "@/lib/excel-export";
import { getSchoolLogo } from "@/lib/school-branding";
import { printScheduleWindow, printAllSchedulesWindow, type PrintEntry, type PrintOptions } from "@/lib/print-schedule";

export const Route = createFileRoute("/_app/schedule")({ component: SchedulePage });

interface Entry {
  id: string; day: DayOfWeek; period_no: number;
  class_id: string; subject_id: string; teacher_id: string; classroom_id: string | null;
  is_locked: boolean;
  subjects?: { name: string; color: string } | null;
  teachers?: { full_name: string } | null;
  classrooms?: { name: string } | null;
  classes?: { name: string } | null;
}

interface ClassItem { id: string; name: string; stage: EducationStage; }

interface PrayerBreak { id: string; label: string; time: string; duration_min: number; }

function SchedulePage() {
  const { schoolId, school } = useAuth();
  const qc = useQueryClient();
  const [viewType, setViewType] = useState<"class" | "teacher" | "stage" | "room">("class");
  const [selectedId, setSelectedId] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<EducationStage | "all">("all");
  const [editing, setEditing] = useState<{ day: DayOfWeek; period: number; entry?: Entry } | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [prayerBreaks, setPrayerBreaks] = useState<PrayerBreak[]>([]);

  useEffect(() => {
    if (!schoolId) return;
    const stored = localStorage.getItem(`prayer_breaks_${schoolId}`);
    if (stored) { try { setPrayerBreaks(JSON.parse(stored)); } catch { /* ignore */ } }
  }, [schoolId]);

  const { data: settings } = useQuery({
    queryKey: ["settings", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("school_settings").select("*").eq("school_id", schoolId!).maybeSingle()).data,
  });
  const periodsPerDay = settings?.periods_per_day ?? 7;
  const workingDays: DayOfWeek[] = (settings?.working_days as DayOfWeek[]) ?? ["sunday","monday","tuesday","wednesday","thursday"];
  const breakAfterPeriod = settings?.break_after_period ?? 0;
  const periodDurationMin = settings?.period_duration_min ?? 45;
  const breakDurationMin = settings?.break_duration_min ?? 15;
  const firstPeriodStart = (settings?.first_period_start as string | undefined)?.slice(0, 5) ?? "08:00";

  const periodTimes = useMemo(() => {
    const [h, m] = firstPeriodStart.split(":").map(Number);
    let cur = h * 60 + m;
    const times: { start: number; end: number }[] = [];
    for (let p = 1; p <= periodsPerDay; p++) {
      times.push({ start: cur, end: cur + periodDurationMin });
      cur += periodDurationMin;
      if (breakAfterPeriod > 0 && p === breakAfterPeriod) cur += breakDurationMin;
    }
    return times;
  }, [firstPeriodStart, periodDurationMin, periodsPerDay, breakAfterPeriod, breakDurationMin]);

  type ScheduleCol = { type: "period"; num: number } | { type: "break"; label: string; duration: number; variant: "amber" | "green" };
  const scheduleColumns = useMemo<ScheduleCol[]>(() => {
    const cols: ScheduleCol[] = [];
    for (let p = 1; p <= periodsPerDay; p++) {
      cols.push({ type: "period", num: p });
      if (breakAfterPeriod > 0 && p === breakAfterPeriod)
        cols.push({ type: "break", label: "فسحة", duration: breakDurationMin, variant: "amber" });
      if (periodTimes[p - 1]) {
        const end = periodTimes[p - 1].end;
        const next = periodTimes[p]?.start ?? Infinity;
        for (const pb of prayerBreaks) {
          const [ph, pm] = pb.time.split(":").map(Number);
          const pbMins = ph * 60 + pm;
          if (pbMins >= end && (p === periodsPerDay || pbMins < next))
            cols.push({ type: "break", label: pb.label, duration: pb.duration_min, variant: "green" });
        }
      }
    }
    return cols;
  }, [periodsPerDay, breakAfterPeriod, breakDurationMin, prayerBreaks, periodTimes]);

  const fmtTime = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-mini", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("classes").select("id,name,stage").eq("school_id", schoolId!).order("name")).data ?? [] as ClassItem[],
  });
  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers-mini", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("teachers").select("id,full_name").eq("school_id", schoolId!).order("full_name")).data ?? [],
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-mini", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("subjects").select("id,name,color").eq("school_id", schoolId!).order("name")).data ?? [],
  });
  const { data: classrooms = [] } = useQuery({
    queryKey: ["rooms-mini", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("classrooms").select("id,name").eq("school_id", schoolId!).order("name")).data ?? [],
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["schedule", schoolId], enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_entries")
        .select("*, subjects(name,color), teachers(full_name), classrooms(name), classes(name)")
        .eq("school_id", schoolId!);
      if (error) throw error;
      return data as unknown as Entry[];
    },
  });

  // ── Conflict detection ──
  const conflictKeys = useMemo(() => {
    const set = new Set<string>();
    const t = new Map<string, number>();
    const r = new Map<string, number>();
    entries.forEach((e) => {
      const tk = `T:${e.teacher_id}:${e.day}:${e.period_no}`;
      t.set(tk, (t.get(tk) ?? 0) + 1);
      if (e.classroom_id) {
        const rk = `R:${e.classroom_id}:${e.day}:${e.period_no}`;
        r.set(rk, (r.get(rk) ?? 0) + 1);
      }
    });
    entries.forEach((e) => {
      const tk = `T:${e.teacher_id}:${e.day}:${e.period_no}`;
      if ((t.get(tk) ?? 0) > 1) set.add(e.id);
      if (e.classroom_id) {
        const rk = `R:${e.classroom_id}:${e.day}:${e.period_no}`;
        if ((r.get(rk) ?? 0) > 1) set.add(e.id);
      }
    });
    return set;
  }, [entries]);

  // ── Coverage stats ──
  const coverageStats = useMemo(() => {
    const totalSlots = (classes as ClassItem[]).length * workingDays.length * periodsPerDay;
    const filled = entries.length;
    const pct = totalSlots > 0 ? Math.round((filled / totalSlots) * 100) : 0;
    // Teacher hours per week
    const teacherHours = new Map<string, number>();
    entries.forEach((e) => { teacherHours.set(e.teacher_id, (teacherHours.get(e.teacher_id) ?? 0) + 1); });
    const avgTeacherLoad = teacherHours.size > 0
      ? Math.round([...teacherHours.values()].reduce((a, b) => a + b, 0) / teacherHours.size)
      : 0;
    return { totalSlots, filled, pct, conflicts: conflictKeys.size, avgTeacherLoad };
  }, [classes, workingDays, periodsPerDay, entries, conflictKeys]);

  const filteredClasses = useMemo(() =>
    viewType === "stage" && stageFilter !== "all"
      ? (classes as ClassItem[]).filter((c) => c.stage === stageFilter)
      : classes as ClassItem[]
  , [classes, viewType, stageFilter]);

  const list = viewType === "teacher" ? teachers : viewType === "room" ? classrooms : filteredClasses;
  const currentId = selectedId || list[0]?.id || "";

  const filtered = useMemo(() => {
    if (viewType === "teacher") return entries.filter((e) => e.teacher_id === currentId);
    if (viewType === "room") return entries.filter((e) => e.classroom_id === currentId);
    return entries.filter((e) => e.class_id === currentId);
  }, [entries, viewType, currentId]);

  const grid: Record<string, Entry | undefined> = {};
  filtered.forEach((e) => { grid[`${e.day}:${e.period_no}`] = e; });

  // ── Coverage for current entity ──
  const entityCoverage = useMemo(() => {
    if (!currentId) return null;
    if (viewType === "teacher") {
      const teacherEntries = entries.filter((e) => e.teacher_id === currentId);
      return { label: "حصص المعلم", value: teacherEntries.length, total: workingDays.length * periodsPerDay };
    }
    if (viewType === "class" || viewType === "stage") {
      const classEntries = entries.filter((e) => e.class_id === currentId);
      const total = workingDays.length * periodsPerDay;
      return { label: "حصص الفصل", value: classEntries.length, total };
    }
    if (viewType === "room") {
      const roomEntries = entries.filter((e) => e.classroom_id === currentId);
      return { label: "حصص القاعة", value: roomEntries.length, total: workingDays.length * periodsPerDay };
    }
    return null;
  }, [currentId, viewType, entries, workingDays, periodsPerDay]);

  // ── Teacher gap detection ──
  const teacherGaps = useMemo(() => {
    if (viewType !== "teacher" || !currentId) return 0;
    let gaps = 0;
    workingDays.forEach((day) => {
      const periods = filtered.filter((e) => e.day === day).map((e) => e.period_no).sort((a, b) => a - b);
      if (periods.length > 1) {
        for (let i = 0; i < periods.length - 1; i++) {
          if (periods[i + 1] - periods[i] > 1) gaps += periods[i + 1] - periods[i] - 1;
        }
      }
    });
    return gaps;
  }, [viewType, currentId, filtered, workingDays]);

  // ── Mutations ──
  const upsert = useMutation({
    mutationFn: async (input: Partial<Entry> & { id?: string }) => {
      const payload = {
        day: input.day!, period_no: input.period_no!, class_id: input.class_id!,
        subject_id: input.subject_id!, teacher_id: input.teacher_id!,
        classroom_id: input.classroom_id ?? null, is_locked: input.is_locked ?? false,
      };
      if (input.id) {
        const { error } = await supabase.from("schedule_entries").update(payload).eq("id", input.id);
        if (error) throw error; await logAction("update", "schedule_entry", input.id);
      } else {
        const { error } = await supabase.from("schedule_entries").insert({ ...payload, school_id: schoolId! } as never);
        if (error) throw error; await logAction("create", "schedule_entry");
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); toast.success("تم الحفظ"); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_entries").delete().eq("id", id);
      if (error) throw error; await logAction("delete", "schedule_entry", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); toast.success("تم الحذف"); setEditing(null); },
  });

  const toggleLock = useMutation({
    mutationFn: async (e: Entry) => {
      const { error } = await supabase.from("schedule_entries").update({ is_locked: !e.is_locked }).eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule"] }),
  });

  // ── Print helpers ──
  const dayLabels = Object.fromEntries(DAYS.map((d) => [d.value, d.label]));
  const logoSrc = getSchoolLogo(school?.name, school?.logo_url)
    ? `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, "")}${getSchoolLogo(school?.name, school?.logo_url)}`
    : null;

  function buildPrintOpts(entityId: string, vType: typeof viewType): PrintOptions {
    const item =
      vType === "teacher" ? teachers.find((x) => x.id === entityId)
      : vType === "room" ? classrooms.find((x) => x.id === entityId)
      : (classes as ClassItem[]).find((x) => x.id === entityId);
    const title =
      vType === "teacher"
        ? `جدول المعلم: ${(item as { full_name?: string })?.full_name ?? ""}`
        : vType === "room"
        ? `جدول القاعة: ${(item as { name?: string })?.name ?? ""}`
        : `جدول الفصل: ${(item as { name?: string })?.name ?? ""}`;
    const entityEntries = entries.filter((e) =>
      vType === "teacher" ? e.teacher_id === entityId
      : vType === "room" ? e.classroom_id === entityId
      : e.class_id === entityId
    );
    const printEntries: PrintEntry[] = entityEntries.map((e) => ({
      day: e.day,
      period_no: e.period_no,
      subject_name: e.subjects?.name ?? "—",
      subject_color: e.subjects?.color ?? "#94a3b8",
      secondary_label:
        vType === "teacher"
          ? (e.classes?.name ?? "")
          : (e.teachers?.full_name ?? ""),
      classroom_name: e.classrooms?.name,
      is_conflict: conflictKeys.has(e.id),
    }));
    return {
      title,
      subtitle: school?.name,
      schoolName: school?.name ?? "المدرسة",
      logoSrc,
      days: workingDays,
      dayLabels,
      periodsPerDay,
      periodTimes,
      breakAfterPeriod,
      breakDurationMin,
      prayerBreaks,
      entries: printEntries,
    };
  }

  const handlePrint = () => {
    if (!currentId) { toast.error("اختر فصلاً أو معلماً أولاً"); return; }
    printScheduleWindow(buildPrintOpts(currentId, viewType));
  };

  const handlePrintAll = () => {
    const targetList = viewType === "teacher" ? teachers : (classes as ClassItem[]);
    if (targetList.length === 0) { toast.error("لا توجد بيانات للطباعة"); return; }
    const pages = targetList.map((item) => ({ opts: buildPrintOpts(item.id, viewType) }));
    printAllSchedulesWindow(pages);
  };

  const handleExcelExport = () => {
    if (!currentId) { toast.error("اختر فصلاً أو معلماً أولاً"); return; }
    const currentItem = list.find((x) => x.id === currentId);
    const titleName = currentItem ? ("name" in currentItem ? currentItem.name : (currentItem as { full_name: string }).full_name) : "";
    const exportEntries = filtered.map((e) => ({
      day: e.day, period_no: e.period_no,
      subject_name: e.subjects?.name ?? "",
      teacher_name: e.teachers?.full_name ?? "",
      class_name: e.classes?.name ?? "",
      classroom_name: e.classrooms?.name,
    }));
    downloadScheduleExcel(exportEntries, workingDays, periodsPerDay, dayLabels, titleName, school?.name ?? "المدرسة");
  };

  const currentItem = list.find((x) => x.id === currentId);
  const titleName = currentItem
    ? ("name" in currentItem ? currentItem.name : (currentItem as { full_name: string }).full_name)
    : "";
  const viewLabel = viewType === "teacher" ? "حسب المعلم" : viewType === "stage" ? "حسب المرحلة" : viewType === "room" ? "حسب القاعة" : "حسب الفصل";

  return (
    <div>
      <PageHeader
        title="الجدول الأسبوعي"
        description={`${viewLabel} • ${conflictKeys.size > 0 ? conflictKeys.size + " تعارض" : "لا تعارضات"}`}
      />

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard icon={<LayoutGrid className="h-4 w-4 text-primary" />} label="تغطية الجدول" value={`${coverageStats.pct}%`} sub={`${coverageStats.filled} / ${coverageStats.totalSlots} حصة`} color={coverageStats.pct >= 80 ? "green" : coverageStats.pct >= 50 ? "amber" : "red"} />
        <StatCard icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="التعارضات" value={String(coverageStats.conflicts)} sub={coverageStats.conflicts === 0 ? "الجدول نظيف ✓" : "يحتاج مراجعة"} color={coverageStats.conflicts === 0 ? "green" : "red"} />
        <StatCard icon={<Users className="h-4 w-4 text-blue-600" />} label="متوسط حمل المعلم" value={`${coverageStats.avgTeacherLoad}`} sub="حصة / أسبوع" color="blue" />
        <StatCard icon={<BookOpen className="h-4 w-4 text-purple-600" />} label="الفصول" value={String((classes as ClassItem[]).length)} sub={`${teachers.length} معلم • ${subjects.length} مادة`} color="purple" />
      </div>

      {/* ── Controls ── */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Tabs value={viewType} onValueChange={(v) => { setViewType(v as never); setSelectedId(""); setStageFilter("all"); }}>
            <TabsList>
              <TabsTrigger value="class">الفصول</TabsTrigger>
              <TabsTrigger value="teacher">المعلمون</TabsTrigger>
              <TabsTrigger value="stage">المراحل</TabsTrigger>
              <TabsTrigger value="room">القاعات</TabsTrigger>
            </TabsList>
          </Tabs>

          {viewType === "stage" && (
            <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v as EducationStage | "all"); setSelectedId(""); }}>
              <SelectTrigger className="max-w-[200px]"><SelectValue placeholder="اختر المرحلة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المراحل</SelectItem>
                {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          <Select value={currentId} onValueChange={setSelectedId}>
            <SelectTrigger className="max-w-[260px]"><SelectValue placeholder="اختر..." /></SelectTrigger>
            <SelectContent>
              {list.map((x) => <SelectItem key={x.id} value={x.id}>{"name" in x ? x.name : (x as { full_name: string }).full_name}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Entity coverage mini badge */}
          {entityCoverage && currentId && (
            <Badge variant="outline" className="gap-1 font-normal">
              {entityCoverage.value >= entityCoverage.total
                ? <CheckCircle2 className="h-3 w-3 text-green-600" />
                : <XCircle className="h-3 w-3 text-amber-500" />}
              {entityCoverage.value} / {entityCoverage.total} حصة
            </Badge>
          )}

          {/* Teacher gap warning */}
          {viewType === "teacher" && teacherGaps > 0 && (
            <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300 bg-amber-50">
              <Clock className="h-3 w-3" /> {teacherGaps} فراغ
            </Badge>
          )}

          {conflictKeys.size > 0 && (
            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> {conflictKeys.size} تعارض</Badge>
          )}

          <div className="flex-1" />

          <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={!currentId}>
            <FileSpreadsheet className="h-4 w-4 ms-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!currentId}>
            <Printer className="h-4 w-4 ms-1" /> طباعة
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintAll}>
            <TrendingUp className="h-4 w-4 ms-1" /> طباعة الكل
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setShowShare(true); setCopied(false); }}>
            <Share2 className="h-4 w-4 ms-1" /> مشاركة
          </Button>
        </CardContent>
      </Card>

      {/* ── Share Dialog ── */}
      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <Share2 className="h-5 w-5 text-primary" /> مشاركة الجدول
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">يمكن لأي شخص عرض جدول المدرسة عبر الرابط التالي — بدون تسجيل دخول:</p>
            {(() => {
              const origin = window.location.origin;
              const base = window.location.pathname.replace(/\/[^/]*$/, "");
              const shareUrl = `${origin}${base}/view.html?school=${schoolId}`;
              return (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                    <span className="flex-1 text-xs break-all font-mono text-muted-foreground">{shareUrl}</span>
                    <Button size="sm" variant="ghost" className="shrink-0" onClick={() => {
                      navigator.clipboard.writeText(shareUrl).then(() => {
                        setCopied(true); toast.success("تم نسخ الرابط!");
                        setTimeout(() => setCopied(false), 3000);
                      });
                    }}>
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                    <p className="font-semibold">📋 ما يراه الزائر:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>جدول المدرسة كاملاً — فصل بفصل أو معلم بمعلم</li>
                      <li>أوقات الحصص والفسحات والصلاة</li>
                      <li>زر طباعة مباشر</li>
                    </ul>
                  </div>
                  <Button className="w-full" onClick={() => window.open(`${origin}${base}/view.html?school=${schoolId}`, "_blank")}>
                    <Share2 className="h-4 w-4 ms-2" /> فتح الجدول العام
                  </Button>
                </div>
              );
            })()}
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setShowShare(false)}>إغلاق</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Schedule Grid ── */}
      {!currentId ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {viewType === "stage" ? "اختر المرحلة ثم الفصل" : viewType === "room" ? "أضف قاعات دراسية أولاً" : "أضف فصولاً ومعلمين أولاً"}
        </CardContent></Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-2 overflow-x-auto">
              {/* Entity info header */}
              <div className="flex items-center justify-between px-2 py-1.5 mb-2 rounded-lg bg-muted/50">
                <span className="font-semibold text-sm">{titleName}</span>
                <span className="text-xs text-muted-foreground">{viewLabel}</span>
              </div>
              <table className="w-full text-sm border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="p-2 text-center bg-muted rounded-md min-w-[70px] sticky right-0 z-10">اليوم</th>
                    {scheduleColumns.map((col, ci) =>
                      col.type === "period" ? (
                        <th key={ci} className="p-1.5 text-center bg-muted rounded-md min-w-[110px]">
                          <div className="font-semibold">حصة {col.num}</div>
                          {periodTimes[col.num - 1] && (
                            <div className="text-[10px] font-normal text-muted-foreground">
                              {fmtTime(periodTimes[col.num - 1].start)}
                            </div>
                          )}
                        </th>
                      ) : (
                        <th key={ci} className={`p-1.5 text-center rounded-md min-w-[60px] ${col.variant === "amber" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}>
                          <div className="text-xs font-bold">{col.variant === "amber" ? "☕" : "🕌"} {col.label}</div>
                          <div className="text-[10px] font-normal">{col.duration} د</div>
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {workingDays.map((d) => (
                    <tr key={d}>
                      <td className="p-2 text-center bg-muted rounded-md font-medium sticky right-0 z-10">{DAYS.find((x) => x.value === d)?.label}</td>
                      {scheduleColumns.map((col, ci) => {
                        if (col.type === "break") {
                          return (
                            <td key={ci} className={`p-1 text-center rounded-md ${col.variant === "amber" ? "bg-amber-50/80" : "bg-green-50/80"}`}>
                              <div className={`text-[11px] font-semibold ${col.variant === "amber" ? "text-amber-700" : "text-green-700"}`}>
                                {col.variant === "amber" ? "☕" : "🕌"} {col.label}
                              </div>
                            </td>
                          );
                        }
                        const p = col.num;
                        const e = grid[`${d}:${p}`];
                        const conf = e ? conflictKeys.has(e.id) : false;
                        return (
                          <td key={ci} className="p-1 align-top">
                            {e ? (
                              <button
                                onClick={() => viewType !== "room" ? setEditing({ day: d, period: p, entry: e }) : undefined}
                                className={`w-full text-right rounded-md p-2 border transition-shadow hover:shadow-md ${conf ? "border-destructive bg-destructive/10" : "border-border"} ${viewType === "room" ? "cursor-default" : ""}`}
                                style={{ borderInlineStartWidth: 4, borderInlineStartColor: e.subjects?.color ?? undefined }}
                              >
                                <div className="font-semibold text-xs">{e.subjects?.name}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {viewType === "teacher"
                                    ? e.classes?.name
                                    : viewType === "room"
                                    ? `${e.classes?.name ?? ""} • ${e.teachers?.full_name ?? ""}`
                                    : e.teachers?.full_name}
                                </div>
                                {e.classrooms?.name && viewType !== "room" && <div className="text-[10px] text-muted-foreground">📍 {e.classrooms.name}</div>}
                                {e.is_locked && <Lock className="h-3 w-3 inline ms-1" />}
                                {conf && <AlertTriangle className="h-3 w-3 inline ms-1 text-destructive" />}
                              </button>
                            ) : (
                              viewType !== "room" ? (
                                <button onClick={() => setEditing({ day: d, period: p })} className="w-full h-full min-h-[60px] rounded-md border border-dashed border-border/50 hover:border-primary hover:bg-accent/50 text-muted-foreground">
                                  <Plus className="h-4 w-4 mx-auto" />
                                </button>
                              ) : (
                                <div className="w-full min-h-[60px] rounded-md border border-dashed border-border/30 bg-green-50/30 flex items-center justify-center text-[10px] text-green-600">متاحة</div>
                              )
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* ── Teacher workload per day ── */}
          {viewType === "teacher" && currentId && (
            <Card className="mt-4">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> توزيع الحمل الأسبوعي
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="flex gap-2 flex-wrap">
                  {workingDays.map((d) => {
                    const count = filtered.filter((e) => e.day === d).length;
                    const pct = periodsPerDay > 0 ? (count / periodsPerDay) * 100 : 0;
                    return (
                      <div key={d} className="flex flex-col items-center gap-1 min-w-[60px]">
                        <span className="text-xs font-medium">{DAYS.find((x) => x.value === d)?.label}</span>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{count} / {periodsPerDay}</span>
                      </div>
                    );
                  })}
                  <div className="flex flex-col justify-center pr-4 border-r mr-2">
                    <div className="text-sm font-bold">{filtered.length}</div>
                    <div className="text-[10px] text-muted-foreground">إجمالي الحصص</div>
                  </div>
                  {teacherGaps > 0 && (
                    <Badge variant="outline" className="self-center gap-1 text-amber-700 border-amber-300 bg-amber-50">
                      <Clock className="h-3 w-3" /> {teacherGaps} فراغ في الجدول
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ── Stage overview ── */}
      {viewType === "stage" && stageFilter !== "all" && filteredClasses.length > 1 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">جميع فصول {stageLabel(stageFilter as EducationStage)} ({filteredClasses.length} فصل)</CardTitle>
          </CardHeader>
          <CardContent className="p-3 overflow-x-auto">
            <div className="flex gap-2 flex-wrap">
              {(filteredClasses as ClassItem[]).map((cls) => {
                const clsEntries = entries.filter((e) => e.class_id === cls.id);
                const total = workingDays.length * periodsPerDay;
                const pct = total > 0 ? Math.round((clsEntries.length / total) * 100) : 0;
                return (
                  <button key={cls.id} onClick={() => setSelectedId(cls.id)}
                    className={`px-4 py-2 rounded-lg border text-sm transition ${selectedId === cls.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent border-border"}`}>
                    <div className="font-semibold">{cls.name}</div>
                    <div className="text-xs opacity-70">{clsEntries.length} حصة • {pct}%</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Entry Edit Dialog ── */}
      {editing && viewType !== "room" && (
        <EntryDialog
          open={!!editing}
          onClose={() => setEditing(null)}
          slot={editing}
          contextId={currentId}
          viewType={viewType === "teacher" ? "teacher" : "class"}
          classes={classes as ClassItem[]} teachers={teachers} subjects={subjects} classrooms={classrooms}
          onSave={(d) => upsert.mutate({ ...d, id: editing.entry?.id })}
          onDelete={editing.entry ? () => del.mutate(editing.entry!.id) : undefined}
          onLock={editing.entry ? () => toggleLock.mutate(editing.entry!) : undefined}
          submitting={upsert.isPending}
        />
      )}
    </div>
  );
}

// ── Stat Card ──
function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  color: "green" | "red" | "amber" | "blue" | "purple";
}) {
  const bg = { green: "bg-green-50 border-green-200", red: "bg-red-50 border-red-200", amber: "bg-amber-50 border-amber-200", blue: "bg-blue-50 border-blue-200", purple: "bg-purple-50 border-purple-200" }[color];
  return (
    <div className={`rounded-xl border p-3 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs font-medium text-muted-foreground">{label}</span></div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </div>
  );
}

// ── Entry Dialog ──
function EntryDialog({
  open, onClose, slot, contextId, viewType, classes, teachers, subjects, classrooms,
  onSave, onDelete, onLock, submitting,
}: {
  open: boolean; onClose: () => void;
  slot: { day: DayOfWeek; period: number; entry?: Entry };
  contextId: string; viewType: "class" | "teacher";
  classes: ClassItem[];
  teachers: { id: string; full_name: string }[];
  subjects: { id: string; name: string; color: string }[];
  classrooms: { id: string; name: string }[];
  onSave: (d: Partial<Entry>) => void; onDelete?: () => void; onLock?: () => void; submitting: boolean;
}) {
  const [form, setForm] = useState<Partial<Entry>>(slot.entry ?? {
    day: slot.day, period_no: slot.period,
    class_id: viewType === "class" ? contextId : "",
    teacher_id: viewType === "teacher" ? contextId : "",
    subject_id: "", classroom_id: null, is_locked: false,
  });
  const dayLabel = DAYS.find((x) => x.value === slot.day)?.label ?? slot.day;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{slot.entry ? "تعديل حصة" : "إضافة حصة"} — {dayLabel} / حصة {slot.period}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-3">
          <div><Label>الفصل</Label>
            <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>المادة</Label>
            <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>المعلم</Label>
            <Select value={form.teacher_id} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>{teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>القاعة (اختياري)</Label>
            <Select value={form.classroom_id ?? "none"} onValueChange={(v) => setForm({ ...form, classroom_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— بدون —</SelectItem>
                {classrooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            {onDelete && <Button type="button" variant="destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>}
            {onLock && <Button type="button" variant="outline" onClick={onLock}><Lock className="h-4 w-4" /> {slot.entry?.is_locked ? "إلغاء القفل" : "قفل"}</Button>}
            <Button type="submit" disabled={submitting || !form.class_id || !form.subject_id || !form.teacher_id}>حفظ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

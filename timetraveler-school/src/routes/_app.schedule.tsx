import { useState, useMemo, useRef } from "react";
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
import { Lock, Trash2, Plus, AlertTriangle, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-helpers";
import { DAYS, STAGES, stageLabel, type DayOfWeek, type EducationStage } from "@/lib/constants";
import { downloadScheduleExcel } from "@/lib/excel-export";
import { getSchoolLogo } from "@/lib/school-branding";

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

function SchedulePage() {
  const { schoolId, school } = useAuth();
  const qc = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [viewType, setViewType] = useState<"class" | "teacher" | "stage">("class");
  const [selectedId, setSelectedId] = useState<string>("");
  const [stageFilter, setStageFilter] = useState<EducationStage | "all">("all");
  const [editing, setEditing] = useState<{ day: DayOfWeek; period: number; entry?: Entry } | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["settings", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("school_settings").select("*").eq("school_id", schoolId!).maybeSingle()).data,
  });
  const periodsPerDay = settings?.periods_per_day ?? 7;
  const workingDays: DayOfWeek[] = (settings?.working_days as DayOfWeek[]) ?? ["sunday","monday","tuesday","wednesday","thursday"];

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

  const filteredClasses = useMemo(() =>
    viewType === "stage" && stageFilter !== "all"
      ? (classes as ClassItem[]).filter((c) => c.stage === stageFilter)
      : classes as ClassItem[]
  , [classes, viewType, stageFilter]);

  const list = viewType === "teacher" ? teachers : filteredClasses;
  const currentId = selectedId || list[0]?.id || "";

  const filtered = entries.filter((e) => viewType === "teacher" ? e.teacher_id === currentId : e.class_id === currentId);
  const grid: Record<string, Entry | undefined> = {};
  filtered.forEach((e) => { grid[`${e.day}:${e.period_no}`] = e; });

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
    mutationFn: async (id: string) => { const { error } = await supabase.from("schedule_entries").delete().eq("id", id); if (error) throw error; await logAction("delete", "schedule_entry", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["schedule"] }); toast.success("تم الحذف"); setEditing(null); },
  });

  const toggleLock = useMutation({
    mutationFn: async (e: Entry) => { const { error } = await supabase.from("schedule_entries").update({ is_locked: !e.is_locked }).eq("id", e.id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedule"] }),
  });

  const handleExcelExport = () => {
    if (!currentId) { toast.error("اختر فصلاً أو معلماً أولاً"); return; }
    const currentItem = list.find((x) => x.id === currentId);
    const titleName = currentItem ? ("name" in currentItem ? currentItem.name : (currentItem as { full_name: string }).full_name) : "";
    const dayLabels = Object.fromEntries(DAYS.map((d) => [d.value, d.label]));
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
  const titleName = currentItem ? ("name" in currentItem ? currentItem.name : (currentItem as { full_name: string }).full_name) : "";

  const viewLabel = viewType === "teacher" ? "حسب المعلم" : viewType === "stage" ? "حسب المرحلة" : "حسب الفصل";

  return (
    <div>
      <PageHeader
        title="الجدول الأسبوعي"
        description={`عرض ${viewLabel} • ${conflictKeys.size > 0 ? conflictKeys.size + " تعارض" : "لا تعارضات"}`}
      />

      <Card className="mb-4"><CardContent className="p-4 flex flex-wrap items-center gap-3">
        <Tabs value={viewType} onValueChange={(v) => { setViewType(v as never); setSelectedId(""); setStageFilter("all"); }}>
          <TabsList>
            <TabsTrigger value="class">حسب الفصل</TabsTrigger>
            <TabsTrigger value="teacher">حسب المعلم</TabsTrigger>
            <TabsTrigger value="stage">حسب المرحلة</TabsTrigger>
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

        {conflictKeys.size > 0 && (
          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> {conflictKeys.size} تعارض</Badge>
        )}

        <div className="flex-1" />

        <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={!currentId}>
          <FileSpreadsheet className="h-4 w-4 ms-1" /> تصدير Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Download className="h-4 w-4 ms-1" /> طباعة
        </Button>
      </CardContent></Card>

      {!currentId ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {viewType === "stage" ? "اختر المرحلة ثم الفصل" : "أضف فصولاً ومعلمين أولاً"}
        </CardContent></Card>
      ) : (
        <div ref={printRef}>
          {/* Print header */}
          <div className="hidden print:block mb-6 border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getSchoolLogo(school?.name, school?.logo_url) && (
                  <img
                    src={getSchoolLogo(school?.name, school?.logo_url)!}
                    alt={school?.name ?? ""}
                    className="h-16 w-16 object-contain"
                  />
                )}
                <div>
                  <h2 className="text-xl font-bold">{school?.name ?? "الجدول الدراسي"}</h2>
                  <p className="text-sm text-gray-600">مجموعة المالكي التعليمية</p>
                </div>
              </div>
              <div className="text-left text-sm text-gray-600">
                <p className="font-bold text-base">{viewLabel}</p>
                <p className="font-semibold text-gray-800">{titleName}</p>
                <p className="text-xs mt-1">{new Date().toLocaleDateString("ar-SA")}</p>
              </div>
            </div>
          </div>
          <Card><CardContent className="p-2 overflow-x-auto">
            <table className="w-full text-sm border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="p-2 text-center bg-muted rounded-md min-w-[80px]">اليوم \ الحصة</th>
                  {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map((p) => (
                    <th key={p} className="p-2 text-center bg-muted rounded-md min-w-[120px]">حصة {p}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workingDays.map((d) => (
                  <tr key={d}>
                    <td className="p-2 text-center bg-muted rounded-md font-medium">{DAYS.find((x) => x.value === d)?.label}</td>
                    {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map((p) => {
                      const e = grid[`${d}:${p}`];
                      const conf = e ? conflictKeys.has(e.id) : false;
                      return (
                        <td key={p} className="p-1 align-top">
                          {e ? (
                            <button
                              onClick={() => setEditing({ day: d, period: p, entry: e })}
                              className={`w-full text-right rounded-md p-2 border transition-shadow hover:shadow-md ${conf ? "border-destructive bg-destructive/10" : "border-border"}`}
                              style={{ borderInlineStartWidth: 4, borderInlineStartColor: e.subjects?.color ?? undefined }}
                            >
                              <div className="font-semibold text-xs">{e.subjects?.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {viewType === "teacher" ? e.classes?.name : e.teachers?.full_name}
                              </div>
                              {e.classrooms?.name && <div className="text-[10px] text-muted-foreground">📍 {e.classrooms.name}</div>}
                              {e.is_locked && <Lock className="h-3 w-3 inline ms-1" />}
                            </button>
                          ) : (
                            <button onClick={() => setEditing({ day: d, period: p })} className="w-full h-full min-h-[60px] rounded-md border border-dashed border-border/50 hover:border-primary hover:bg-accent/50 text-muted-foreground print:hidden">
                              <Plus className="h-4 w-4 mx-auto" />
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
        </div>
      )}

      {/* Stage overview: show all classes in selected stage */}
      {viewType === "stage" && stageFilter !== "all" && filteredClasses.length > 1 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">جميع فصول {stageLabel(stageFilter as EducationStage)} ({filteredClasses.length} فصل)</CardTitle>
          </CardHeader>
          <CardContent className="p-3 overflow-x-auto">
            <div className="flex gap-2 flex-wrap">
              {(filteredClasses as ClassItem[]).map((cls) => {
                const clsEntries = entries.filter((e) => e.class_id === cls.id);
                const total = clsEntries.length;
                return (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedId(cls.id)}
                    className={`px-4 py-2 rounded-lg border text-sm transition ${selectedId === cls.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent border-border"}`}
                  >
                    <div className="font-semibold">{cls.name}</div>
                    <div className="text-xs opacity-70">{total} حصة مجدولة</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {editing && (
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
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>
          {slot.entry ? "تعديل حصة" : "إضافة حصة"} — {DAYS.find((x) => x.value === slot.day)?.label} / حصة {slot.period}
        </DialogTitle></DialogHeader>
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
              <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
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

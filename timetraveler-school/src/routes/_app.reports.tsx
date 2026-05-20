import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, Download, FileText, Loader2, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/page-helpers";
import { DAYS, STAGES, stageLabel, type DayOfWeek, type EducationStage } from "@/lib/constants";
import { nodeToPdf } from "@/lib/pdf-export";
import { downloadScheduleExcel } from "@/lib/excel-export";
import { getSchoolLogo } from "@/lib/school-branding";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

interface Entry {
  id: string; day: DayOfWeek; period_no: number;
  class_id: string; teacher_id: string;
  subjects: { name: string; color: string } | null;
  teachers: { full_name: string } | null;
  classes: { name: string; stage?: EducationStage } | null;
  classrooms: { name: string } | null;
}

interface ClassItem { id: string; name: string; stage: EducationStage; }

function ReportsPage() {
  const { schoolId, school: authSchool } = useAuth();
  const [viewType, setViewType] = useState<"class" | "teacher" | "stage">("class");
  const [selectedId, setSelectedId] = useState("");
  const [stageFilter, setStageFilter] = useState<EducationStage | "all">("all");
  const [busy, setBusy] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: school } = useQuery({
    queryKey: ["school", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("schools").select("name, logo_url").eq("id", schoolId!).maybeSingle()).data,
  });
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
  const { data: entries = [] } = useQuery({
    queryKey: ["schedule", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("schedule_entries").select("*, subjects(name,color), teachers(full_name), classrooms(name), classes(name,stage)").eq("school_id", schoolId!)).data as unknown as Entry[] ?? [],
  });

  const filteredClasses = viewType === "stage" && stageFilter !== "all"
    ? (classes as ClassItem[]).filter((c) => c.stage === stageFilter)
    : classes as ClassItem[];

  const list = viewType === "teacher" ? teachers : filteredClasses;
  const currentId = selectedId || list[0]?.id || "";
  const headerName = list.find((x) => x.id === currentId);
  const titleName = headerName ? ("name" in headerName ? headerName.name : headerName.full_name) : "";

  const filterFor = (id: string) => entries.filter((e) => viewType === "teacher" ? e.teacher_id === id : e.class_id === id);
  const filtered = filterFor(currentId);
  const grid: Record<string, Entry | undefined> = {};
  filtered.forEach((e) => { grid[`${e.day}:${e.period_no}`] = e; });

  const schoolName = school?.name ?? authSchool?.name ?? "المدرسة";
  const localLogoUrl = getSchoolLogo(schoolName, school?.logo_url);
  const dayLabels = Object.fromEntries(DAYS.map((d) => [d.value, d.label]));

  const exportExcel = () => {
    if (!currentId) { toast.error("اختر فصلاً أو معلماً"); return; }
    const exportEntries = filtered.map((e) => ({
      day: e.day, period_no: e.period_no,
      subject_name: e.subjects?.name ?? "",
      teacher_name: e.teachers?.full_name ?? "",
      class_name: e.classes?.name ?? "",
      classroom_name: e.classrooms?.name,
    }));
    downloadScheduleExcel(exportEntries, workingDays, periodsPerDay, dayLabels, titleName, schoolName);
  };

  const exportExcelBatch = () => {
    const items = list;
    if (!items.length) { toast.error("لا توجد بيانات"); return; }
    for (const it of items) {
      const nm = "name" in it ? it.name : it.full_name;
      const itEntries = filterFor(it.id).map((e) => ({
        day: e.day, period_no: e.period_no,
        subject_name: e.subjects?.name ?? "",
        teacher_name: e.teachers?.full_name ?? "",
        class_name: e.classes?.name ?? "",
        classroom_name: e.classrooms?.name,
      }));
      downloadScheduleExcel(itEntries, workingDays, periodsPerDay, dayLabels, nm, schoolName);
    }
    toast.success(`تم تصدير ${items.length} جدول Excel`);
  };

  const exportCsv = () => {
    const head = ["اليوم", ...Array.from({ length: periodsPerDay }, (_, i) => `حصة ${i + 1}`)];
    const lines = [head.join(",")];
    workingDays.forEach((d) => {
      const row = [DAYS.find((x) => x.value === d)?.label ?? d];
      for (let p = 1; p <= periodsPerDay; p++) {
        const e = grid[`${d}:${p}`];
        const cell = e ? `${e.subjects?.name ?? ""} - ${viewType === "teacher" ? e.classes?.name ?? "" : e.teachers?.full_name ?? ""}` : "";
        row.push(`"${cell.replace(/"/g, '""')}"`);
      }
      lines.push(row.join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `جدول-${titleName}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!printRef.current) return;
    setBusy(true);
    try {
      await nodeToPdf(printRef.current, {
        title: viewType === "teacher" ? `جدول المعلم: ${titleName}` : `جدول الفصل: ${titleName}`,
        subtitle: `الأسبوع الدراسي • ${periodsPerDay} حصص يومياً`,
        schoolName,
        logoUrl: localLogoUrl,
      }, `جدول-${titleName}.pdf`);
      toast.success("تم إنشاء ملف PDF");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const exportPdfBatch = async () => {
    setBusy(true);
    try {
      const items = list;
      if (!items.length) { toast.error("لا توجد بيانات"); return; }
      const host = document.createElement("div");
      host.style.position = "fixed"; host.style.left = "-10000px"; host.style.top = "0";
      host.style.width = "1200px"; host.style.background = "#fff";
      document.body.appendChild(host);
      try {
        for (const it of items) {
          const nm = "name" in it ? it.name : it.full_name;
          host.innerHTML = "";
          renderTable(host, { entries: filterFor(it.id), periodsPerDay, workingDays, viewType: viewType === "teacher" ? "teacher" : "class", label: nm, schoolName, logoUrl: localLogoUrl });
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          await nodeToPdf(host, {
            title: viewType === "teacher" ? `جدول المعلم: ${nm}` : `جدول الفصل: ${nm}`,
            subtitle: `الأسبوع الدراسي • ${periodsPerDay} حصص يومياً`,
            schoolName,
            logoUrl: localLogoUrl,
          }, `جدول-${nm}.pdf`);
        }
      } finally { document.body.removeChild(host); }
      toast.success(`تم تصدير ${items.length} جدول`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="التقارير والطباعة" description="تصدير الجداول إلى PDF واكسل وطباعتها" />
      <Card className="mb-4 print:hidden"><CardContent className="p-4 flex flex-wrap items-center gap-3">
        <Tabs value={viewType} onValueChange={(v) => { setViewType(v as never); setSelectedId(""); setStageFilter("all"); }}>
          <TabsList>
            <TabsTrigger value="class">جدول فصل</TabsTrigger>
            <TabsTrigger value="teacher">جدول معلم</TabsTrigger>
            <TabsTrigger value="stage">حسب المرحلة</TabsTrigger>
          </TabsList>
        </Tabs>

        {viewType === "stage" && (
          <Select value={stageFilter} onValueChange={(v) => { setStageFilter(v as EducationStage | "all"); setSelectedId(""); }}>
            <SelectTrigger className="max-w-[180px]"><SelectValue placeholder="اختر المرحلة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع المراحل</SelectItem>
              {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={currentId} onValueChange={setSelectedId}>
          <SelectTrigger className="max-w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>{list.map((x) => <SelectItem key={x.id} value={x.id}>{"name" in x ? x.name : x.full_name}</SelectItem>)}</SelectContent>
        </Select>

        <Button onClick={exportPdf} disabled={busy || !currentId}>
          {busy ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <FileText className="ms-2 h-4 w-4" />} PDF
        </Button>
        <Button variant="secondary" onClick={exportPdfBatch} disabled={busy || !list.length}>
          <FileText className="ms-2 h-4 w-4" /> PDF للكل
        </Button>
        <Button variant="outline" onClick={exportExcel} disabled={!currentId}>
          <FileSpreadsheet className="ms-2 h-4 w-4" /> Excel
        </Button>
        <Button variant="outline" onClick={exportExcelBatch} disabled={!list.length}>
          <FileSpreadsheet className="ms-2 h-4 w-4" /> Excel للكل
        </Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="ms-2 h-4 w-4" /> طباعة</Button>
        <Button variant="outline" onClick={exportCsv}><Download className="ms-2 h-4 w-4" /> CSV</Button>
      </CardContent></Card>

      <div ref={printRef} className="bg-white text-black p-6 rounded-lg shadow print:shadow-none print:rounded-none">
        {/* Professional print header */}
        <div className="text-center mb-4 pb-4 border-b border-gray-300">
          <div className="flex items-center justify-center gap-4 mb-2">
            {localLogoUrl && (
              <img src={localLogoUrl} alt={schoolName} className="h-16 w-16 object-contain" />
            )}
            <div>
              <h1 className="text-2xl font-extrabold">{schoolName}</h1>
              <p className="text-base text-gray-600 mt-0.5">مجموعة المالكي التعليمية</p>
            </div>
          </div>
          <div className="mt-2 bg-gray-100 rounded-lg py-2 px-4 inline-block">
            <p className="text-lg font-bold">
              {viewType === "teacher" ? "جدول المعلم" : viewType === "stage" ? `جدول مرحلة: ${stageLabel(stageFilter as EducationStage)}` : "جدول الفصل"}:{" "}
              <span className="text-primary">{titleName}</span>
            </p>
            <p className="text-sm text-gray-500">الأسبوع الدراسي • {periodsPerDay} حصص يومياً • {workingDays.length} أيام</p>
          </div>
        </div>

        <ScheduleTable
          entries={filtered}
          periodsPerDay={periodsPerDay}
          workingDays={workingDays}
          viewType={viewType === "teacher" ? "teacher" : "class"}
        />
      </div>

      {/* Stage overview section */}
      {viewType === "stage" && filteredClasses.length > 1 && (
        <div className="mt-4 space-y-4 print:hidden">
          <h3 className="font-semibold text-base">
            جميع فصول {stageFilter !== "all" ? stageLabel(stageFilter as EducationStage) : "المراحل"} ({filteredClasses.length} فصل)
          </h3>
          <div className="flex gap-2 flex-wrap">
            {(filteredClasses as ClassItem[]).map((cls) => (
              <Button key={cls.id} size="sm" variant={currentId === cls.id ? "default" : "outline"} onClick={() => setSelectedId(cls.id)}>
                {cls.name} ({filterFor(cls.id).length} حصة)
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleTable({ entries, periodsPerDay, workingDays, viewType }: { entries: Entry[]; periodsPerDay: number; workingDays: DayOfWeek[]; viewType: "class" | "teacher" }) {
  const grid: Record<string, Entry | undefined> = {};
  entries.forEach((e) => { grid[`${e.day}:${e.period_no}`] = e; });
  return (
    <table className="w-full text-sm border-collapse border border-gray-400">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-400 p-2">اليوم / الحصة</th>
          {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map((p) => <th key={p} className="border border-gray-400 p-2">حصة {p}</th>)}
        </tr>
      </thead>
      <tbody>
        {workingDays.map((d) => (
          <tr key={d}>
            <td className="border border-gray-400 p-2 font-bold bg-gray-50 text-center">{DAYS.find((x) => x.value === d)?.label}</td>
            {Array.from({ length: periodsPerDay }, (_, i) => i + 1).map((p) => {
              const e = grid[`${d}:${p}`];
              return (
                <td key={p} className="border border-gray-400 p-2 align-top" style={{ borderInlineStartWidth: e ? 4 : 1, borderInlineStartColor: e?.subjects?.color ?? undefined }}>
                  {e ? (
                    <div>
                      <div className="font-semibold">{e.subjects?.name}</div>
                      <div className="text-xs">{viewType === "class" ? e.teachers?.full_name : e.classes?.name}</div>
                      {e.classrooms?.name && <div className="text-[10px] opacity-70">{e.classrooms.name}</div>}
                    </div>
                  ) : <span className="text-gray-300">—</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function renderTable(host: HTMLElement, opts: {
  entries: Entry[]; periodsPerDay: number; workingDays: DayOfWeek[];
  viewType: "class" | "teacher"; label: string; schoolName: string; logoUrl: string | null;
}) {
  const { entries, periodsPerDay, workingDays, viewType, label, schoolName, logoUrl } = opts;
  const grid: Record<string, Entry | undefined> = {};
  entries.forEach((e) => { grid[`${e.day}:${e.period_no}`] = e; });
  const dayLabel = (d: DayOfWeek) => DAYS.find((x) => x.value === d)?.label ?? d;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const ths = Array.from({ length: periodsPerDay }, (_, i) =>
    `<th style="border:1px solid #9ca3af;padding:8px;background:#f3f4f6">حصة ${i + 1}</th>`
  ).join("");
  const rows = workingDays.map((d) => {
    const tds = Array.from({ length: periodsPerDay }, (_, i) => {
      const e = grid[`${d}:${i + 1}`];
      if (!e) return `<td style="border:1px solid #9ca3af;padding:8px;text-align:center;color:#d1d5db">—</td>`;
      const bar = e.subjects?.color ?? "#e5e7eb";
      const second = viewType === "class" ? (e.teachers?.full_name ?? "") : (e.classes?.name ?? "");
      return `<td style="border:1px solid #9ca3af;border-inline-start:4px solid ${bar};padding:8px;vertical-align:top">
        <div style="font-weight:600">${esc(e.subjects?.name ?? "")}</div>
        <div style="font-size:11px">${esc(second)}</div>
        ${e.classrooms?.name ? `<div style="font-size:10px;opacity:0.7">${esc(e.classrooms.name)}</div>` : ""}
      </td>`;
    }).join("");
    return `<tr><td style="border:1px solid #9ca3af;padding:8px;font-weight:700;background:#f9fafb;text-align:center">${esc(dayLabel(d))}</td>${tds}</tr>`;
  }).join("");

  const logoHtml = logoUrl ? `<img src="${logoUrl}" style="height:60px;width:60px;object-fit:contain;margin-inline-end:12px;" />` : "";

  host.innerHTML = `
    <div dir="rtl" style="font-family:Cairo,Tajawal,sans-serif;padding:24px;background:#fff;color:#000">
      <div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #e5e7eb">
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:8px">
          ${logoHtml}
          <div>
            <h1 style="font-size:22px;font-weight:800;margin:0">${esc(schoolName)}</h1>
            <p style="margin:2px 0;color:#6b7280;font-size:13px">مجموعة المالكي التعليمية</p>
          </div>
        </div>
        <div style="background:#f3f4f6;border-radius:8px;padding:6px 16px;display:inline-block">
          <p style="margin:0;font-size:16px;font-weight:700">${viewType === "class" ? "جدول الفصل" : "جدول المعلم"}: ${esc(label)}</p>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #9ca3af;font-size:13px">
        <thead><tr><th style="border:1px solid #9ca3af;padding:8px;background:#f3f4f6">اليوم / الحصة</th>${ths}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

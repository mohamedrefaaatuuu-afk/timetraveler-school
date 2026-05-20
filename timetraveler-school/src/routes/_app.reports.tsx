import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, Download, FileText, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-helpers";
import { DAYS, type DayOfWeek } from "@/lib/constants";
import { nodeToPdf } from "@/lib/pdf-export";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({ component: ReportsPage });

interface Entry {
  id: string; day: DayOfWeek; period_no: number;
  class_id: string; teacher_id: string;
  subjects: { name: string; color: string } | null;
  teachers: { full_name: string } | null;
  classes: { name: string } | null;
  classrooms: { name: string } | null;
}

function ReportsPage() {
  const { schoolId } = useAuth();
  const [viewType, setViewType] = useState<"class" | "teacher">("class");
  const [selectedId, setSelectedId] = useState("");
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
    queryFn: async () => (await supabase.from("classes").select("id,name").eq("school_id", schoolId!).order("name")).data ?? [],
  });
  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers-mini", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("teachers").select("id,full_name").eq("school_id", schoolId!).order("full_name")).data ?? [],
  });
  const { data: entries = [] } = useQuery({
    queryKey: ["schedule", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("schedule_entries").select("*, subjects(name,color), teachers(full_name), classrooms(name), classes(name)").eq("school_id", schoolId!)).data as unknown as Entry[] ?? [],
  });

  const list = viewType === "class" ? classes : teachers;
  const currentId = selectedId || list[0]?.id || "";
  const headerName = list.find((x) => x.id === currentId);
  const titleName = headerName ? ("name" in headerName ? headerName.name : headerName.full_name) : "";

  const filterFor = (id: string) => entries.filter((e) => viewType === "class" ? e.class_id === id : e.teacher_id === id);
  const filtered = filterFor(currentId);
  const grid: Record<string, Entry | undefined> = {};
  filtered.forEach((e) => { grid[`${e.day}:${e.period_no}`] = e; });

  const exportCsv = () => {
    const head = ["اليوم", ...Array.from({ length: periodsPerDay }, (_, i) => `حصة ${i + 1}`)];
    const lines = [head.join(",")];
    workingDays.forEach((d) => {
      const row = [DAYS.find((x) => x.value === d)?.label ?? d];
      for (let p = 1; p <= periodsPerDay; p++) {
        const e = grid[`${d}:${p}`];
        const cell = e ? `${e.subjects?.name ?? ""} - ${viewType === "class" ? e.teachers?.full_name ?? "" : e.classes?.name ?? ""}` : "";
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
        title: viewType === "class" ? `جدول الفصل: ${titleName}` : `جدول المعلم: ${titleName}`,
        subtitle: `الأسبوع الدراسي • ${periodsPerDay} حصص يومياً`,
        schoolName: school?.name ?? "",
        logoUrl: school?.logo_url ?? null,
      }, `جدول-${titleName}.pdf`);
      toast.success("تم إنشاء ملف PDF");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const exportPdfBatch = async () => {
    setBusy(true);
    try {
      const items = list;
      if (!items.length) { toast.error("لا توجد بيانات للتصدير"); return; }
      const host = document.createElement("div");
      host.style.position = "fixed";
      host.style.left = "-10000px";
      host.style.top = "0";
      host.style.width = "1200px";
      host.style.background = "#fff";
      document.body.appendChild(host);
      try {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          const id = it.id;
          const nm = "name" in it ? it.name : it.full_name;
          host.innerHTML = "";
          renderTable(host, {
            entries: filterFor(id),
            periodsPerDay,
            workingDays,
            viewType,
            label: nm,
          });
          // small await for layout
          await new Promise((r) => requestAnimationFrame(() => r(null)));
          await nodeToPdf(host, {
            title: viewType === "class" ? `جدول الفصل: ${nm}` : `جدول المعلم: ${nm}`,
            subtitle: `الأسبوع الدراسي • ${periodsPerDay} حصص يومياً`,
            schoolName: school?.name ?? "",
            logoUrl: school?.logo_url ?? null,
          }, `جدول-${nm}.pdf`);
        }
      } finally {
        document.body.removeChild(host);
      }
      toast.success(`تم تصدير ${items.length} جدول`);
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="التقارير والطباعة" description="تصدير الجداول إلى PDF احترافي وطباعتها" />
      <Card className="mb-4 print:hidden"><CardContent className="p-4 flex flex-wrap items-center gap-3">
        <Tabs value={viewType} onValueChange={(v) => { setViewType(v as never); setSelectedId(""); }}>
          <TabsList>
            <TabsTrigger value="class">جدول فصل</TabsTrigger>
            <TabsTrigger value="teacher">جدول معلم</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={currentId} onValueChange={setSelectedId}>
          <SelectTrigger className="max-w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>{list.map((x) => <SelectItem key={x.id} value={x.id}>{"name" in x ? x.name : x.full_name}</SelectItem>)}</SelectContent>
        </Select>
        <Button onClick={exportPdf} disabled={busy || !currentId}>
          {busy ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <FileText className="ms-2 h-4 w-4" />} تصدير PDF
        </Button>
        <Button variant="secondary" onClick={exportPdfBatch} disabled={busy || !list.length}>
          <FileText className="ms-2 h-4 w-4" /> PDF لكل {viewType === "class" ? "الفصول" : "المعلمين"}
        </Button>
        <Button variant="outline" onClick={() => window.print()}><Printer className="ms-2 h-4 w-4" /> طباعة</Button>
        <Button variant="outline" onClick={exportCsv}><Download className="ms-2 h-4 w-4" /> CSV</Button>
      </CardContent></Card>

      <div ref={printRef} className="bg-white text-black p-6 rounded-lg shadow print:shadow-none print:rounded-none">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold">{school?.name ?? "الجدول الدراسي"}</h2>
          <p className="text-lg mt-1">{viewType === "class" ? "جدول الفصل" : "جدول المعلم"}: <span className="font-semibold">{titleName}</span></p>
        </div>
        <ScheduleTable
          entries={filtered}
          periodsPerDay={periodsPerDay}
          workingDays={workingDays}
          viewType={viewType}
        />
      </div>
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

/** Imperative renderer for offscreen batch capture (avoids ReactDOM.render in v19). */
function renderTable(host: HTMLElement, opts: { entries: Entry[]; periodsPerDay: number; workingDays: DayOfWeek[]; viewType: "class" | "teacher"; label: string }) {
  const { entries, periodsPerDay, workingDays, viewType, label } = opts;
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
  host.innerHTML = `
    <div dir="rtl" style="font-family:Cairo,Tajawal,sans-serif;padding:24px;background:#fff;color:#000">
      <div style="text-align:center;margin-bottom:16px">
        <h2 style="font-size:22px;font-weight:700;margin:0">${esc(label)}</h2>
        <p style="margin-top:4px">${viewType === "class" ? "جدول الفصل" : "جدول المعلم"}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #9ca3af;font-size:13px">
        <thead><tr><th style="border:1px solid #9ca3af;padding:8px;background:#f3f4f6">اليوم / الحصة</th>${ths}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

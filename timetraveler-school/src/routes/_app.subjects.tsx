import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logAction } from "@/lib/school";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SearchBar, ConfirmDelete } from "@/components/page-helpers";
import { STAGES, SUBJECT_COLORS, stageLabel } from "@/lib/constants";
import type { EducationStage } from "@/lib/constants";
import { downloadExcel, downloadTemplate } from "@/lib/excel-export";
import { ExcelImportDialog } from "@/components/excel-import-dialog";

export const Route = createFileRoute("/_app/subjects")({ component: SubjectsPage });

interface Subject {
  id: string; name: string; code: string | null; color: string;
  weekly_lessons: number; stage: EducationStage | null;
  needs_lab: boolean; double_period: boolean; is_core: boolean; priority: number;
}

function SubjectsPage() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["subjects", schoolId], enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("*").eq("school_id", schoolId!).order("name");
      if (error) throw error;
      return data as Subject[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<Subject>) => {
      if (editing) {
        const { error } = await supabase.from("subjects").update(input).eq("id", editing.id);
        if (error) throw error; await logAction("update", "subject", editing.id);
      } else {
        const { error } = await supabase.from("subjects").insert({ ...input, school_id: schoolId! } as never);
        if (error) throw error; await logAction("create", "subject");
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subjects"] }); toast.success(editing ? "تم التحديث" : "تمت الإضافة"); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("subjects").delete().eq("id", id); if (error) throw error; await logAction("delete", "subject", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subjects"] }); toast.success("تم الحذف"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = subjects.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.code?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="المواد الدراسية" description={`إجمالي ${subjects.length} مادة`} action={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="ms-2 h-4 w-4" /> إضافة مادة</Button></DialogTrigger>
          <SubjectDialog editing={editing} onSubmit={(d) => upsert.mutate(d)} submitting={upsert.isPending} />
        </Dialog>
      } />
      <Card><CardContent className="p-4">
        <div className="mb-4 flex flex-wrap gap-2 items-start justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="بحث بالاسم أو الكود..." />
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => downloadTemplate(["اسم المادة","الكود","المرحلة","الحصص الأسبوعية","تحتاج معمل","حصة مزدوجة","أساسية"], "المواد")}>
              <Download className="h-4 w-4 ms-1" /> قالب
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadExcel(filtered.map((s) => ({ "الاسم": s.name, "الكود": s.code ?? "", "المرحلة": stageLabel(s.stage), "الحصص الأسبوعية": s.weekly_lessons, "تحتاج معمل": s.needs_lab ? "نعم" : "لا", "حصة مزدوجة": s.double_period ? "نعم" : "لا", "أساسية": s.is_core ? "نعم" : "لا" })), "المواد_الدراسية", "المواد")}>
              <FileSpreadsheet className="h-4 w-4 ms-1" /> تصدير Excel
            </Button>
            <ExcelImportDialog
              entityName="مواد"
              columns={[
                { header: "اسم المادة", field: "name", required: true },
                { header: "الكود", field: "code" },
                { header: "المرحلة", field: "stage", transform: (v) => ({ "ابتدائي": "primary", "إعدادي": "preparatory", "ثانوي": "secondary" })[String(v)] ?? null },
                { header: "الحصص الأسبوعية", field: "weekly_lessons", transform: (v) => Number(v) || 4 },
                { header: "تحتاج معمل", field: "needs_lab", transform: (v) => String(v) === "نعم" },
                { header: "حصة مزدوجة", field: "double_period", transform: (v) => String(v) === "نعم" },
                { header: "أساسية", field: "is_core", transform: (v) => String(v) !== "لا" },
              ]}
              previewColumns={["اسم المادة", "الكود", "المرحلة", "الحصص الأسبوعية"]}
              templateNote="المرحلة: ابتدائي أو إعدادي أو ثانوي (اتركها فارغة للكل)"
              onImport={async (rows) => {
                const { error } = await supabase.from("subjects").insert(
                  rows.map((r) => ({
                    ...r,
                    school_id: schoolId,
                    color: SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)],
                    priority: 5,
                  })) as never
                );
                if (error) throw error;
                qc.invalidateQueries({ queryKey: ["subjects"] });
              }}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>اللون</TableHead><TableHead>الاسم</TableHead><TableHead>الكود</TableHead>
              <TableHead>المرحلة</TableHead><TableHead>حصص/أسبوع</TableHead>
              <TableHead>معمل</TableHead><TableHead>مزدوجة</TableHead><TableHead>أساسية</TableHead>
              <TableHead className="w-24">إجراءات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
              : filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell><div className="h-6 w-6 rounded-md border" style={{ background: s.color }} /></TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.code ?? "—"}</TableCell>
                  <TableCell>{stageLabel(s.stage)}</TableCell>
                  <TableCell>{s.weekly_lessons}</TableCell>
                  <TableCell>{s.needs_lab ? "✔" : "—"}</TableCell>
                  <TableCell>{s.double_period ? "✔" : "—"}</TableCell>
                  <TableCell>{s.is_core ? "✔" : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <ConfirmDelete onConfirm={() => del.mutate(s.id)} label={s.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>
    </div>
  );
}

function SubjectDialog({ editing, onSubmit, submitting }: { editing: Subject | null; onSubmit: (d: Partial<Subject>) => void; submitting: boolean }) {
  const [form, setForm] = useState<Partial<Subject>>(editing ?? {
    name: "", code: "", color: SUBJECT_COLORS[0], weekly_lessons: 4,
    stage: null, needs_lab: false, double_period: false, is_core: true, priority: 5,
  });
  return (
    <DialogContent className="max-w-2xl" dir="rtl">
      <DialogHeader><DialogTitle>{editing ? "تعديل مادة" : "إضافة مادة"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5 md:col-span-2"><Label>اسم المادة *</Label><Input required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>الكود</Label><Input value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>عدد الحصص الأسبوعية</Label><Input type="number" min={1} max={20} value={form.weekly_lessons ?? 1} onChange={(e) => setForm({ ...form, weekly_lessons: +e.target.value })} /></div>
        <div className="space-y-1.5">
          <Label>المرحلة</Label>
          <Select value={form.stage ?? "none"} onValueChange={(v) => setForm({ ...form, stage: v === "none" ? null : v as EducationStage })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">— الكل —</SelectItem>{STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>اللون</Label>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                className={`h-8 w-8 rounded-md border-2 transition-all ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2"><Switch checked={form.needs_lab ?? false} onCheckedChange={(v) => setForm({ ...form, needs_lab: v })} /><Label>تحتاج معمل</Label></div>
        <div className="flex items-center gap-2"><Switch checked={form.double_period ?? false} onCheckedChange={(v) => setForm({ ...form, double_period: v })} /><Label>حصة مزدوجة</Label></div>
        <div className="flex items-center gap-2"><Switch checked={form.is_core ?? true} onCheckedChange={(v) => setForm({ ...form, is_core: v })} /><Label>مادة أساسية</Label></div>
        <DialogFooter className="md:col-span-2"><Button type="submit" disabled={submitting}>{editing ? "حفظ" : "إضافة"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

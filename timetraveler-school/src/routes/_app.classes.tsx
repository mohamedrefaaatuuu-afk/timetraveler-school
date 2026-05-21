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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SearchBar, ConfirmDelete } from "@/components/page-helpers";
import { STAGES, stageLabel } from "@/lib/constants";
import type { EducationStage } from "@/lib/constants";
import { downloadExcel, downloadTemplate } from "@/lib/excel-export";
import { ExcelImportDialog } from "@/components/excel-import-dialog";

export const Route = createFileRoute("/_app/classes")({ component: ClassesPage });

interface Klass {
  id: string; name: string; stage: EducationStage;
  grade_level: number | null; students_count: number; daily_lessons: number;
}

function ClassesPage() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Klass | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["classes", schoolId], enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").eq("school_id", schoolId!).order("name");
      if (error) throw error; return data as Klass[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<Klass>) => {
      if (editing) { const { error } = await supabase.from("classes").update(input).eq("id", editing.id); if (error) throw error; await logAction("update", "class", editing.id); }
      else { const { error } = await supabase.from("classes").insert({ ...input, school_id: schoolId! } as never); if (error) throw error; await logAction("create", "class"); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes"] }); toast.success(editing ? "تم التحديث" : "تمت الإضافة"); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("classes").delete().eq("id", id); if (error) throw error; await logAction("delete", "class", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes"] }); toast.success("تم الحذف"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = rows.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="الفصول" description={`إجمالي ${rows.length} فصل`} action={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="ms-2 h-4 w-4" /> إضافة فصل</Button></DialogTrigger>
          <ClassDialog editing={editing} onSubmit={(d) => upsert.mutate(d)} submitting={upsert.isPending} />
        </Dialog>
      } />
      <Card><CardContent className="p-4">
        <div className="mb-4 flex flex-wrap gap-2 items-start justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="بحث باسم الفصل..." />
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => downloadTemplate(["اسم الفصل","المرحلة","الصف","عدد الطلاب","الحصص اليومية"], "الفصول")}>
              <Download className="h-4 w-4 ms-1" /> قالب
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadExcel(filtered.map((c) => ({ "الاسم": c.name, "المرحلة": stageLabel(c.stage), "الصف": c.grade_level ?? "", "عدد الطلاب": c.students_count, "الحصص اليومية": c.daily_lessons })), "الفصول", "الفصول")}>
              <FileSpreadsheet className="h-4 w-4 ms-1" /> تصدير Excel
            </Button>
            <ExcelImportDialog
              entityName="فصول"
              columns={[
                { header: "اسم الفصل", field: "name", required: true },
                { header: "المرحلة", field: "stage", transform: (v) => ({ "ابتدائي": "primary", "إعدادي": "preparatory", "ثانوي": "secondary" })[String(v)] ?? "primary" },
                { header: "الصف", field: "grade_level", transform: (v) => Number(v) || null },
                { header: "عدد الطلاب", field: "students_count", transform: (v) => Number(v) || 30 },
                { header: "الحصص اليومية", field: "daily_lessons", transform: (v) => Number(v) || 7 },
              ]}
              previewColumns={["اسم الفصل", "المرحلة", "الصف", "عدد الطلاب"]}
              templateNote="المرحلة: ابتدائي أو إعدادي أو ثانوي"
              onImport={async (rows) => {
                const { error } = await supabase.from("classes").insert(
                  rows.map((r) => ({ ...r, school_id: schoolId })) as never
                );
                if (error) throw error;
                qc.invalidateQueries({ queryKey: ["classes"] });
              }}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>الاسم</TableHead><TableHead>المرحلة</TableHead><TableHead>الصف</TableHead>
              <TableHead>عدد الطلاب</TableHead><TableHead>حصص/يوم</TableHead><TableHead className="w-24">إجراءات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
              : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{stageLabel(c.stage)}</TableCell>
                  <TableCell>{c.grade_level ?? "—"}</TableCell>
                  <TableCell>{c.students_count}</TableCell>
                  <TableCell>{c.daily_lessons}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <ConfirmDelete onConfirm={() => del.mutate(c.id)} label={c.name} />
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

function ClassDialog({ editing, onSubmit, submitting }: { editing: Klass | null; onSubmit: (d: Partial<Klass>) => void; submitting: boolean }) {
  const [form, setForm] = useState<Partial<Klass>>(editing ?? { name: "", stage: "primary", grade_level: 1, students_count: 30, daily_lessons: 7 });
  return (
    <DialogContent dir="rtl">
      <DialogHeader><DialogTitle>{editing ? "تعديل فصل" : "إضافة فصل"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2"><Label>اسم الفصل *</Label><Input required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثال: 1/أ" /></div>
        <div className="space-y-1.5"><Label>المرحلة</Label>
          <Select value={form.stage ?? "primary"} onValueChange={(v) => setForm({ ...form, stage: v as EducationStage })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>الصف</Label><Input type="number" min={1} max={12} value={form.grade_level ?? 1} onChange={(e) => setForm({ ...form, grade_level: +e.target.value })} /></div>
        <div className="space-y-1.5"><Label>عدد الطلاب</Label><Input type="number" min={1} value={form.students_count ?? 30} onChange={(e) => setForm({ ...form, students_count: +e.target.value })} /></div>
        <div className="space-y-1.5"><Label>الحصص اليومية</Label><Input type="number" min={1} max={12} value={form.daily_lessons ?? 7} onChange={(e) => setForm({ ...form, daily_lessons: +e.target.value })} /></div>
        <DialogFooter className="col-span-2"><Button type="submit" disabled={submitting}>{editing ? "حفظ" : "إضافة"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

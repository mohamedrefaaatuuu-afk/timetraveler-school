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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ConfirmDelete, SearchBar } from "@/components/page-helpers";

export const Route = createFileRoute("/_app/lessons")({ component: LessonsPage });

interface Row {
  id: string; class_id: string; subject_id: string; teacher_id: string | null;
  weekly_count: number; double_period: boolean;
  classes?: { name: string } | null;
  subjects?: { name: string; color: string } | null;
  teachers?: { full_name: string } | null;
}

function LessonsPage() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["class_subjects", schoolId], enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_subjects")
        .select("*, classes(name), subjects(name,color), teachers(full_name)")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-mini", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("classes").select("id,name").eq("school_id", schoolId!).order("name")).data ?? [],
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-mini", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("subjects").select("id,name,color").eq("school_id", schoolId!).order("name")).data ?? [],
  });
  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers-mini", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("teachers").select("id,full_name").eq("school_id", schoolId!).order("full_name")).data ?? [],
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<Row>) => {
      const payload = {
        class_id: input.class_id, subject_id: input.subject_id, teacher_id: input.teacher_id ?? null,
        weekly_count: input.weekly_count ?? 1, double_period: input.double_period ?? false,
      };
      if (editing) {
        const { error } = await supabase.from("class_subjects").update(payload).eq("id", editing.id);
        if (error) throw error; await logAction("update", "class_subject", editing.id);
      } else {
        const { error } = await supabase.from("class_subjects").insert({ ...payload, school_id: schoolId! } as never);
        if (error) throw error; await logAction("create", "class_subject");
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["class_subjects"] }); toast.success(editing ? "تم التحديث" : "تمت الإضافة"); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("class_subjects").delete().eq("id", id); if (error) throw error; await logAction("delete", "class_subject", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["class_subjects"] }); toast.success("تم الحذف"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = rows.filter((r) => {
    if (classFilter !== "all" && r.class_id !== classFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.subjects?.name ?? "").toLowerCase().includes(q) ||
      (r.classes?.name ?? "").toLowerCase().includes(q) ||
      (r.teachers?.full_name ?? "").toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader title="متطلبات الحصص" description="حدد المواد المطلوبة لكل فصل وعدد الحصص الأسبوعي" action={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="ms-2 h-4 w-4" /> إضافة متطلب</Button></DialogTrigger>
          <LessonDialog editing={editing} classes={classes} subjects={subjects} teachers={teachers} onSubmit={(d) => upsert.mutate(d)} submitting={upsert.isPending} />
        </Dialog>
      } />
      <Card><CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <SearchBar value={search} onChange={setSearch} placeholder="بحث..." />
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="max-w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفصول</SelectItem>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>الفصل</TableHead><TableHead>المادة</TableHead><TableHead>المعلم</TableHead>
              <TableHead>حصص/أسبوع</TableHead><TableHead>حصة مزدوجة</TableHead><TableHead className="w-24">إجراءات</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
              : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
              : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.classes?.name ?? "—"}</TableCell>
                  <TableCell><Badge style={{ background: r.subjects?.color, color: "#fff" }}>{r.subjects?.name ?? "—"}</Badge></TableCell>
                  <TableCell>{r.teachers?.full_name ?? <span className="text-muted-foreground">غير محدد</span>}</TableCell>
                  <TableCell>{r.weekly_count}</TableCell>
                  <TableCell>{r.double_period ? "نعم" : "لا"}</TableCell>
                  <TableCell><div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <ConfirmDelete onConfirm={() => del.mutate(r.id)} />
                  </div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent></Card>
    </div>
  );
}

function LessonDialog({ editing, classes, subjects, teachers, onSubmit, submitting }: {
  editing: Row | null;
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string; color: string }[];
  teachers: { id: string; full_name: string }[];
  onSubmit: (d: Partial<Row>) => void; submitting: boolean;
}) {
  const [form, setForm] = useState<Partial<Row>>(editing ?? { weekly_count: 1, double_period: false, teacher_id: null });
  return (
    <DialogContent dir="rtl">
      <DialogHeader><DialogTitle>{editing ? "تعديل متطلب" : "إضافة متطلب"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2"><Label>الفصل *</Label>
          <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
            <SelectTrigger><SelectValue placeholder="اختر الفصل" /></SelectTrigger>
            <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 col-span-2"><Label>المادة *</Label>
          <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
            <SelectTrigger><SelectValue placeholder="اختر المادة" /></SelectTrigger>
            <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 col-span-2"><Label>المعلم</Label>
          <Select value={form.teacher_id ?? "none"} onValueChange={(v) => setForm({ ...form, teacher_id: v === "none" ? null : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— غير محدد —</SelectItem>
              {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>حصص/أسبوع</Label>
          <Input type="number" min={1} max={20} value={form.weekly_count ?? 1} onChange={(e) => setForm({ ...form, weekly_count: +e.target.value })} />
        </div>
        <div className="space-y-1.5 flex items-end gap-2">
          <Checkbox id="dbl" checked={form.double_period ?? false} onCheckedChange={(v) => setForm({ ...form, double_period: !!v })} />
          <Label htmlFor="dbl">حصة مزدوجة</Label>
        </div>
        <DialogFooter className="col-span-2"><Button type="submit" disabled={submitting || !form.class_id || !form.subject_id}>{editing ? "حفظ" : "إضافة"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

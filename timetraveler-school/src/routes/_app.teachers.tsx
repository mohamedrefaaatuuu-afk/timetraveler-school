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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SearchBar, ConfirmDelete } from "@/components/page-helpers";
import { TeacherAvailabilityDialog } from "@/components/teacher-availability-dialog";

export const Route = createFileRoute("/_app/teachers")({ component: TeachersPage });

interface Teacher {
  id: string; full_name: string; employee_no: string | null;
  email: string | null; phone: string | null; specialization: string | null;
  max_daily_lessons: number; max_weekly_lessons: number; status: "active" | "inactive";
}

function TeachersPage() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [availFor, setAvailFor] = useState<Teacher | null>(null);

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ["teachers", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase.from("teachers").select("*").eq("school_id", schoolId!).order("full_name");
      if (error) throw error;
      return data as Teacher[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<Teacher>) => {
      if (editing) {
        const { error } = await supabase.from("teachers").update(input).eq("id", editing.id);
        if (error) throw error;
        await logAction("update", "teacher", editing.id);
      } else {
        const { error } = await supabase.from("teachers").insert({ ...input, school_id: schoolId! } as never);
        if (error) throw error;
        await logAction("create", "teacher");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teachers"] });
      toast.success(editing ? "تم التحديث" : "تمت الإضافة");
      setOpen(false); setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teachers").delete().eq("id", id);
      if (error) throw error;
      await logAction("delete", "teacher", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["teachers"] }); toast.success("تم الحذف"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = teachers.filter((t) =>
    t.full_name.toLowerCase().includes(search.toLowerCase()) ||
    t.employee_no?.toLowerCase().includes(search.toLowerCase()) ||
    t.specialization?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="المعلمون" description={`إجمالي ${teachers.length} معلم`} action={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="ms-2 h-4 w-4" /> إضافة معلم</Button>
          </DialogTrigger>
          <TeacherDialog editing={editing} onSubmit={(d) => upsert.mutate(d)} submitting={upsert.isPending} />
        </Dialog>
      } />

      <Card>
        <CardContent className="p-4">
          <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="بحث بالاسم أو الرقم أو التخصص..." /></div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>رقم الموظف</TableHead>
                  <TableHead>التخصص</TableHead>
                  <TableHead>البريد</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>الحد اليومي</TableHead>
                  <TableHead>الحد الأسبوعي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead className="w-24">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                ) : filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.full_name}</TableCell>
                    <TableCell>{t.employee_no ?? "—"}</TableCell>
                    <TableCell>{t.specialization ?? "—"}</TableCell>
                    <TableCell dir="ltr" className="text-start">{t.email ?? "—"}</TableCell>
                    <TableCell dir="ltr" className="text-start">{t.phone ?? "—"}</TableCell>
                    <TableCell>{t.max_daily_lessons}</TableCell>
                    <TableCell>{t.max_weekly_lessons}</TableCell>
                    <TableCell>
                      <Badge variant={t.status === "active" ? "default" : "secondary"}>
                        {t.status === "active" ? "نشط" : "غير نشط"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="توفّر المعلم" onClick={() => setAvailFor(t)}>
                          <CalendarClock className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <ConfirmDelete onConfirm={() => del.mutate(t.id)} label={t.full_name} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {availFor && (
        <TeacherAvailabilityDialog
          teacherId={availFor.id}
          teacherName={availFor.full_name}
          open={!!availFor}
          onOpenChange={(v) => { if (!v) setAvailFor(null); }}
        />
      )}
    </div>
  );
}

function TeacherDialog({ editing, onSubmit, submitting }: { editing: Teacher | null; onSubmit: (d: Partial<Teacher>) => void; submitting: boolean }) {
  const [form, setForm] = useState<Partial<Teacher>>(editing ?? {
    full_name: "", employee_no: "", email: "", phone: "", specialization: "",
    max_daily_lessons: 6, max_weekly_lessons: 24, status: "active",
  });
  return (
    <DialogContent className="max-w-2xl" dir="rtl">
      <DialogHeader><DialogTitle>{editing ? "تعديل معلم" : "إضافة معلم"}</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5 md:col-span-2"><Label>الاسم الكامل *</Label><Input required value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>رقم الموظف</Label><Input value={form.employee_no ?? ""} onChange={(e) => setForm({ ...form, employee_no: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>التخصص</Label><Input value={form.specialization ?? ""} onChange={(e) => setForm({ ...form, specialization: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>البريد</Label><Input type="email" dir="ltr" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>الهاتف</Label><Input dir="ltr" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>الحد اليومي للحصص</Label><Input type="number" min={1} max={12} value={form.max_daily_lessons ?? 6} onChange={(e) => setForm({ ...form, max_daily_lessons: +e.target.value })} /></div>
        <div className="space-y-1.5"><Label>الحد الأسبوعي للحصص</Label><Input type="number" min={1} max={60} value={form.max_weekly_lessons ?? 24} onChange={(e) => setForm({ ...form, max_weekly_lessons: +e.target.value })} /></div>
        <DialogFooter className="md:col-span-2"><Button type="submit" disabled={submitting}>{editing ? "حفظ التعديلات" : "إضافة"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

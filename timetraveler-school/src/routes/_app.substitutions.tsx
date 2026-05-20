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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ConfirmDelete } from "@/components/page-helpers";
import { DAYS, type DayOfWeek } from "@/lib/constants";

export const Route = createFileRoute("/_app/substitutions")({ component: SubsPage });

interface Sub {
  id: string; absence_date: string; reason: string | null; status: string;
  original_teacher_id: string; substitute_teacher_id: string | null; schedule_entry_id: string;
  original?: { full_name: string } | null;
  substitute?: { full_name: string } | null;
  schedule_entries?: { day: DayOfWeek; period_no: number; subjects: { name: string } | null; classes: { name: string } | null } | null;
}

function SubsPage() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["subs", schoolId], enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("substitutions")
        .select("*, original:teachers!substitutions_original_teacher_id_fkey(full_name), substitute:teachers!substitutions_substitute_teacher_id_fkey(full_name), schedule_entries(day, period_no, subjects(name), classes(name))")
        .eq("school_id", schoolId!)
        .order("absence_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Sub[];
    },
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers-mini", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("teachers").select("id,full_name").eq("school_id", schoolId!).order("full_name")).data ?? [],
  });
  const { data: entries = [] } = useQuery({
    queryKey: ["entries-mini", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("schedule_entries").select("id, day, period_no, teacher_id, subjects(name), classes(name)").eq("school_id", schoolId!)).data ?? [],
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<Sub>) => {
      const { error } = await supabase.from("substitutions").insert({ ...input, school_id: schoolId! } as never);
      if (error) throw error; await logAction("create", "substitution");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subs"] }); toast.success("تم تسجيل الاحتياطي"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, substitute_teacher_id }: { id: string; status: string; substitute_teacher_id?: string }) => {
      const upd: { status: string; substitute_teacher_id?: string } = { status };
      if (substitute_teacher_id) upd.substitute_teacher_id = substitute_teacher_id;
      const { error } = await supabase.from("substitutions").update(upd).eq("id", id); if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subs"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("substitutions").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subs"] }); toast.success("تم الحذف"); },
  });

  return (
    <div>
      <PageHeader title="الحصص الاحتياطية" description="إدارة غياب المعلمين وتعيين بدائل" action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="ms-2 h-4 w-4" /> تسجيل غياب</Button></DialogTrigger>
          <SubDialog teachers={teachers} entries={entries as never} onSubmit={(d) => upsert.mutate(d)} submitting={upsert.isPending} />
        </Dialog>
      } />
      <Card><CardContent className="p-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>التاريخ</TableHead><TableHead>المعلم الغائب</TableHead><TableHead>الحصة</TableHead>
            <TableHead>البديل</TableHead><TableHead>السبب</TableHead><TableHead>الحالة</TableHead><TableHead className="w-32">إجراءات</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
            : rows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد سجلات</TableCell></TableRow>
            : rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.absence_date}</TableCell>
                <TableCell className="font-medium">{s.original?.full_name}</TableCell>
                <TableCell className="text-xs">
                  {s.schedule_entries?.classes?.name} • {s.schedule_entries?.subjects?.name} • {DAYS.find((d) => d.value === s.schedule_entries?.day)?.label} ح{s.schedule_entries?.period_no}
                </TableCell>
                <TableCell>
                  <Select value={s.substitute_teacher_id ?? "none"} onValueChange={(v) => updateStatus.mutate({ id: s.id, status: v === "none" ? "pending" : "assigned", substitute_teacher_id: v === "none" ? undefined : v })}>
                    <SelectTrigger className="h-8 max-w-[160px]"><SelectValue placeholder="اختر بديل" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— لا أحد —</SelectItem>
                      {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs">{s.reason ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "assigned" ? "default" : s.status === "completed" ? "secondary" : "outline"}>
                    {s.status === "pending" ? "بانتظار" : s.status === "assigned" ? "مُعيّن" : "مكتمل"}
                  </Badge>
                </TableCell>
                <TableCell><ConfirmDelete onConfirm={() => del.mutate(s.id)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function SubDialog({ teachers, entries, onSubmit, submitting }: {
  teachers: { id: string; full_name: string }[];
  entries: { id: string; teacher_id: string; day: DayOfWeek; period_no: number; subjects: { name: string } | null; classes: { name: string } | null }[];
  onSubmit: (d: Partial<Sub>) => void; submitting: boolean;
}) {
  const [originalTeacher, setOriginalTeacher] = useState("");
  const [entryId, setEntryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const filteredEntries = entries.filter((e) => !originalTeacher || e.teacher_id === originalTeacher);

  return (
    <DialogContent dir="rtl">
      <DialogHeader><DialogTitle>تسجيل غياب معلم</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ original_teacher_id: originalTeacher, schedule_entry_id: entryId, absence_date: date, reason: reason || null, status: "pending" }); }} className="space-y-3">
        <div><Label>المعلم الغائب</Label>
          <Select value={originalTeacher} onValueChange={(v) => { setOriginalTeacher(v); setEntryId(""); }}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>{teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>الحصة المتأثرة</Label>
          <Select value={entryId} onValueChange={setEntryId}>
            <SelectTrigger><SelectValue placeholder="اختر حصة" /></SelectTrigger>
            <SelectContent>
              {filteredEntries.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.classes?.name} - {e.subjects?.name} - {DAYS.find((d) => d.value === e.day)?.label} ح{e.period_no}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div><Label>تاريخ الغياب</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div><Label>السبب (اختياري)</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter><Button type="submit" disabled={submitting || !originalTeacher || !entryId}>تسجيل</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

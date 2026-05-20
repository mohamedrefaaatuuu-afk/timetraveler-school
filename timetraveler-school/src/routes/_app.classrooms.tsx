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
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SearchBar, ConfirmDelete } from "@/components/page-helpers";
import { ROOM_TYPES, roomTypeLabel } from "@/lib/constants";
import type { ClassroomType } from "@/lib/constants";

export const Route = createFileRoute("/_app/classrooms")({ component: ClassroomsPage });

interface Room { id: string; name: string; type: ClassroomType; capacity: number; status: "active" | "inactive"; }

function ClassroomsPage() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["classrooms", schoolId], enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase.from("classrooms").select("*").eq("school_id", schoolId!).order("name");
      if (error) throw error; return data as Room[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<Room>) => {
      if (editing) { const { error } = await supabase.from("classrooms").update(input).eq("id", editing.id); if (error) throw error; await logAction("update", "classroom", editing.id); }
      else { const { error } = await supabase.from("classrooms").insert({ ...input, school_id: schoolId! } as never); if (error) throw error; await logAction("create", "classroom"); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classrooms"] }); toast.success(editing ? "تم التحديث" : "تمت الإضافة"); setOpen(false); setEditing(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("classrooms").delete().eq("id", id); if (error) throw error; await logAction("delete", "classroom", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classrooms"] }); toast.success("تم الحذف"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="القاعات والمعامل" description={`إجمالي ${rows.length}`} action={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button><Plus className="ms-2 h-4 w-4" /> إضافة قاعة</Button></DialogTrigger>
          <RoomDialog editing={editing} onSubmit={(d) => upsert.mutate(d)} submitting={upsert.isPending} />
        </Dialog>
      } />
      <Card><CardContent className="p-4">
        <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="بحث..." /></div>
        <Table>
          <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>النوع</TableHead><TableHead>السعة</TableHead><TableHead>الحالة</TableHead><TableHead className="w-24">إجراءات</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8">جاري التحميل...</TableCell></TableRow>
            : filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
            : filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{roomTypeLabel(r.type)}</TableCell>
                <TableCell>{r.capacity}</TableCell>
                <TableCell>{r.status === "active" ? "نشط" : "غير نشط"}</TableCell>
                <TableCell><div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <ConfirmDelete onConfirm={() => del.mutate(r.id)} label={r.name} />
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function RoomDialog({ editing, onSubmit, submitting }: { editing: Room | null; onSubmit: (d: Partial<Room>) => void; submitting: boolean }) {
  const [form, setForm] = useState<Partial<Room>>(editing ?? { name: "", type: "classroom", capacity: 30, status: "active" });
  return (
    <DialogContent dir="rtl">
      <DialogHeader><DialogTitle>{editing ? "تعديل" : "إضافة"} قاعة</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5 col-span-2"><Label>الاسم *</Label><Input required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>النوع</Label>
          <Select value={form.type ?? "classroom"} onValueChange={(v) => setForm({ ...form, type: v as ClassroomType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ROOM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>السعة</Label><Input type="number" min={1} value={form.capacity ?? 30} onChange={(e) => setForm({ ...form, capacity: +e.target.value })} /></div>
        <DialogFooter className="col-span-2"><Button type="submit" disabled={submitting}>{editing ? "حفظ" : "إضافة"}</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

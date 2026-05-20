import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logAction } from "@/lib/school";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ConfirmDelete } from "@/components/page-helpers";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/constraints")({ component: ConstraintsPage });

const TYPES = [
  { value: "no_back_to_back", label: "منع حصتين متتاليتين لنفس المادة" },
  { value: "morning_only", label: "حصة في الفترة الصباحية فقط" },
  { value: "afternoon_only", label: "حصة في الفترة المسائية فقط" },
  { value: "spread_subjects", label: "توزيع متوازن للمواد على الأسبوع" },
  { value: "teacher_free_day", label: "يوم راحة للمعلم" },
  { value: "custom", label: "قيد مخصص" },
];

const PRIORITIES = [
  { value: "low", label: "منخفض" },
  { value: "medium", label: "متوسط" },
  { value: "high", label: "مرتفع" },
  { value: "critical", label: "حرج" },
];

interface Row { id: string; type: string; priority: string; enabled: boolean; config: Record<string, unknown> }

function ConstraintsPage() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["constraints", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("scheduling_constraints").select("*").eq("school_id", schoolId!).order("created_at", { ascending: false })).data as Row[] ?? [],
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<Row>) => {
      const { error } = await supabase.from("scheduling_constraints").insert({ ...input, school_id: schoolId! } as never);
      if (error) throw error; await logAction("create", "constraint");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["constraints"] }); toast.success("تمت الإضافة"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (r: Row) => { const { error } = await supabase.from("scheduling_constraints").update({ enabled: !r.enabled }).eq("id", r.id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["constraints"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("scheduling_constraints").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["constraints"] }); toast.success("تم الحذف"); },
  });

  return (
    <div>
      <PageHeader title="قيود الجدولة" description="قواعد إضافية تُطبق عند توليد الجدول" action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="ms-2 h-4 w-4" /> إضافة قيد</Button></DialogTrigger>
          <ConstraintDialog onSubmit={(d) => upsert.mutate(d)} submitting={upsert.isPending} />
        </Dialog>
      } />
      <Card><CardContent className="p-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>النوع</TableHead><TableHead>الأولوية</TableHead><TableHead>التهيئة</TableHead><TableHead>الحالة</TableHead><TableHead className="w-24">إجراءات</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">جاري التحميل...</TableCell></TableRow>
            : rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">لا توجد قيود مضافة</TableCell></TableRow>
            : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{TYPES.find((t) => t.value === r.type)?.label ?? r.type}</TableCell>
                <TableCell><Badge variant={r.priority === "critical" ? "destructive" : "outline"}>{PRIORITIES.find((p) => p.value === r.priority)?.label}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{Object.keys(r.config).length ? JSON.stringify(r.config) : "—"}</TableCell>
                <TableCell><Switch checked={r.enabled} onCheckedChange={() => toggle.mutate(r)} /></TableCell>
                <TableCell><ConfirmDelete onConfirm={() => del.mutate(r.id)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}

function ConstraintDialog({ onSubmit, submitting }: { onSubmit: (d: Partial<Row>) => void; submitting: boolean }) {
  const [type, setType] = useState("no_back_to_back");
  const [priority, setPriority] = useState("medium");
  const [config, setConfig] = useState("{}");
  return (
    <DialogContent dir="rtl">
      <DialogHeader><DialogTitle>إضافة قيد جدولة</DialogTitle></DialogHeader>
      <form onSubmit={(e) => {
        e.preventDefault();
        let cfg = {};
        try { cfg = JSON.parse(config || "{}"); } catch { toast.error("JSON غير صالح"); return; }
        onSubmit({ type, priority: priority as never, config: cfg, enabled: true });
      }} className="space-y-3">
        <div><Label>النوع</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>الأولوية</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>التهيئة (JSON اختياري)</Label>
          <Textarea value={config} onChange={(e) => setConfig(e.target.value)} placeholder='{"key": "value"}' rows={4} className="font-mono text-xs" />
        </div>
        <DialogFooter><Button type="submit" disabled={submitting}>إضافة</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

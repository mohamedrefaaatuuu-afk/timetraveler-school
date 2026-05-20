import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logAction } from "@/lib/school";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DAYS, type DayOfWeek } from "@/lib/constants";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  teacherId: string;
  teacherName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/** aSc-style availability matrix: rows = days, cols = periods. Click to toggle. */
export function TeacherAvailabilityDialog({ teacherId, teacherName, open, onOpenChange }: Props) {
  const { schoolId } = useAuth();
  const qc = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["settings", schoolId], enabled: !!schoolId && open,
    queryFn: async () => (await supabase.from("school_settings").select("periods_per_day, working_days").eq("school_id", schoolId!).maybeSingle()).data,
  });

  const { data: teacher } = useQuery({
    queryKey: ["teacher-row", teacherId], enabled: open,
    queryFn: async () => (await supabase.from("teachers").select("working_days, max_daily_lessons, max_weekly_lessons").eq("id", teacherId).single()).data,
  });

  const { data: unav = [] } = useQuery({
    queryKey: ["unavailability", teacherId], enabled: open,
    queryFn: async () => (await supabase.from("teacher_unavailability").select("day, period_no").eq("teacher_id", teacherId)).data ?? [],
  });

  const periods = settings?.periods_per_day ?? 7;
  const allDays: DayOfWeek[] = (settings?.working_days as DayOfWeek[]) ?? ["sunday","monday","tuesday","wednesday","thursday"];

  const [workingDays, setWorkingDays] = useState<DayOfWeek[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [maxDaily, setMaxDaily] = useState(6);
  const [maxWeekly, setMaxWeekly] = useState(24);

  useEffect(() => {
    if (teacher) {
      setWorkingDays(teacher.working_days as DayOfWeek[]);
      setMaxDaily(teacher.max_daily_lessons);
      setMaxWeekly(teacher.max_weekly_lessons);
    }
  }, [teacher]);

  useEffect(() => {
    setBlocked(new Set((unav as { day: string; period_no: number }[]).map((u) => `${u.day}:${u.period_no}`)));
  }, [unav]);

  const key = (d: DayOfWeek, p: number) => `${d}:${p}`;
  const toggleCell = (d: DayOfWeek, p: number) => {
    const k = key(d, p);
    setBlocked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  };
  const toggleDay = (d: DayOfWeek) => {
    setWorkingDays((s) => s.includes(d) ? s.filter((x) => x !== d) : [...s, d]);
  };

  const save = useMutation({
    mutationFn: async () => {
      // 1) update teacher fields
      const { error: e1 } = await supabase.from("teachers")
        .update({ working_days: workingDays as never, max_daily_lessons: maxDaily, max_weekly_lessons: maxWeekly })
        .eq("id", teacherId);
      if (e1) throw e1;
      // 2) replace unavailability
      const { error: e2 } = await supabase.from("teacher_unavailability").delete().eq("teacher_id", teacherId);
      if (e2) throw e2;
      const rows = Array.from(blocked).map((k) => { const [day, p] = k.split(":"); return { teacher_id: teacherId, day, period_no: Number(p) }; });
      if (rows.length) {
        const { error: e3 } = await supabase.from("teacher_unavailability").insert(rows as never);
        if (e3) throw e3;
      }
      await logAction("update", "teacher_availability", teacherId, { blocked: rows.length });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["unavailability", teacherId] });
      qc.invalidateQueries({ queryKey: ["teacher-row", teacherId] });
      qc.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("تم حفظ توفر المعلم");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>توفّر المعلم — {teacherName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label className="mb-2 block">أيام العمل</Label>
            <div className="flex flex-wrap gap-3">
              {DAYS.filter((d) => allDays.includes(d.value)).map((d) => (
                <label key={d.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={workingDays.includes(d.value)} onCheckedChange={() => toggleDay(d.value)} />
                  <span>{d.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div>
              <Label>الحد اليومي للحصص</Label>
              <input type="number" className="w-full mt-1 border rounded px-2 py-1.5 bg-background" min={1} max={12} value={maxDaily} onChange={(e) => setMaxDaily(+e.target.value)} />
            </div>
            <div>
              <Label>الحد الأسبوعي</Label>
              <input type="number" className="w-full mt-1 border rounded px-2 py-1.5 bg-background" min={1} max={60} value={maxWeekly} onChange={(e) => setMaxWeekly(+e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>مصفوفة الأوقات (اضغط الخلية لمنع/إتاحة الحصة)</Label>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Check className="h-3 w-3 text-emerald-600" /> متاح</span>
                <span className="flex items-center gap-1"><X className="h-3 w-3 text-destructive" /> غير متاح</span>
              </div>
            </div>
            <div className="overflow-x-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-2 text-start font-medium border-e">اليوم</th>
                    {Array.from({ length: periods }, (_, i) => (
                      <th key={i} className="p-2 font-medium border-e last:border-e-0 min-w-12">{i + 1}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.filter((d) => allDays.includes(d.value)).map((d) => {
                    const isWorking = workingDays.includes(d.value);
                    return (
                      <tr key={d.value} className={cn("border-t", !isWorking && "opacity-40")}>
                        <td className="p-2 font-medium border-e bg-muted/30 whitespace-nowrap">{d.label}</td>
                        {Array.from({ length: periods }, (_, i) => {
                          const p = i + 1;
                          const isBlocked = blocked.has(key(d.value, p)) || !isWorking;
                          return (
                            <td key={p} className="p-1 border-e last:border-e-0 text-center">
                              <button
                                type="button"
                                disabled={!isWorking}
                                onClick={() => toggleCell(d.value, p)}
                                className={cn(
                                  "w-10 h-10 rounded transition-colors flex items-center justify-center mx-auto",
                                  isBlocked ? "bg-destructive/10 hover:bg-destructive/20 text-destructive" : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
                                  !isWorking && "cursor-not-allowed"
                                )}
                              >
                                {isBlocked ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              عدد الحصص الممنوعة: <span className="font-semibold text-foreground">{blocked.size}</span> — يستخدمها محرّك التوليد كقيد صلب.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

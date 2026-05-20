import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { logAction } from "@/lib/school";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-helpers";
import { DAYS, type DayOfWeek } from "@/lib/constants";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { schoolId, profile, refresh } = useAuth();
  const qc = useQueryClient();

  const { data: school } = useQuery({
    queryKey: ["school", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("schools").select("*").eq("id", schoolId!).maybeSingle()).data,
  });
  const { data: settings } = useQuery({
    queryKey: ["settings", schoolId], enabled: !!schoolId,
    queryFn: async () => (await supabase.from("school_settings").select("*").eq("school_id", schoolId!).maybeSingle()).data,
  });

  const [schoolForm, setSchoolForm] = useState({ name: "", phone: "", address: "" });
  const [settingsForm, setSettingsForm] = useState({
    periods_per_day: 7, period_duration_min: 45, break_after_period: 3, break_duration_min: 15,
    first_period_start: "08:00", working_days: ["sunday","monday","tuesday","wednesday","thursday"] as DayOfWeek[],
  });
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "" });

  useEffect(() => { if (school) setSchoolForm({ name: school.name ?? "", phone: school.phone ?? "", address: school.address ?? "" }); }, [school]);
  useEffect(() => { if (settings) setSettingsForm({
    periods_per_day: settings.periods_per_day, period_duration_min: settings.period_duration_min,
    break_after_period: settings.break_after_period ?? 3, break_duration_min: settings.break_duration_min,
    first_period_start: settings.first_period_start.slice(0, 5), working_days: settings.working_days as DayOfWeek[],
  }); }, [settings]);
  useEffect(() => { if (profile) setProfileForm({ full_name: profile.full_name ?? "", phone: "" }); }, [profile]);

  const saveSchool = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("schools").update(schoolForm).eq("id", schoolId!);
      if (error) throw error; await logAction("update", "school", schoolId!);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["school"] }); toast.success("تم حفظ بيانات المدرسة"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("school_settings").update({ ...settingsForm, first_period_start: settingsForm.first_period_start + ":00" }).eq("school_id", schoolId!);
      if (error) throw error; await logAction("update", "settings");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); toast.success("تم حفظ الإعدادات"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ full_name: profileForm.full_name, phone: profileForm.phone }).eq("id", profile!.id);
      if (error) throw error; await refresh();
    },
    onSuccess: () => toast.success("تم تحديث الملف"),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDay = (d: DayOfWeek) => {
    setSettingsForm((s) => ({ ...s, working_days: s.working_days.includes(d) ? s.working_days.filter((x) => x !== d) : [...s.working_days, d] }));
  };

  return (
    <div>
      <PageHeader title="الإعدادات" description="إعدادات المدرسة والملف الشخصي" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>بيانات المدرسة</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>اسم المدرسة</Label><Input value={schoolForm.name} onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })} /></div>
            <div><Label>الهاتف</Label><Input value={schoolForm.phone} onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })} /></div>
            <div><Label>العنوان</Label><Input value={schoolForm.address} onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })} /></div>
            <Button onClick={() => saveSchool.mutate()} disabled={saveSchool.isPending}>حفظ</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>الملف الشخصي</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>الاسم الكامل</Label><Input value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} /></div>
            <div><Label>الهاتف</Label><Input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} /></div>
            <div><Label>البريد</Label><Input value={profile?.email ?? ""} disabled /></div>
            <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>حفظ</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>إعدادات الجدول</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><Label>عدد الحصص اليومية</Label><Input type="number" min={1} max={12} value={settingsForm.periods_per_day} onChange={(e) => setSettingsForm({ ...settingsForm, periods_per_day: +e.target.value })} /></div>
              <div><Label>مدة الحصة (د)</Label><Input type="number" min={20} max={120} value={settingsForm.period_duration_min} onChange={(e) => setSettingsForm({ ...settingsForm, period_duration_min: +e.target.value })} /></div>
              <div><Label>الفسحة بعد الحصة</Label><Input type="number" min={0} max={10} value={settingsForm.break_after_period} onChange={(e) => setSettingsForm({ ...settingsForm, break_after_period: +e.target.value })} /></div>
              <div><Label>مدة الفسحة (د)</Label><Input type="number" min={5} max={60} value={settingsForm.break_duration_min} onChange={(e) => setSettingsForm({ ...settingsForm, break_duration_min: +e.target.value })} /></div>
              <div><Label>وقت بدء الحصة الأولى</Label><Input type="time" value={settingsForm.first_period_start} onChange={(e) => setSettingsForm({ ...settingsForm, first_period_start: e.target.value })} /></div>
            </div>
            <div>
              <Label className="mb-2 block">أيام العمل</Label>
              <div className="flex flex-wrap gap-3">
                {DAYS.map((d) => (
                  <label key={d.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={settingsForm.working_days.includes(d.value)} onCheckedChange={() => toggleDay(d.value)} />
                    <span>{d.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>حفظ الإعدادات</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

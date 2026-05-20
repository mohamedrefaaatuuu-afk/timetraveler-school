import type { Database } from "@/integrations/supabase/types";

export type DayOfWeek = Database["public"]["Enums"]["day_of_week"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type EducationStage = Database["public"]["Enums"]["education_stage"];
export type ClassroomType = Database["public"]["Enums"]["classroom_type"];

export const DAYS: { value: DayOfWeek; label: string; short: string }[] = [
  { value: "sunday", label: "الأحد", short: "أحد" },
  { value: "monday", label: "الإثنين", short: "إثن" },
  { value: "tuesday", label: "الثلاثاء", short: "ثلا" },
  { value: "wednesday", label: "الأربعاء", short: "أرب" },
  { value: "thursday", label: "الخميس", short: "خمي" },
  { value: "friday", label: "الجمعة", short: "جمع" },
  { value: "saturday", label: "السبت", short: "سبت" },
];

export const STAGES: { value: EducationStage; label: string }[] = [
  { value: "primary", label: "ابتدائي" },
  { value: "preparatory", label: "إعدادي" },
  { value: "secondary", label: "ثانوي" },
];

export const ROOM_TYPES: { value: ClassroomType; label: string }[] = [
  { value: "classroom", label: "فصل" },
  { value: "lab", label: "معمل" },
  { value: "gym", label: "صالة رياضية" },
  { value: "workshop", label: "ورشة" },
  { value: "library", label: "مكتبة" },
  { value: "other", label: "أخرى" },
];

export const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "مدير النظام" },
  { value: "principal", label: "مدير المدرسة" },
  { value: "scheduler", label: "منسق الجدول" },
  { value: "teacher", label: "معلم" },
];

export const SUBJECT_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

export const dayLabel = (d: DayOfWeek) => DAYS.find(x => x.value === d)?.label ?? d;
export const stageLabel = (s: EducationStage | null | undefined) =>
  s ? STAGES.find(x => x.value === s)?.label ?? s : "—";
export const roleLabel = (r: AppRole) => ROLES.find(x => x.value === r)?.label ?? r;
export const roomTypeLabel = (t: ClassroomType) => ROOM_TYPES.find(x => x.value === t)?.label ?? t;

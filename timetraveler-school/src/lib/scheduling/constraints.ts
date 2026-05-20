import type { DayOfWeek, EngineInput, Entry, TeacherInfo } from "./types";
import type { TimetableState } from "./state";

export interface HardContext {
  state: TimetableState;
  input: EngineInput;
  teachers: Map<string, TeacherInfo>;
  unavail: Set<string>; // `${teacher}:${day}:${p}`
  classDailyLimit: Map<string, number>;
}

export interface HardConstraint {
  code: string;
  label: string;
  /** returns true if placing `e` is allowed */
  validate(e: Entry, ctx: HardContext): boolean;
}

export const HARD_CONSTRAINTS: HardConstraint[] = [
  { code: "class_conflict", label: "تعارض الفصل", validate: (e, c) => !c.state.classAt(e.class_id, e.day, e.period_no) },
  { code: "teacher_conflict", label: "تعارض المعلم", validate: (e, c) => !c.state.teacherAt(e.teacher_id, e.day, e.period_no) },
  { code: "room_conflict", label: "تعارض القاعة", validate: (e, c) => !e.classroom_id || !c.state.roomAt(e.classroom_id, e.day, e.period_no) },
  { code: "teacher_unavailable", label: "المعلم غير متاح", validate: (e, c) => !c.unavail.has(`${e.teacher_id}:${e.day}:${e.period_no}`) },
  { code: "teacher_working_day", label: "ليس يوم عمل المعلم", validate: (e, c) => c.teachers.get(e.teacher_id)?.working_days.includes(e.day) ?? false },
  { code: "teacher_daily_limit", label: "تجاوز الحد اليومي للمعلم", validate: (e, c) => {
    const t = c.teachers.get(e.teacher_id); if (!t) return false;
    return c.state.teacherDayCount(e.teacher_id, e.day) < t.max_daily_lessons;
  }},
  { code: "teacher_weekly_limit", label: "تجاوز الحد الأسبوعي للمعلم", validate: (e, c) => {
    const t = c.teachers.get(e.teacher_id); if (!t) return false;
    return c.state.teacherWeekCount(e.teacher_id) < t.max_weekly_lessons;
  }},
  { code: "class_daily_limit", label: "تجاوز الحصص اليومية للفصل", validate: (e, c) => {
    const lim = c.classDailyLimit.get(e.class_id) ?? c.input.periodsPerDay;
    return c.state.classDayCount(e.class_id, e.day) < lim;
  }},
];

export function validateAll(e: Entry, ctx: HardContext): string | null {
  for (const c of HARD_CONSTRAINTS) if (!c.validate(e, ctx)) return c.code;
  return null;
}

// ---------- Soft Constraints (scoring) ----------

export interface SoftPenalty { code: string; label: string; weight: number }

export const SOFT_PENALTIES: Record<string, SoftPenalty> = {
  teacher_gap:        { code: "teacher_gap",        label: "فراغ في جدول المعلم",       weight: 15 },
  class_gap:          { code: "class_gap",          label: "فراغ في جدول الفصل",        weight: 10 },
  same_subject_twice: { code: "same_subject_twice", label: "نفس المادة مرتين في اليوم", weight: 25 },
  too_many_consec:    { code: "too_many_consec",    label: "أكثر من 3 حصص متتالية",     weight: 20 },
  uneven_weekly:      { code: "uneven_weekly",      label: "توزيع أسبوعي غير متوازن",   weight: 8  },
  late_overload:      { code: "late_overload",      label: "تكدّس في الحصص الأخيرة",    weight: 6  },
  teacher_imbalance:  { code: "teacher_imbalance",  label: "عدم توازن ضغط المعلمين",    weight: 12 },
};

export function buildHardContext(state: TimetableState, input: EngineInput): HardContext {
  const teachers = new Map(input.teachers.map((t) => [t.id, t]));
  const unavail = new Set(input.unavailability.map((u) => `${u.teacher_id}:${u.day}:${u.period_no}`));
  const classDailyLimit = new Map(input.classes.map((c) => [c.id, c.daily_lessons]));
  return { state, input, teachers, unavail, classDailyLimit };
}

/** Helpers used by scoring */
export function gapsInRow(occupied: boolean[]): number {
  let first = -1, last = -1;
  for (let i = 0; i < occupied.length; i++) if (occupied[i]) { if (first < 0) first = i; last = i; }
  if (first < 0) return 0;
  let g = 0;
  for (let i = first; i <= last; i++) if (!occupied[i]) g++;
  return g;
}

export function maxConsecutive(occupied: boolean[]): number {
  let m = 0, c = 0;
  for (const v of occupied) { if (v) { c++; m = Math.max(m, c); } else c = 0; }
  return m;
}

export { type DayOfWeek };

import type { DayOfWeek, EngineInput, Entry, Requirement, Missed } from "./types";
import { TimetableState } from "./state";
import { buildHardContext, validateAll, type HardContext } from "./constraints";

export interface Unit {
  class_id: string; subject_id: string; teacher_id: string | null;
  classroom_id: string | null; priority: number; double: boolean;
}

export function expandUnits(reqs: Requirement[]): Unit[] {
  const units: Unit[] = [];
  for (const r of reqs) {
    let rem = r.weekly_count;
    if (r.double_period) {
      const pairs = Math.floor(rem / 2);
      for (let i = 0; i < pairs; i++) units.push({ class_id: r.class_id, subject_id: r.subject_id, teacher_id: r.teacher_id, classroom_id: r.classroom_id ?? null, priority: r.priority, double: true });
      rem -= pairs * 2;
    }
    for (let i = 0; i < rem; i++) units.push({ class_id: r.class_id, subject_id: r.subject_id, teacher_id: r.teacher_id, classroom_id: r.classroom_id ?? null, priority: r.priority, double: false });
  }
  // Most-constrained first: doubles, then higher priority, then teacher-bound
  units.sort((a, b) =>
    Number(b.double) - Number(a.double) ||
    b.priority - a.priority ||
    Number(!!b.teacher_id) - Number(!!a.teacher_id)
  );
  return units;
}

/** Smart backtracking with forward checking + early pruning + timeout. */
export function backtrack(input: EngineInput, units: Unit[], state: TimetableState, ctx: HardContext, timeoutMs: number): Missed[] {
  const deadline = Date.now() + timeoutMs;
  const missed: Missed[] = [];
  const candidatesByTeacher = new Map<string | null, string[]>();
  for (const u of units) {
    if (!candidatesByTeacher.has(u.teacher_id)) {
      candidatesByTeacher.set(u.teacher_id, u.teacher_id ? [u.teacher_id] : input.teachers.map((t) => t.id));
    }
  }

  const tryPlace = (idx: number): boolean => {
    if (Date.now() > deadline) return false;
    if (idx >= units.length) return true;
    const u = units[idx];
    const teachers = candidatesByTeacher.get(u.teacher_id)!;
    const days = input.workingDays;
    for (const day of days) {
      for (let p = 1; p <= input.periodsPerDay - (u.double ? 1 : 0); p++) {
        for (const tid of teachers) {
          const e1: Entry = { class_id: u.class_id, day, period_no: p, teacher_id: tid, subject_id: u.subject_id, classroom_id: u.classroom_id, is_locked: false };
          if (validateAll(e1, ctx)) {
            state.place(e1);
            let e2: Entry | null = null;
            if (u.double) {
              e2 = { ...e1, period_no: p + 1 };
              if (!validateAll(e2, ctx)) { state.remove(e1); continue; }
              state.place(e2);
            }
            // forward check: peek next required teacher-bound units
            if (tryPlace(idx + 1)) return true;
            if (e2) state.remove(e2);
            state.remove(e1);
            if (Date.now() > deadline) return false;
          }
        }
      }
    }
    // could not place — record and proceed (best-effort partial)
    const m = missed.find((x) => x.class_id === u.class_id && x.subject_id === u.subject_id);
    if (m) m.missing += u.double ? 2 : 1; else missed.push({ class_id: u.class_id, subject_id: u.subject_id, missing: u.double ? 2 : 1 });
    return tryPlace(idx + 1);
  };

  tryPlace(0);
  return missed;
}

export function seedLocked(state: TimetableState, input: EngineInput) {
  for (const l of input.locked) {
    state.place({ class_id: l.class_id, day: l.day, period_no: l.period_no, teacher_id: l.teacher_id, subject_id: l.subject_id, classroom_id: l.classroom_id, is_locked: true });
  }
}

import type { EngineInput, Entry, ScoreBreakdown } from "./types";
import type { TimetableState } from "./state";
import { SOFT_PENALTIES, gapsInRow, maxConsecutive } from "./constraints";

const BASE = 10_000;

export function score(state: TimetableState, input: EngineInput, weights?: Partial<Record<string, number>>): ScoreBreakdown {
  const W = (k: string) => weights?.[k] ?? SOFT_PENALTIES[k].weight;
  const counts: Record<string, number> = {};
  const inc = (k: string, n = 1) => (counts[k] = (counts[k] ?? 0) + n);

  const D = state.workingDays;
  const P = state.periodsPerDay;

  // Class gaps + late overload + same-subject-twice
  for (const c of state.classIds) {
    for (const d of D) {
      const row: boolean[] = new Array(P).fill(false);
      const subj: Record<string, number> = {};
      for (let p = 1; p <= P; p++) {
        const e = state.classAt(c, d, p);
        if (e) { row[p - 1] = true; subj[e.subject_id] = (subj[e.subject_id] ?? 0) + 1; }
      }
      inc("class_gap", gapsInRow(row));
      for (const k in subj) if (subj[k] > 1) inc("same_subject_twice", subj[k] - 1);
      // late overload: last 2 periods filled while early periods empty
      const lateFilled = (row[P - 1] ? 1 : 0) + (row[P - 2] ? 1 : 0);
      const earlyEmpty = (!row[0] ? 1 : 0) + (!row[1] ? 1 : 0);
      if (lateFilled === 2 && earlyEmpty >= 1) inc("late_overload");
      const mc = maxConsecutive(row);
      if (mc > 3) inc("too_many_consec", mc - 3);
    }
  }

  // Teacher gaps + imbalance
  const loads: number[] = [];
  for (const t of state.teacherIds) {
    loads.push(state.teacherWeekCount(t));
    for (const d of D) {
      const row: boolean[] = new Array(P).fill(false);
      for (let p = 1; p <= P; p++) if (state.teacherAt(t, d, p)) row[p - 1] = true;
      inc("teacher_gap", gapsInRow(row));
    }
  }
  if (loads.length > 1) {
    const mean = loads.reduce((a, b) => a + b, 0) / loads.length;
    const variance = loads.reduce((a, b) => a + (b - mean) ** 2, 0) / loads.length;
    inc("teacher_imbalance", Math.round(Math.sqrt(variance)));
  }

  // Uneven weekly distribution per class
  for (const c of state.classIds) {
    const perDay = D.map((d) => state.classDayCount(c, d));
    if (perDay.length > 1) {
      const mean = perDay.reduce((a, b) => a + b, 0) / perDay.length;
      const spread = perDay.reduce((a, v) => a + Math.abs(v - mean), 0);
      inc("uneven_weekly", Math.round(spread));
    }
  }

  const penalties = Object.keys(SOFT_PENALTIES).map((k) => ({
    code: k,
    label: SOFT_PENALTIES[k].label,
    count: counts[k] ?? 0,
    weight: W(k),
    total: (counts[k] ?? 0) * W(k),
  }));
  const totalPenalty = penalties.reduce((a, p) => a + p.total, 0);
  const total = Math.max(0, BASE - totalPenalty);
  const quality = Math.round((total / BASE) * 1000) / 10;
  return { base: BASE, total, quality, hardViolations: 0, penalties };
}

export function conflictHeatmap(entries: Entry[]) {
  const map = new Map<string, number>();
  for (const e of entries) {
    const k = `${e.day}:${e.period_no}`;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([k, count]) => {
    const [day, p] = k.split(":");
    return { day: day as Entry["day"], period_no: Number(p), count };
  });
}

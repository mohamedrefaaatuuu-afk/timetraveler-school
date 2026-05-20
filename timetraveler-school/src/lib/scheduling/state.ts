import type { DayOfWeek, Entry, EngineInput } from "./types";

/** Compact in-memory timetable with O(1) lookups. */
export class TimetableState {
  readonly workingDays: DayOfWeek[];
  readonly periodsPerDay: number;
  readonly classIds: string[];
  readonly teacherIds: string[];

  private classIdx = new Map<string, number>();
  private teacherIdx = new Map<string, number>();
  private dayIdx = new Map<DayOfWeek, number>();

  // index = classIdx * D*P + dayIdx * P + (period-1)
  private classGrid: (Entry | null)[];
  private teacherGrid: (Entry | null)[];
  private roomGrid = new Map<string, Entry>(); // key: roomId:dayIdx:p

  // counters
  classDay: Int16Array;     // C * D
  teacherDay: Int16Array;   // T * D
  teacherWeek: Int16Array;  // T

  // per-class per-day subject counts (for "same subject twice/day" detection)
  private classDaySubject = new Map<string, number>(); // `${c}:${d}:${subj}`

  constructor(input: EngineInput) {
    this.workingDays = input.workingDays;
    this.periodsPerDay = input.periodsPerDay;
    this.classIds = input.classes.map((c) => c.id);
    this.teacherIds = input.teachers.map((t) => t.id);
    this.classIds.forEach((id, i) => this.classIdx.set(id, i));
    this.teacherIds.forEach((id, i) => this.teacherIdx.set(id, i));
    this.workingDays.forEach((d, i) => this.dayIdx.set(d, i));

    const C = this.classIds.length;
    const T = this.teacherIds.length;
    const D = this.workingDays.length;
    const P = this.periodsPerDay;
    this.classGrid = new Array(C * D * P).fill(null);
    this.teacherGrid = new Array(T * D * P).fill(null);
    this.classDay = new Int16Array(C * D);
    this.teacherDay = new Int16Array(T * D);
    this.teacherWeek = new Int16Array(T);
  }

  private cIdx(c: string, d: DayOfWeek, p: number) {
    const ci = this.classIdx.get(c)!;
    const di = this.dayIdx.get(d)!;
    return ci * this.workingDays.length * this.periodsPerDay + di * this.periodsPerDay + (p - 1);
  }
  private tIdx(t: string, d: DayOfWeek, p: number) {
    const ti = this.teacherIdx.get(t)!;
    const di = this.dayIdx.get(d)!;
    return ti * this.workingDays.length * this.periodsPerDay + di * this.periodsPerDay + (p - 1);
  }

  classAt(c: string, d: DayOfWeek, p: number) { return this.classGrid[this.cIdx(c, d, p)]; }
  teacherAt(t: string, d: DayOfWeek, p: number) { return this.teacherGrid[this.tIdx(t, d, p)]; }
  roomAt(r: string, d: DayOfWeek, p: number) {
    return this.roomGrid.get(`${r}:${this.dayIdx.get(d)}:${p}`);
  }

  canPlace(e: Entry): boolean {
    if (this.classGrid[this.cIdx(e.class_id, e.day, e.period_no)]) return false;
    if (this.teacherGrid[this.tIdx(e.teacher_id, e.day, e.period_no)]) return false;
    if (e.classroom_id && this.roomGrid.has(`${e.classroom_id}:${this.dayIdx.get(e.day)}:${e.period_no}`)) return false;
    return true;
  }

  place(e: Entry) {
    this.classGrid[this.cIdx(e.class_id, e.day, e.period_no)] = e;
    this.teacherGrid[this.tIdx(e.teacher_id, e.day, e.period_no)] = e;
    if (e.classroom_id) this.roomGrid.set(`${e.classroom_id}:${this.dayIdx.get(e.day)}:${e.period_no}`, e);
    const ci = this.classIdx.get(e.class_id)!;
    const ti = this.teacherIdx.get(e.teacher_id)!;
    const di = this.dayIdx.get(e.day)!;
    this.classDay[ci * this.workingDays.length + di]++;
    this.teacherDay[ti * this.workingDays.length + di]++;
    this.teacherWeek[ti]++;
    const k = `${e.class_id}:${e.day}:${e.subject_id}`;
    this.classDaySubject.set(k, (this.classDaySubject.get(k) ?? 0) + 1);
  }

  remove(e: Entry) {
    this.classGrid[this.cIdx(e.class_id, e.day, e.period_no)] = null;
    this.teacherGrid[this.tIdx(e.teacher_id, e.day, e.period_no)] = null;
    if (e.classroom_id) this.roomGrid.delete(`${e.classroom_id}:${this.dayIdx.get(e.day)}:${e.period_no}`);
    const ci = this.classIdx.get(e.class_id)!;
    const ti = this.teacherIdx.get(e.teacher_id)!;
    const di = this.dayIdx.get(e.day)!;
    this.classDay[ci * this.workingDays.length + di]--;
    this.teacherDay[ti * this.workingDays.length + di]--;
    this.teacherWeek[ti]--;
    const k = `${e.class_id}:${e.day}:${e.subject_id}`;
    const v = (this.classDaySubject.get(k) ?? 1) - 1;
    if (v <= 0) this.classDaySubject.delete(k); else this.classDaySubject.set(k, v);
  }

  classDayCount(c: string, d: DayOfWeek) {
    return this.classDay[this.classIdx.get(c)! * this.workingDays.length + this.dayIdx.get(d)!];
  }
  teacherDayCount(t: string, d: DayOfWeek) {
    return this.teacherDay[this.teacherIdx.get(t)! * this.workingDays.length + this.dayIdx.get(d)!];
  }
  teacherWeekCount(t: string) { return this.teacherWeek[this.teacherIdx.get(t)!]; }
  subjectDayCount(c: string, d: DayOfWeek, subj: string) {
    return this.classDaySubject.get(`${c}:${d}:${subj}`) ?? 0;
  }

  allEntries(): Entry[] {
    const out: Entry[] = [];
    for (const e of this.classGrid) if (e) out.push(e);
    return out;
  }

  /** Stable signature for deduplication. */
  signature(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.classGrid.length; i++) {
      const e = this.classGrid[i];
      if (e) parts.push(`${i}:${e.teacher_id}:${e.subject_id}`);
    }
    return parts.join("|");
  }

  clone(): TimetableState {
    const c = Object.create(TimetableState.prototype) as TimetableState;
    Object.assign(c, this);
    c.classGrid = this.classGrid.slice();
    c.teacherGrid = this.teacherGrid.slice();
    c.roomGrid = new Map(this.roomGrid);
    c.classDay = new Int16Array(this.classDay);
    c.teacherDay = new Int16Array(this.teacherDay);
    c.teacherWeek = new Int16Array(this.teacherWeek);
    c.classDaySubject = new Map(this.classDaySubject);
    return c;
  }
}

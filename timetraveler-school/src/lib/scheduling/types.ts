import type { DayOfWeek } from "@/lib/constants";

export type { DayOfWeek };

export interface ClassInfo { id: string; daily_lessons: number }
export interface TeacherInfo {
  id: string;
  max_weekly_lessons: number;
  max_daily_lessons: number;
  working_days: DayOfWeek[];
}
export interface Unavailability { teacher_id: string; day: DayOfWeek; period_no: number }
export interface Requirement {
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
  weekly_count: number;
  double_period: boolean;
  priority: number; // 1..10
  classroom_id?: string | null;
}
export interface LockedEntry {
  id: string;
  class_id: string;
  day: DayOfWeek;
  period_no: number;
  teacher_id: string;
  subject_id: string;
  classroom_id: string | null;
}
export interface Entry {
  class_id: string;
  day: DayOfWeek;
  period_no: number;
  teacher_id: string;
  subject_id: string;
  classroom_id: string | null;
  is_locked: boolean;
}

export interface EngineInput {
  schoolId: string;
  workingDays: DayOfWeek[];
  periodsPerDay: number;
  classes: ClassInfo[];
  teachers: TeacherInfo[];
  unavailability: Unavailability[];
  requirements: Requirement[];
  locked: LockedEntry[];
  /** soft constraint weights (overrides defaults) */
  weights?: Partial<Record<string, number>>;
  /** algorithm tuning */
  options?: EngineOptions;
}

export interface EngineOptions {
  backtrackingTimeoutMs?: number;     // default 4000
  geneticGenerations?: number;        // default 40
  geneticPopulation?: number;         // default 24
  geneticMutationRate?: number;       // default 0.08
  geneticElitism?: number;            // default 0.15
  localSearchIterations?: number;     // default 1500
  qualityThreshold?: number;          // 0..100, retry if below
  maxRetries?: number;                // default 1
  onProgress?: (p: ProgressEvent) => void;
}

export interface ProgressEvent {
  phase: "load" | "backtracking" | "genetic" | "local-search" | "done";
  progress: number; // 0..1
  message?: string;
  bestScore?: number;
  bestQuality?: number;
}

export interface Missed { class_id: string; subject_id: string; missing: number }

export interface ScoreBreakdown {
  base: number;
  total: number;
  quality: number; // 0..100
  hardViolations: number;
  penalties: { code: string; label: string; count: number; weight: number; total: number }[];
}

export interface EngineResult {
  entries: Entry[];
  placed: number;
  missed: Missed[];
  score: ScoreBreakdown;
  conflictHeatmap: { day: DayOfWeek; period_no: number; count: number }[];
  retries: number;
}

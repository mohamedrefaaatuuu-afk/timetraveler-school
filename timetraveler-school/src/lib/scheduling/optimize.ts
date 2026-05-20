import type { EngineInput, Entry } from "./types";
import { TimetableState } from "./state";
import { buildHardContext, validateAll } from "./constraints";
import { score } from "./scoring";

/** Local search: random swaps + hill climbing. Mutates state to optimum found. */
export function localSearch(state: TimetableState, input: EngineInput, iterations: number, weights?: Partial<Record<string, number>>): number {
  let best = score(state, input, weights).total;
  const D = state.workingDays;
  const P = state.periodsPerDay;
  const ctx = buildHardContext(state, input);

  for (let it = 0; it < iterations; it++) {
    const entries = state.allEntries().filter((e) => !e.is_locked);
    if (entries.length < 2) break;
    const a = entries[Math.floor(Math.random() * entries.length)];
    // try moving `a` to a random empty slot in same class
    const day = D[Math.floor(Math.random() * D.length)];
    const p = 1 + Math.floor(Math.random() * P);
    if (a.day === day && a.period_no === p) continue;
    if (state.classAt(a.class_id, day, p)) {
      // swap with that entry if same class
      const b = state.classAt(a.class_id, day, p)!;
      if (b.is_locked) continue;
      state.remove(a); state.remove(b);
      const a2: Entry = { ...a, day, period_no: p };
      const b2: Entry = { ...b, day: a.day, period_no: a.period_no };
      if (validateAll(a2, ctx) && validateAll(b2, ctx)) {
        state.place(a2); state.place(b2);
        const s = score(state, input, weights).total;
        if (s > best) { best = s; continue; }
        state.remove(a2); state.remove(b2);
      }
      state.place(a); state.place(b);
    } else {
      state.remove(a);
      const a2: Entry = { ...a, day, period_no: p };
      if (validateAll(a2, ctx)) {
        state.place(a2);
        const s = score(state, input, weights).total;
        if (s > best) { best = s; continue; }
        state.remove(a2);
      }
      state.place(a);
    }
  }
  return best;
}

/** Lightweight genetic-style optimization: maintain `pop` candidate states, mutate, select best. */
export function geneticOptimize(seed: TimetableState, input: EngineInput, opts: {
  population: number; generations: number; mutationRate: number; elitism: number;
  onGen?: (g: number, bestScore: number) => void;
  weights?: Partial<Record<string, number>>;
}): TimetableState {
  const { population, generations, mutationRate, elitism, weights } = opts;
  let pop: { state: TimetableState; score: number }[] = [];
  for (let i = 0; i < population; i++) {
    const s = seed.clone();
    if (i > 0) mutate(s, input, mutationRate * 4, weights);
    pop.push({ state: s, score: score(s, input, weights).total });
  }
  pop.sort((a, b) => b.score - a.score);

  for (let g = 0; g < generations; g++) {
    const eliteCount = Math.max(1, Math.floor(population * elitism));
    const elites = pop.slice(0, eliteCount);
    const offspring: typeof pop = [];
    while (offspring.length + elites.length < population) {
      const parent = tournament(pop);
      const child = parent.state.clone();
      mutate(child, input, mutationRate, weights);
      offspring.push({ state: child, score: score(child, input, weights).total });
    }
    pop = [...elites, ...offspring].sort((a, b) => b.score - a.score);
    opts.onGen?.(g, pop[0].score);
  }
  return pop[0].state;
}

function tournament(pop: { state: TimetableState; score: number }[]) {
  const a = pop[Math.floor(Math.random() * pop.length)];
  const b = pop[Math.floor(Math.random() * pop.length)];
  return a.score >= b.score ? a : b;
}

function mutate(state: TimetableState, input: EngineInput, rate: number, weights?: Partial<Record<string, number>>) {
  const ctx = buildHardContext(state, input);
  const entries = state.allEntries().filter((e) => !e.is_locked);
  const swaps = Math.max(1, Math.floor(entries.length * rate));
  for (let i = 0; i < swaps; i++) {
    const a = entries[Math.floor(Math.random() * entries.length)];
    const b = entries[Math.floor(Math.random() * entries.length)];
    if (!a || !b || a === b) continue;
    if (a.class_id !== b.class_id) continue; // simpler: same-class swap to maintain validity
    state.remove(a); state.remove(b);
    const a2: Entry = { ...a, day: b.day, period_no: b.period_no };
    const b2: Entry = { ...b, day: a.day, period_no: a.period_no };
    if (validateAll(a2, ctx) && validateAll(b2, ctx)) {
      state.place(a2); state.place(b2);
    } else {
      state.place(a); state.place(b);
    }
  }
  void weights;
}

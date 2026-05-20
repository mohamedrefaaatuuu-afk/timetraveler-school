import type { EngineInput, EngineResult, Missed } from "./types";
import { TimetableState } from "./state";
import { buildHardContext } from "./constraints";
import { expandUnits, backtrack, seedLocked } from "./backtracking";
import { geneticOptimize, localSearch } from "./optimize";
import { score, conflictHeatmap } from "./scoring";

/** Hybrid scheduler: Backtracking → Genetic → Local Search, with retries. */
export async function runEngine(input: EngineInput): Promise<EngineResult> {
  const o = input.options ?? {};
  const onP = o.onProgress ?? (() => {});
  const maxRetries = o.maxRetries ?? 1;
  const qualityThreshold = o.qualityThreshold ?? 0;

  let attempt = 0;
  let best: EngineResult | null = null;

  while (attempt <= maxRetries) {
    onP({ phase: "load", progress: 0.02, message: `محاولة ${attempt + 1}` });
    const state = new TimetableState(input);
    seedLocked(state, input);
    const ctx = buildHardContext(state, input);
    const units = expandUnits(input.requirements);

    onP({ phase: "backtracking", progress: 0.1, message: "بحث ذكي مع التراجع..." });
    const missed: Missed[] = backtrack(input, units, state, ctx, o.backtrackingTimeoutMs ?? 4000);

    onP({ phase: "genetic", progress: 0.4, message: "تحسين جيني..." });
    const optimized = geneticOptimize(state, input, {
      population: o.geneticPopulation ?? 24,
      generations: o.geneticGenerations ?? 40,
      mutationRate: o.geneticMutationRate ?? 0.08,
      elitism: o.geneticElitism ?? 0.15,
      weights: input.weights,
      onGen: (g, sc) => onP({ phase: "genetic", progress: 0.4 + 0.4 * (g / (o.geneticGenerations ?? 40)), bestScore: sc }),
    });

    onP({ phase: "local-search", progress: 0.85, message: "بحث محلي..." });
    localSearch(optimized, input, o.localSearchIterations ?? 1500, input.weights);

    const sc = score(optimized, input, input.weights);
    const entries = optimized.allEntries();
    const result: EngineResult = {
      entries,
      placed: entries.filter((e) => !e.is_locked).length,
      missed,
      score: sc,
      conflictHeatmap: conflictHeatmap(entries),
      retries: attempt,
    };
    onP({ phase: "done", progress: 1, bestScore: sc.total, bestQuality: sc.quality });

    if (!best || sc.total > best.score.total) best = result;
    if (sc.quality >= qualityThreshold) break;
    attempt++;
  }

  return best!;
}

export * from "./types";

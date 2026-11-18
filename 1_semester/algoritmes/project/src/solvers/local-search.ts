import type { CostWeights } from "../core/cost.ts";
import type { Problem } from "../core/problem.ts";
import { Rng } from "../core/rng.ts";
import { Timetable } from "../core/timetable.ts";
import { UNASSIGNED, type Solution } from "../model.ts";
import { MoveSampler, type KempeStats, type MoveSamplerOptions } from "./moves.ts";
import { Solver, type SolveResult } from "./solver.ts";

export const DEFAULT_EVALUATIONS_PER_LESSON = 1000;

export interface LocalSearchOptions extends MoveSamplerOptions {
  seed?: number;
  evaluations?: number;
  weights?: Partial<CostWeights>;
}

export interface SearchResult extends SolveResult {
  startCost: number;
  cost: number;
  evaluations: number;
  kempe: KempeStats;
}

export abstract class SearchRun<R extends SearchResult = SearchResult> {
  readonly timetable: Timetable;
  readonly startCost: number;
  protected readonly rng: Rng;
  protected readonly sampler: MoveSampler;
  protected readonly budget: number;
  protected used = 0;
  private bestCost: number;
  private readonly best: Int32Array;

  constructor(problem: Problem, start: Solution, options: LocalSearchOptions) {
    this.timetable = Timetable.from(problem, start, options.weights);
    this.rng = new Rng(options.seed ?? 1);
    this.sampler = new MoveSampler(problem, this.rng, options);
    this.budget = options.evaluations ?? problem.nLessons * DEFAULT_EVALUATIONS_PER_LESSON;
    this.startCost = this.timetable.cost;
    this.bestCost = this.startCost;
    this.best = this.timetable.slotOf.slice();
  }

  get finished(): boolean {
    return this.used >= this.budget;
  }

  get cost(): number {
    return this.bestCost;
  }

  abstract advance(): void;

  abstract result(): R;

  protected applySampled(): number {
    const { sampler, timetable } = this;
    for (let i = 0; i < sampler.length; i++) timetable.move(sampler.lessons[i], sampler.to[i]);
    return timetable.cost;
  }

  protected revertSampled() {
    const { sampler, timetable } = this;
    for (let i = 0; i < sampler.length; i++) timetable.move(sampler.lessons[i], sampler.from[i]);
  }

  protected keepIfBest(cost: number) {
    if (cost >= this.bestCost) return;
    this.bestCost = cost;
    this.best.set(this.timetable.slotOf);
  }

  protected summary(): SearchResult {
    return { slotOf: this.best, startCost: this.startCost, cost: this.bestCost, evaluations: this.used, kempe: this.sampler.kempe };
  }
}

export abstract class LocalSearch<O extends LocalSearchOptions, R extends SearchResult> extends Solver<R> {
  protected readonly options: O;

  constructor(options: O) {
    super();
    this.options = options;
  }

  abstract start(problem: Problem, start: Solution): SearchRun<R>;

  solve(problem: Problem, start?: Solution): R {
    const run = this.start(problem, start ?? new Int32Array(problem.nLessons).fill(UNASSIGNED));
    while (!run.finished) run.advance();
    return run.result();
  }
}

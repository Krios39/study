import type { Problem } from "../core/problem.ts";
import type { Solution } from "../model.ts";
import { LocalSearch, SearchRun, type LocalSearchOptions, type SearchResult } from "./local-search.ts";

export const DEFAULT_START_TEMPERATURE = 20;
export const DEFAULT_END_TEMPERATURE = 1;

export interface AnnealingOptions extends LocalSearchOptions {
  startTemperature?: number;
  endTemperature?: number;
}

export interface AnnealingResult extends SearchResult {
  accepted: number;
  worsening: number;
}

export interface AnnealingStep {
  sampled: boolean;
  delta: number;
  accepted: boolean;
  roll: number;
}

export class Annealing extends LocalSearch<AnnealingOptions, AnnealingResult> {
  readonly name = "simulated annealing";

  constructor(options: AnnealingOptions = {}) {
    super(options);
  }

  start(problem: Problem, start: Solution): AnnealingRun {
    return new AnnealingRun(problem, start, this.options);
  }
}

export class AnnealingRun extends SearchRun<AnnealingResult> {
  readonly last: AnnealingStep = { sampled: false, delta: 0, accepted: false, roll: 0 };
  private readonly cooling: number;
  private temperature: number;
  private accepted = 0;
  private worsening = 0;

  constructor(problem: Problem, start: Solution, options: AnnealingOptions) {
    super(problem, start, options);
    const startTemperature = options.startTemperature ?? DEFAULT_START_TEMPERATURE;
    const endTemperature = options.endTemperature ?? DEFAULT_END_TEMPERATURE;
    this.cooling = Math.pow(endTemperature / startTemperature, 1 / Math.max(1, this.budget));
    this.temperature = startTemperature;
  }

  get currentTemperature(): number {
    return this.temperature;
  }

  advance() {
    const { last } = this;
    last.sampled = this.sampler.sample(this.timetable.slotOf);
    if (last.sampled) {
      const before = this.timetable.cost;
      const cost = this.applySampled();
      last.delta = cost - before;
      last.accepted = this.accept(last.delta);
      if (last.accepted) {
        this.sampler.noteAccepted();
        this.keepIfBest(cost);
      } else {
        this.revertSampled();
      }
    }
    this.temperature *= this.cooling;
    this.used++;
  }

  result(): AnnealingResult {
    return { ...this.summary(), accepted: this.accepted, worsening: this.worsening };
  }

  private accept(delta: number): boolean {
    this.last.roll = delta > 0 ? this.rng.next() : 0;
    if (delta > 0 && this.last.roll >= Math.exp(-delta / this.temperature)) return false;
    this.accepted++;
    if (delta > 0) this.worsening++;
    return true;
  }
}

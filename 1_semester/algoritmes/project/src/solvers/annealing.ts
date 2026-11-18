import type { Problem } from "../core/problem.ts";
import type { Solution } from "../model.ts";
import { LocalSearch, SearchRun, type LocalSearchOptions, type SearchResult } from "./local-search.ts";

export interface AnnealingOptions extends LocalSearchOptions {
  startTemperature?: number;
  endTemperature?: number;
}

export interface AnnealingResult extends SearchResult {
  accepted: number;
  worsening: number;
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
  private readonly cooling: number;
  private temperature: number;
  private accepted = 0;
  private worsening = 0;

  constructor(problem: Problem, start: Solution, options: AnnealingOptions) {
    super(problem, start, options);
    const startTemperature = options.startTemperature ?? 20;
    const endTemperature = options.endTemperature ?? 1;
    this.cooling = Math.pow(endTemperature / startTemperature, 1 / Math.max(1, this.budget));
    this.temperature = startTemperature;
  }

  get currentTemperature(): number {
    return this.temperature;
  }

  advance() {
    if (this.sampler.sample(this.timetable.slotOf)) {
      const before = this.timetable.cost;
      const cost = this.applySampled();
      if (this.accept(cost - before)) {
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
    if (delta > 0 && this.rng.next() >= Math.exp(-delta / this.temperature)) return false;
    this.accepted++;
    if (delta > 0) this.worsening++;
    return true;
  }
}

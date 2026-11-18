import type { Problem } from "../core/problem.ts";
import type { Solution } from "../model.ts";
import { LocalSearch, SearchRun, type LocalSearchOptions, type SearchResult } from "./local-search.ts";

export interface TabuOptions extends LocalSearchOptions {
  candidates?: number;
  tenure?: number;
}

export interface TabuResult extends SearchResult {
  steps: number;
  worsening: number;
  aspirated: number;
  blocked: number;
}

export class Tabu extends LocalSearch<TabuOptions, TabuResult> {
  readonly name = "tabu search";

  constructor(options: TabuOptions = {}) {
    super(options);
  }

  start(problem: Problem, start: Solution): TabuRun {
    return new TabuRun(problem, start, this.options);
  }
}

export class TabuRun extends SearchRun<TabuResult> {
  private readonly candidates: number;
  private readonly tenure: number;
  private readonly tabuUntil: Int32Array;
  private readonly chosenLessons: Int32Array;
  private readonly chosenTo: Int32Array;
  private steps = 0;
  private worsening = 0;
  private aspirated = 0;
  private blocked = 0;

  constructor(problem: Problem, start: Solution, options: TabuOptions) {
    super(problem, start, options);
    this.candidates = options.candidates ?? 20;
    this.tenure = options.tenure ?? 10;
    this.tabuUntil = new Int32Array(problem.nLessons);
    this.chosenLessons = new Int32Array(problem.nLessons);
    this.chosenTo = new Int32Array(problem.nLessons);
  }

  advance() {
    const { sampler, timetable, tabuUntil } = this;
    this.steps++;
    const current = timetable.cost;
    let chosenCost = Infinity;
    let chosenLength = 0;
    let chosenTabu = false;
    for (let k = 0; k < this.candidates && !this.finished; k++) {
      this.used++;
      if (!sampler.sample(timetable.slotOf)) continue;
      const length = sampler.length;
      let tabu = false;
      for (let i = 0; i < length && !tabu; i++) tabu = tabuUntil[sampler.lessons[i]] > this.steps;
      const cost = this.applySampled();
      this.revertSampled();
      if (tabu && cost >= this.cost) {
        this.blocked++;
        continue;
      }
      if (cost >= chosenCost) continue;
      chosenCost = cost;
      chosenLength = length;
      chosenTabu = tabu;
      this.chosenLessons.set(sampler.lessons.subarray(0, length));
      this.chosenTo.set(sampler.to.subarray(0, length));
    }
    if (chosenLength === 0) return;
    for (let i = 0; i < chosenLength; i++) {
      timetable.move(this.chosenLessons[i], this.chosenTo[i]);
      tabuUntil[this.chosenLessons[i]] = this.steps + this.tenure + Math.floor(this.rng.next() * (this.tenure / 2 + 1));
    }
    if (chosenTabu) this.aspirated++;
    if (chosenCost > current) this.worsening++;
    this.keepIfBest(chosenCost);
  }

  result(): TabuResult {
    return { ...this.summary(), steps: this.steps, worsening: this.worsening, aspirated: this.aspirated, blocked: this.blocked };
  }
}

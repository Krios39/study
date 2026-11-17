import type { Solution } from "./model.ts";
import { MoveSampler, type MoveSamplerOptions } from "./moves.ts";
import type { Problem } from "./problem.ts";
import { Rng } from "./rng.ts";
import { Timetable, type CostWeights } from "./timetable.ts";

export interface TabuOptions extends MoveSamplerOptions {
  seed?: number;
  evaluations?: number;
  candidates?: number;
  tenure?: number;
  weights?: Partial<CostWeights>;
}

export interface TabuResult {
  slotOf: Solution;
  startCost: number;
  cost: number;
  evaluations: number;
  steps: number;
  worsening: number;
  aspirated: number;
  blocked: number;
}

export class Tabu {
  static run(problem: Problem, start: Solution, options: TabuOptions = {}): TabuResult {
    const rng = new Rng(options.seed ?? 1);
    const timetable = Timetable.from(problem, start, options.weights);
    const sampler = new MoveSampler(problem, rng, options);
    const evaluations = options.evaluations ?? problem.nLessons * 1000;
    const candidates = options.candidates ?? 20;
    const tenure = options.tenure ?? 10;

    const tabuUntil = new Int32Array(problem.nLessons);
    const chosenLessons = new Int32Array(problem.nLessons);
    const chosenFrom = new Int32Array(problem.nLessons);
    const chosenTo = new Int32Array(problem.nLessons);

    const startCost = timetable.cost;
    let bestCost = startCost;
    const best = timetable.slotOf.slice();
    let used = 0;
    let steps = 0;
    let worsening = 0;
    let aspirated = 0;
    let blocked = 0;

    while (used < evaluations) {
      steps++;
      const current = timetable.cost;
      let chosenCost = Infinity;
      let chosenLength = 0;
      let chosenTabu = false;
      for (let k = 0; k < candidates && used < evaluations; k++) {
        used++;
        if (!sampler.sample(timetable.slotOf)) continue;
        const length = sampler.length;
        let tabu = false;
        for (let i = 0; i < length && !tabu; i++) tabu = tabuUntil[sampler.lessons[i]] > steps;
        for (let i = 0; i < length; i++) timetable.move(sampler.lessons[i], sampler.to[i]);
        const cost = timetable.cost;
        for (let i = 0; i < length; i++) timetable.move(sampler.lessons[i], sampler.from[i]);
        if (tabu && cost >= bestCost) {
          blocked++;
          continue;
        }
        if (cost >= chosenCost) continue;
        chosenCost = cost;
        chosenLength = length;
        chosenTabu = tabu;
        chosenLessons.set(sampler.lessons.subarray(0, length));
        chosenFrom.set(sampler.from.subarray(0, length));
        chosenTo.set(sampler.to.subarray(0, length));
      }
      if (chosenLength === 0) continue;
      for (let i = 0; i < chosenLength; i++) {
        timetable.move(chosenLessons[i], chosenTo[i]);
        tabuUntil[chosenLessons[i]] = steps + tenure + Math.floor(rng.next() * (tenure / 2 + 1));
      }
      if (chosenTabu) aspirated++;
      if (chosenCost > current) worsening++;
      if (chosenCost < bestCost) {
        bestCost = chosenCost;
        best.set(timetable.slotOf);
      }
    }
    return { slotOf: best, startCost, cost: bestCost, evaluations: used, steps, worsening, aspirated, blocked };
  }
}

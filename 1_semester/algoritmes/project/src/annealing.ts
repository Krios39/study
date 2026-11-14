import type { Solution } from "./model.ts";
import type { Problem } from "./problem.ts";
import { Rng } from "./rng.ts";
import { Timetable, type CostWeights } from "./timetable.ts";

export type MoveSet = "move" | "swap" | "both";

export interface AnnealingOptions {
  seed?: number;
  moves?: MoveSet;
  iterations?: number;
  startTemperature?: number;
  endTemperature?: number;
  weights?: Partial<CostWeights>;
}

export interface AnnealingResult {
  slotOf: Solution;
  startCost: number;
  cost: number;
  iterations: number;
  accepted: number;
  worsening: number;
}

export class Annealing {
  private readonly problem: Problem;
  private readonly timetable: Timetable;
  private readonly rng: Rng;
  private readonly moves: MoveSet;
  private readonly allowedStart: Int32Array;
  private readonly allowedList: Int32Array;
  private readonly classStart: Int32Array;
  private readonly classLessons: Int32Array;
  private temperature = 0;
  private accepted = 0;
  private worsening = 0;

  private constructor(problem: Problem, start: Solution, options: AnnealingOptions) {
    const { nLessons, nSlots, nClasses } = problem;
    this.problem = problem;
    this.timetable = Timetable.from(problem, start, options.weights);
    this.rng = new Rng(options.seed ?? 1);
    this.moves = options.moves ?? "both";

    this.allowedStart = new Int32Array(nLessons + 1);
    const allowed: number[] = [];
    for (let l = 0; l < nLessons; l++) {
      this.allowedStart[l] = allowed.length;
      for (let s = 0; s < nSlots; s++) if (problem.isAllowed(l, s)) allowed.push(s);
    }
    this.allowedStart[nLessons] = allowed.length;
    this.allowedList = Int32Array.from(allowed);

    this.classStart = new Int32Array(nClasses + 1);
    for (let l = 0; l < nLessons; l++) this.classStart[problem.lessonClass[l] + 1]++;
    for (let c = 0; c < nClasses; c++) this.classStart[c + 1] += this.classStart[c];
    this.classLessons = new Int32Array(nLessons);
    const fill = this.classStart.slice(0, nClasses);
    for (let l = 0; l < nLessons; l++) this.classLessons[fill[problem.lessonClass[l]]++] = l;
  }

  static run(problem: Problem, start: Solution, options: AnnealingOptions = {}): AnnealingResult {
    const run = new Annealing(problem, start, options);
    const iterations = options.iterations ?? problem.nLessons * 1000;
    const startTemperature = options.startTemperature ?? 20;
    const endTemperature = options.endTemperature ?? 0.1;
    const cooling = Math.pow(endTemperature / startTemperature, 1 / Math.max(1, iterations));

    const startCost = run.timetable.cost;
    let bestCost = startCost;
    const best = run.timetable.slotOf.slice();
    run.temperature = startTemperature;
    for (let i = 0; i < iterations; i++) {
      const useSwap = run.moves === "swap" || (run.moves === "both" && run.rng.next() < 0.5);
      const changed = useSwap ? run.trySwap() : run.tryMove();
      if (changed && run.timetable.cost < bestCost) {
        bestCost = run.timetable.cost;
        best.set(run.timetable.slotOf);
      }
      run.temperature *= cooling;
    }
    return { slotOf: best, startCost, cost: bestCost, iterations, accepted: run.accepted, worsening: run.worsening };
  }

  private pick(count: number): number {
    return Math.floor(this.rng.next() * count);
  }

  private accept(delta: number): boolean {
    if (delta > 0 && this.rng.next() >= Math.exp(-delta / this.temperature)) return false;
    this.accepted++;
    if (delta > 0) this.worsening++;
    return true;
  }

  private tryMove(): boolean {
    const { timetable } = this;
    const lesson = this.pick(this.problem.nLessons);
    const from = this.allowedStart[lesson];
    const count = this.allowedStart[lesson + 1] - from;
    if (count === 0) return false;
    const slot = this.allowedList[from + this.pick(count)];
    const old = timetable.slotOf[lesson];
    if (slot === old) return false;
    const before = timetable.cost;
    timetable.move(lesson, slot);
    if (this.accept(timetable.cost - before)) return true;
    timetable.move(lesson, old);
    return false;
  }

  private trySwap(): boolean {
    const { timetable, problem } = this;
    const a = this.pick(problem.nLessons);
    const cls = problem.lessonClass[a];
    const from = this.classStart[cls];
    const b = this.classLessons[from + this.pick(this.classStart[cls + 1] - from)];
    if (problem.lessonReq[a] === problem.lessonReq[b]) return false;
    if (timetable.slotOf[a] === timetable.slotOf[b]) return false;
    const before = timetable.cost;
    timetable.swap(a, b);
    if (this.accept(timetable.cost - before)) return true;
    timetable.swap(a, b);
    return false;
  }
}

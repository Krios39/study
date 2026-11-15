import { KempeChain } from "./kempe.ts";
import { UNASSIGNED, type Solution } from "./model.ts";
import type { Problem } from "./problem.ts";
import { Rng } from "./rng.ts";
import { Timetable, type CostWeights } from "./timetable.ts";

export type MoveSet = "move" | "swap" | "both";

export type KempeSlots = "any" | "sameDay" | "otherDay";

export interface AnnealingOptions {
  seed?: number;
  moves?: MoveSet;
  swapShare?: number;
  kempeShare?: number;
  kempeSlots?: KempeSlots;
  kempeMaxLength?: number;
  focusShare?: number;
  focusSize?: number;
  iterations?: number;
  startTemperature?: number;
  endTemperature?: number;
  weights?: Partial<CostWeights>;
}

export interface KempeStats {
  tried: number;
  tooLong: number;
  accepted: number;
  lengthSum: number;
  acceptedLengthSum: number;
  longest: number;
  triedByLength: number[];
  acceptedByLength: number[];
}

export const KEMPE_LENGTH_BUCKETS = 128;

export interface AnnealingResult {
  slotOf: Solution;
  startCost: number;
  cost: number;
  iterations: number;
  accepted: number;
  worsening: number;
  kempe: KempeStats;
}

export class Annealing {
  private readonly problem: Problem;
  private readonly timetable: Timetable;
  private readonly rng: Rng;
  private readonly moves: MoveSet;
  private readonly swapShare: number;
  private readonly kempeShare: number;
  private readonly kempeSlots: KempeSlots;
  private readonly kempeMaxLength: number;
  private readonly focusShare: number;
  private readonly focusSize: number;
  private readonly chain: KempeChain;
  private readonly kempe: KempeStats = {
    tried: 0,
    tooLong: 0,
    accepted: 0,
    lengthSum: 0,
    acceptedLengthSum: 0,
    longest: 0,
    triedByLength: new Array<number>(KEMPE_LENGTH_BUCKETS + 1).fill(0),
    acceptedByLength: new Array<number>(KEMPE_LENGTH_BUCKETS + 1).fill(0),
  };
  private readonly allowedStart: Int32Array;
  private readonly allowedList: Int32Array;
  private readonly classStart: Int32Array;
  private readonly classLessons: Int32Array;
  private readonly firstPeriod: Int32Array;
  private readonly maxPerDay: Int32Array;
  private temperature = 0;
  private accepted = 0;
  private worsening = 0;

  private constructor(problem: Problem, start: Solution, options: AnnealingOptions) {
    const { nLessons, nSlots, nClasses } = problem;
    this.problem = problem;
    this.timetable = Timetable.from(problem, start, options.weights);
    this.rng = new Rng(options.seed ?? 1);
    this.moves = options.moves ?? "both";
    this.swapShare = options.swapShare ?? 0.5;
    this.kempeShare = options.kempeShare ?? 0.5;
    this.kempeSlots = options.kempeSlots ?? "any";
    this.kempeMaxLength = options.kempeMaxLength ?? 16;
    this.focusShare = options.focusShare ?? 0;
    this.focusSize = options.focusSize ?? 2;
    this.chain = new KempeChain(problem);
    this.firstPeriod = Int32Array.from(problem.instance.classes, (c) => c.firstPeriod);
    this.maxPerDay = Int32Array.from(problem.instance.classes, (c) => c.maxPerDay);

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
    const endTemperature = options.endTemperature ?? 1;
    const cooling = Math.pow(endTemperature / startTemperature, 1 / Math.max(1, iterations));

    const startCost = run.timetable.cost;
    let bestCost = startCost;
    const best = run.timetable.slotOf.slice();
    run.temperature = startTemperature;
    for (let i = 0; i < iterations; i++) {
      let changed: boolean;
      if (run.kempeShare > 0 && run.rng.next() < run.kempeShare) changed = run.tryKempe();
      else if (run.moves === "swap" || (run.moves === "both" && run.rng.next() < run.swapShare)) changed = run.trySwap();
      else changed = run.tryMove();
      if (changed && run.timetable.cost < bestCost) {
        bestCost = run.timetable.cost;
        best.set(run.timetable.slotOf);
      }
      run.temperature *= cooling;
    }
    return {
      slotOf: best,
      startCost,
      cost: bestCost,
      iterations,
      accepted: run.accepted,
      worsening: run.worsening,
      kempe: run.kempe,
    };
  }

  private pick(count: number): number {
    return Math.floor(this.rng.next() * count);
  }

  private pickLesson(): number {
    let best = this.pick(this.problem.nLessons);
    if (this.focusShare <= 0 || this.rng.next() >= this.focusShare) return best;
    let worst = this.timetable.badness(best);
    for (let i = 1; i < this.focusSize; i++) {
      const other = this.pick(this.problem.nLessons);
      const badness = this.timetable.badness(other);
      if (badness > worst) {
        worst = badness;
        best = other;
      }
    }
    return best;
  }

  private accept(delta: number): boolean {
    if (delta > 0 && this.rng.next() >= Math.exp(-delta / this.temperature)) return false;
    this.accepted++;
    if (delta > 0) this.worsening++;
    return true;
  }

  private tryMove(): boolean {
    const { timetable } = this;
    const lesson = this.pickLesson();
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
    const a = this.pickLesson();
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

  private kempeTarget(lesson: number, home: number): number {
    const { problem } = this;
    if (this.kempeSlots === "any") {
      const from = this.allowedStart[lesson];
      const count = this.allowedStart[lesson + 1] - from;
      return count === 0 ? home : this.allowedList[from + this.pick(count)];
    }
    const cls = problem.lessonClass[lesson];
    const period = this.firstPeriod[cls] + this.pick(this.maxPerDay[cls]);
    let day = problem.dayOf(home);
    if (this.kempeSlots === "otherDay") day = (day + 1 + this.pick(problem.days - 1)) % problem.days;
    return problem.slot(day, period);
  }

  private tryKempe(): boolean {
    const { timetable, chain, kempe } = this;
    const lesson = this.pickLesson();
    const home = timetable.slotOf[lesson];
    if (home === UNASSIGNED) return false;
    const slot = this.kempeTarget(lesson, home);
    if (slot === home) return false;

    const length = chain.build(timetable.slotOf, lesson, slot);
    kempe.tried++;
    kempe.lengthSum += length;
    kempe.triedByLength[Math.min(length, KEMPE_LENGTH_BUCKETS)]++;
    if (length > kempe.longest) kempe.longest = length;
    if (length > this.kempeMaxLength) {
      kempe.tooLong++;
      return false;
    }

    const before = timetable.cost;
    for (let i = 0; i < length; i++) timetable.move(chain.lessons[i], chain.from[i] === home ? slot : home);
    if (this.accept(timetable.cost - before)) {
      kempe.accepted++;
      kempe.acceptedLengthSum += length;
      kempe.acceptedByLength[Math.min(length, KEMPE_LENGTH_BUCKETS)]++;
      return true;
    }
    for (let i = 0; i < length; i++) timetable.move(chain.lessons[i], chain.from[i]);
    return false;
  }
}

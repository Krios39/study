import type { Problem } from "../core/problem.ts";
import { UNASSIGNED, type Solution } from "../model.ts";
import { Solver, type SolveResult } from "./solver.ts";

export type LessonRule = "saturation" | "freeSlots";

export type SlotRule = "first" | "leastPenalty";

export interface SlotWeights {
  gap: number;
  sameSubjectInDay: number;
  dayLoad: number;
}

export interface DsaturOptions {
  respectAllowed?: boolean;
  lessonRule?: LessonRule;
  slotRule?: SlotRule;
  weights?: Partial<SlotWeights>;
}

export interface DsaturResult extends SolveResult {
  order: Int32Array;
}

export interface DsaturStep {
  lesson: number;
  slot: number;
}

export interface SlotReasons {
  gaps: number;
  repeats: number;
  load: number;
}

export const DEFAULT_SLOT_WEIGHTS: SlotWeights = { gap: 100, sameSubjectInDay: 1000, dayLoad: 1 };

export class Dsatur extends Solver<DsaturResult> {
  readonly name = "DSATUR";
  private readonly options: DsaturOptions;

  constructor(options: DsaturOptions = {}) {
    super();
    this.options = options;
  }

  static classic(): Dsatur {
    return new Dsatur();
  }

  static recommended(): Dsatur {
    return new Dsatur({ respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" });
  }

  start(problem: Problem): DsaturRun {
    return new DsaturRun(problem, this.options);
  }

  solve(problem: Problem): DsaturResult {
    const run = this.start(problem);
    while (run.step() !== undefined) continue;
    return run.result();
  }
}

export class DsaturRun {
  readonly reasons: SlotReasons = { gaps: 0, repeats: 0, load: 0 };
  private readonly problem: Problem;
  private readonly slotOf: Int32Array;
  private readonly order: Int32Array;
  private readonly done: Uint8Array;
  private readonly neighboursInSlot: Uint16Array;
  private readonly saturation: Int32Array;
  private readonly openDegree: Int32Array;
  private readonly freeSlots: Int32Array;
  private readonly classBusy: Uint8Array;
  private readonly subjectInDay: Uint8Array;
  private readonly firstPeriod: Int32Array;
  private readonly respectAllowed: boolean;
  private readonly lessonRule: LessonRule;
  private readonly slotRule: SlotRule;
  private readonly weights: SlotWeights;
  private placed = 0;

  constructor(problem: Problem, options: DsaturOptions) {
    const { nLessons, nSlots, nClasses, nSubjects, days } = problem;
    this.problem = problem;
    this.respectAllowed = options.respectAllowed ?? false;
    this.lessonRule = options.lessonRule ?? "saturation";
    this.slotRule = options.slotRule ?? "first";
    this.weights = { ...DEFAULT_SLOT_WEIGHTS, ...options.weights };
    this.slotOf = new Int32Array(nLessons).fill(UNASSIGNED);
    this.order = new Int32Array(nLessons);
    this.done = new Uint8Array(nLessons);
    this.neighboursInSlot = new Uint16Array(nLessons * nSlots);
    this.saturation = new Int32Array(nLessons);
    this.openDegree = new Int32Array(nLessons);
    this.freeSlots = new Int32Array(nLessons);
    for (let l = 0; l < nLessons; l++) {
      this.openDegree[l] = problem.degree(l);
      for (let s = 0; s < nSlots; s++) if (this.usable(l, s)) this.freeSlots[l]++;
    }
    this.classBusy = new Uint8Array(nClasses * nSlots);
    this.subjectInDay = new Uint8Array(nClasses * days * nSubjects);
    this.firstPeriod = Int32Array.from(problem.instance.classes, (c) => c.firstPeriod);
  }

  get finished(): boolean {
    return this.placed >= this.problem.nLessons;
  }

  get current(): Solution {
    return this.slotOf;
  }

  peek(): number | undefined {
    return this.finished ? undefined : this.pickLesson();
  }

  freeSlotsOf(lesson: number): number {
    return this.freeSlots[lesson];
  }

  openDegreeOf(lesson: number): number {
    return this.openDegree[lesson];
  }

  isPlaced(lesson: number): boolean {
    return this.done[lesson] === 1;
  }

  isFree(lesson: number, slot: number): boolean {
    return this.neighboursInSlot[lesson * this.problem.nSlots + slot] === 0 && this.usable(lesson, slot);
  }

  step(): DsaturStep | undefined {
    if (this.finished) return undefined;
    const lesson = this.pickLesson();
    const slot = this.pickSlot(lesson);
    this.place(lesson, slot);
    this.order[this.placed++] = lesson;
    return { lesson, slot };
  }

  result(): DsaturResult {
    return { slotOf: this.slotOf, order: this.order };
  }

  private usable(lesson: number, slot: number): boolean {
    return !this.respectAllowed || this.problem.isAllowed(lesson, slot);
  }

  private pickLesson(): number {
    const { done, openDegree } = this;
    const byFreeSlots = this.lessonRule === "freeSlots";
    let best = -1;
    let bestTightness = 0;
    for (let l = 0; l < done.length; l++) {
      if (done[l]) continue;
      const tightness = byFreeSlots ? -this.freeSlots[l] : this.saturation[l];
      if (best < 0 || tightness > bestTightness || (tightness === bestTightness && openDegree[l] > openDegree[best])) {
        best = l;
        bestTightness = tightness;
      }
    }
    return best;
  }

  private pickSlot(lesson: number): number {
    const { problem } = this;
    let best = UNASSIGNED;
    let bestPenalty = Infinity;
    for (let s = 0; s < problem.nSlots; s++) {
      if (!this.isFree(lesson, s)) continue;
      if (this.slotRule === "first") return s;
      const penalty = this.penalty(lesson, s);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = s;
      }
    }
    return best;
  }

  penalty(lesson: number, slot: number): number {
    const { problem, weights, reasons } = this;
    const cls = problem.lessonClass[lesson];
    const day = problem.dayOf(slot);
    const period = problem.periodOf(slot);
    const first = this.firstPeriod[cls];
    const dayBase = cls * problem.nSlots + day * problem.periods;

    let load = 0;
    let last = -1;
    for (let p = 0; p < problem.periods; p++) {
      if (this.classBusy[dayBase + p]) {
        load++;
        last = p;
      }
    }
    const gapsBefore = last < 0 ? 0 : last - first + 1 - load;
    const gapsAfter = Math.max(last, period) - first + 1 - (load + 1);
    reasons.gaps = gapsAfter - gapsBefore;
    reasons.repeats = this.subjectInDay[(cls * problem.days + day) * problem.nSubjects + problem.lessonSubject[lesson]];
    reasons.load = load;
    return weights.gap * reasons.gaps + weights.sameSubjectInDay * reasons.repeats + weights.dayLoad * reasons.load;
  }

  private place(lesson: number, slot: number) {
    const { problem } = this;
    this.slotOf[lesson] = slot;
    this.done[lesson] = 1;
    if (slot !== UNASSIGNED) {
      const cls = problem.lessonClass[lesson];
      this.classBusy[cls * problem.nSlots + slot] = 1;
      this.subjectInDay[(cls * problem.days + problem.dayOf(slot)) * problem.nSubjects + problem.lessonSubject[lesson]]++;
    }
    for (const n of problem.neighbours(lesson)) {
      this.openDegree[n]--;
      if (slot !== UNASSIGNED && this.neighboursInSlot[n * problem.nSlots + slot]++ === 0) {
        this.saturation[n]++;
        if (this.usable(n, slot)) this.freeSlots[n]--;
      }
    }
  }
}

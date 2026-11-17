import { KempeChain } from "./kempe.ts";
import { UNASSIGNED } from "./model.ts";
import type { Problem } from "./problem.ts";
import type { Rng } from "./rng.ts";

export interface MoveSamplerOptions {
  swapShare?: number;
  kempeShare?: number;
  kempeMaxLength?: number;
}

export class MoveSampler {
  readonly lessons: Int32Array;
  readonly from: Int32Array;
  readonly to: Int32Array;
  length = 0;

  private readonly problem: Problem;
  private readonly rng: Rng;
  private readonly swapShare: number;
  private readonly kempeShare: number;
  private readonly kempeMaxLength: number;
  private readonly chain: KempeChain;
  private readonly allowedStart: Int32Array;
  private readonly allowedList: Int32Array;
  private readonly classStart: Int32Array;
  private readonly classLessons: Int32Array;

  constructor(problem: Problem, rng: Rng, options: MoveSamplerOptions = {}) {
    const { nLessons, nSlots, nClasses } = problem;
    this.problem = problem;
    this.rng = rng;
    this.swapShare = options.swapShare ?? 0.5;
    this.kempeShare = options.kempeShare ?? 0.5;
    this.kempeMaxLength = options.kempeMaxLength ?? 16;
    this.chain = new KempeChain(problem);
    this.lessons = new Int32Array(nLessons);
    this.from = new Int32Array(nLessons);
    this.to = new Int32Array(nLessons);

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

  sample(slotOf: Int32Array): boolean {
    const roll = this.rng.next();
    if (roll < this.kempeShare) return this.kempe(slotOf);
    return this.rng.next() < this.swapShare ? this.swap(slotOf) : this.move(slotOf);
  }

  private pick(count: number): number {
    return Math.floor(this.rng.next() * count);
  }

  private target(lesson: number): number {
    const start = this.allowedStart[lesson];
    const count = this.allowedStart[lesson + 1] - start;
    return count === 0 ? UNASSIGNED : this.allowedList[start + this.pick(count)];
  }

  private move(slotOf: Int32Array): boolean {
    const lesson = this.pick(this.problem.nLessons);
    const slot = this.target(lesson);
    if (slot === UNASSIGNED || slot === slotOf[lesson]) return false;
    this.lessons[0] = lesson;
    this.from[0] = slotOf[lesson];
    this.to[0] = slot;
    this.length = 1;
    return true;
  }

  private swap(slotOf: Int32Array): boolean {
    const { problem } = this;
    const a = this.pick(problem.nLessons);
    const cls = problem.lessonClass[a];
    const start = this.classStart[cls];
    const b = this.classLessons[start + this.pick(this.classStart[cls + 1] - start)];
    if (problem.lessonReq[a] === problem.lessonReq[b] || slotOf[a] === slotOf[b]) return false;
    this.lessons[0] = a;
    this.from[0] = slotOf[a];
    this.to[0] = slotOf[b];
    this.lessons[1] = b;
    this.from[1] = slotOf[b];
    this.to[1] = slotOf[a];
    this.length = 2;
    return true;
  }

  private kempe(slotOf: Int32Array): boolean {
    const lesson = this.pick(this.problem.nLessons);
    const home = slotOf[lesson];
    if (home === UNASSIGNED) return false;
    const slot = this.target(lesson);
    if (slot === UNASSIGNED || slot === home) return false;
    const length = this.chain.build(slotOf, lesson, slot);
    if (length > this.kempeMaxLength) return false;
    for (let i = 0; i < length; i++) {
      this.lessons[i] = this.chain.lessons[i];
      this.from[i] = this.chain.from[i];
      this.to[i] = this.chain.from[i] === home ? slot : home;
    }
    this.length = length;
    return true;
  }
}

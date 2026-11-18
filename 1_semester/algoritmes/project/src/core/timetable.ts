import { UNASSIGNED, type Solution } from "../model.ts";
import {
  EASY_UP_TO,
  HEAVY_FROM,
  Weights,
  type CostWeights,
  type Evaluation,
  type HardViolations,
  type SoftStats,
} from "./cost.ts";
import type { Problem } from "./problem.ts";

export class Timetable {
  readonly problem: Problem;
  readonly weights: CostWeights;
  readonly slotOf: Int32Array;

  private readonly classCount: Uint8Array;
  private readonly teacherCount: Uint8Array;
  private readonly heavyAt: Uint8Array;
  private readonly easyAt: Uint8Array;
  private readonly subjectInDay: Uint8Array;
  private readonly dayLoad: Int32Array;
  private readonly dayScore: Int32Array;
  private readonly subjectScore: Int32Array;
  private readonly classScore: Int32Array;
  private readonly firstPeriod: Int32Array;
  private readonly maxPerDay: Int32Array;
  private readonly teacherWeek: Int32Array;
  private readonly gapOfClassDay: Int32Array;
  private readonly misplacedOfClassDay: Int32Array;
  private readonly imbalanceOfClass: Int32Array;
  private readonly gapOfTeacherDay: Int32Array;
  private readonly breakOfTeacherDay: Int32Array;
  private readonly idleOfTeacherDay: Int32Array;

  private classClash = 0;
  private teacherClash = 0;
  private unassigned = 0;
  private classSlot = 0;
  private classGap = 0;
  private teacherUnavailable = 0;
  private repeats = 0;
  private teacherGaps = 0;
  private gapSquares = 0;
  private shiftBreaks = 0;
  private shiftIdle = 0;
  private imbalance = 0;
  private loadSquares = 0;
  private loadSquaresFloor = 0;
  private spread = 0;
  private misplaced = 0;
  private wishesBroken = 0;

  private constructor(problem: Problem, weights: CostWeights) {
    const { nSlots, nClasses, nTeachers, nSubjects, nLessons, days } = problem;
    this.problem = problem;
    this.weights = weights;
    this.slotOf = new Int32Array(nLessons).fill(UNASSIGNED);
    this.classCount = new Uint8Array(nClasses * nSlots);
    this.teacherCount = new Uint8Array(nTeachers * nSlots);
    this.heavyAt = new Uint8Array(nClasses * nSlots);
    this.easyAt = new Uint8Array(nClasses * nSlots);
    this.subjectInDay = new Uint8Array(nClasses * days * nSubjects);
    this.dayLoad = new Int32Array(nClasses * days);
    this.dayScore = new Int32Array(nClasses * days);
    this.subjectScore = Int32Array.from(problem.instance.subjects, (s) => s.difficulty);
    this.classScore = new Int32Array(nClasses);
    for (let l = 0; l < nLessons; l++) this.classScore[problem.lessonClass[l]] += this.subjectScore[problem.lessonSubject[l]];
    this.firstPeriod = Int32Array.from(problem.instance.classes, (c) => c.firstPeriod);
    this.maxPerDay = Int32Array.from(problem.instance.classes, (c) => c.maxPerDay);
    this.teacherWeek = new Int32Array(nTeachers);
    this.gapOfClassDay = new Int32Array(nClasses * days);
    this.misplacedOfClassDay = new Int32Array(nClasses * days);
    this.imbalanceOfClass = new Int32Array(nClasses);
    this.gapOfTeacherDay = new Int32Array(nTeachers * days);
    this.breakOfTeacherDay = new Int32Array(nTeachers * days);
    this.idleOfTeacherDay = new Int32Array(nTeachers * days);
    const classHours = new Int32Array(nClasses);
    for (let l = 0; l < nLessons; l++) classHours[problem.lessonClass[l]]++;
    for (const hours of classHours) this.loadSquaresFloor += (hours * hours) / days;
    this.unassigned = nLessons;
    for (let c = 0; c < nClasses; c++) for (let d = 0; d < days; d++) this.spread += this.spreadOf(c, d);
  }

  static from(problem: Problem, slotOf: Solution, weights: Partial<CostWeights> = {}): Timetable {
    const timetable = new Timetable(problem, Weights.resolve(weights));
    for (let l = 0; l < problem.nLessons; l++) timetable.move(l, slotOf[l]);
    return timetable;
  }

  get hard(): number {
    return (
      this.classClash + this.teacherClash + this.unassigned + this.classSlot + this.classGap + this.teacherUnavailable
    );
  }

  get cost(): number {
    const w = this.weights;
    return (
      w.hard * this.hard +
      (w.difficulty * this.spread) / this.problem.days +
      w.sameSubjectInDay * this.repeats +
      w.teacherGap * this.gapSquares +
      w.shiftBreak * this.shiftBreaks +
      w.shiftIdle * this.shiftIdle +
      w.dayImbalance * this.imbalance +
      w.dayLoadSquare * (this.loadSquares - this.loadSquaresFloor) +
      w.misplaced * this.misplaced +
      w.teacherWish * this.wishesBroken
    );
  }

  get softCost(): number {
    return this.cost - this.weights.hard * this.hard;
  }

  evaluation(): Evaluation {
    return { hard: this.violations(), soft: this.soft(), cost: this.cost, softCost: this.softCost };
  }

  violations(): HardViolations {
    return {
      classClash: this.classClash,
      teacherClash: this.teacherClash,
      unassigned: this.unassigned,
      classSlot: this.classSlot,
      classGap: this.classGap,
      teacherUnavailable: this.teacherUnavailable,
      total: this.hard,
    };
  }

  soft(): SoftStats {
    return {
      sameSubjectInDay: this.repeats,
      dayImbalance: this.imbalance,
      teacherGaps: this.teacherGaps,
      worstTeacherGaps: Math.max(0, ...this.teacherWeek),
      shiftBreaks: this.shiftBreaks,
      shiftIdle: this.shiftIdle,
      difficultySpread: this.spread / this.problem.days,
      misplaced: this.misplaced,
      wishesBroken: this.wishesBroken,
    };
  }

  move(lesson: number, slot: number) {
    const old = this.slotOf[lesson];
    if (old === slot) return;
    if (old === UNASSIGNED) this.unassigned--;
    else this.shift(lesson, old, -1);
    if (slot === UNASSIGNED) this.unassigned++;
    else this.shift(lesson, slot, 1);
    this.slotOf[lesson] = slot;
  }

  swap(a: number, b: number) {
    const slotA = this.slotOf[a];
    const slotB = this.slotOf[b];
    this.move(a, slotB);
    this.move(b, slotA);
  }

  private shift(lesson: number, slot: number, sign: 1 | -1) {
    const { problem } = this;
    const { nSlots, days, nSubjects } = problem;
    const cls = problem.lessonClass[lesson];
    const day = problem.dayOf(slot);
    const classDay = cls * days + day;
    const teachers = problem.teachersOf(lesson);

    this.local(cls, day, teachers, -1);

    const classCell = cls * nSlots + slot;
    const subjectCell = classDay * nSubjects + problem.lessonSubject[lesson];
    if (sign === 1) {
      if (this.classCount[classCell]++ > 0) this.classClash++;
      if (this.subjectInDay[subjectCell]++ > 0) this.repeats++;
    } else {
      if (--this.classCount[classCell] > 0) this.classClash--;
      if (--this.subjectInDay[subjectCell] > 0) this.repeats--;
    }
    const score = this.subjectScore[problem.lessonSubject[lesson]];
    if (score >= HEAVY_FROM) this.heavyAt[classCell] += sign;
    if (score <= EASY_UP_TO) this.easyAt[classCell] += sign;
    if (!problem.classAllowed[classCell]) this.classSlot += sign;
    for (const t of teachers) {
      const cell = t * nSlots + slot;
      if (sign === 1) {
        if (this.teacherCount[cell]++ > 0) this.teacherClash++;
      } else if (--this.teacherCount[cell] > 0) this.teacherClash--;
      if (!problem.teacherAllowed[cell]) this.teacherUnavailable += sign;
      if (problem.teacherWished[t * problem.periods + problem.periodOf(slot)]) this.wishesBroken += sign;
    }
    this.loadSquares += sign === 1 ? 2 * this.dayLoad[classDay] + 1 : 1 - 2 * this.dayLoad[classDay];
    this.dayLoad[classDay] += sign;
    this.dayScore[classDay] += sign * score;

    this.local(cls, day, teachers, 1);
  }

  private local(cls: number, day: number, teachers: Int32Array, sign: 1 | -1) {
    const { days } = this.problem;
    const classDay = cls * days + day;
    if (sign === -1) {
      this.classGap -= this.gapOfClassDay[classDay];
      this.spread -= this.spreadOf(cls, day);
      this.imbalance -= this.imbalanceOfClass[cls];
      this.misplaced -= this.misplacedOfClassDay[classDay];
      for (const t of teachers) {
        const teacherDay = t * days + day;
        this.addTeacherGaps(t, -this.gapOfTeacherDay[teacherDay]);
        this.shiftBreaks -= this.breakOfTeacherDay[teacherDay];
        this.shiftIdle -= this.idleOfTeacherDay[teacherDay];
      }
      return;
    }
    const gap = this.classGapOf(cls, day);
    this.gapOfClassDay[classDay] = gap;
    this.classGap += gap;
    this.spread += this.spreadOf(cls, day);
    const imbalance = this.imbalanceOf(cls);
    this.imbalanceOfClass[cls] = imbalance;
    this.imbalance += imbalance;
    const misplaced = this.misplacedOf(cls, day);
    this.misplacedOfClassDay[classDay] = misplaced;
    this.misplaced += misplaced;
    for (const t of teachers) this.scanTeacherDay(t, day);
  }

  private addTeacherGaps(teacher: number, gaps: number) {
    const before = this.teacherWeek[teacher];
    const after = before + gaps;
    this.teacherWeek[teacher] = after;
    this.gapSquares += after * after - before * before;
    this.teacherGaps += gaps;
  }

  private misplacedOf(cls: number, day: number): number {
    const { periods } = this.problem;
    const base = cls * this.problem.nSlots + day * periods;
    let load = 0;
    for (let p = 0; p < periods; p++) if (this.classCount[base + p] > 0) load++;
    const firstHalf = Math.floor(load / 2);
    const secondHalf = Math.ceil(load / 2);
    let index = 0;
    let misplaced = 0;
    for (let p = 0; p < periods && index < load; p++) {
      if (this.classCount[base + p] === 0) continue;
      if (index < firstHalf && this.easyAt[base + p] > 0) misplaced++;
      if (index >= secondHalf && this.heavyAt[base + p] > 0) misplaced++;
      index++;
    }
    return misplaced;
  }

  private classGapOf(cls: number, day: number): number {
    const first = this.firstPeriod[cls];
    const base = cls * this.problem.nSlots + day * this.problem.periods;
    let last = -1;
    let busy = 0;
    for (let p = first; p < first + this.maxPerDay[cls]; p++) {
      if (this.classCount[base + p] > 0) {
        last = p;
        busy++;
      }
    }
    return last < 0 ? 0 : last - first + 1 - busy;
  }

  private scanTeacherDay(teacher: number, day: number) {
    const { periods, periodShift, days } = this.problem;
    const base = teacher * this.problem.nSlots + day * periods;
    let gaps = 0;
    let idle = 0;
    let shift = -1;
    let shifts = 0;
    let first = -1;
    let last = -1;
    let busy = 0;
    for (let p = 0; p < periods; p++) {
      if (this.teacherCount[base + p] === 0) continue;
      if (periodShift[p] !== shift) {
        if (shift >= 0) {
          gaps += last - first + 1 - busy;
          idle += p - last - 1;
        }
        shift = periodShift[p];
        shifts++;
        first = p;
        busy = 0;
      }
      last = p;
      busy++;
    }
    if (shift >= 0) gaps += last - first + 1 - busy;
    const breaks = shifts > 1 ? shifts - 1 : 0;
    const teacherDay = teacher * days + day;
    this.gapOfTeacherDay[teacherDay] = gaps;
    this.breakOfTeacherDay[teacherDay] = breaks;
    this.idleOfTeacherDay[teacherDay] = idle;
    this.addTeacherGaps(teacher, gaps);
    this.shiftBreaks += breaks;
    this.shiftIdle += idle;
  }

  private imbalanceOf(cls: number): number {
    const { days } = this.problem;
    let min = Infinity;
    let max = -Infinity;
    for (let d = 0; d < days; d++) {
      const load = this.dayLoad[cls * days + d];
      if (load < min) min = load;
      if (load > max) max = load;
    }
    return max - min;
  }

  private spreadOf(cls: number, day: number): number {
    const { days } = this.problem;
    return Math.abs(days * this.dayScore[cls * days + day] - this.classScore[cls]);
  }
}

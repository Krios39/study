import { writeFileSync } from "node:fs";
import type { CostWeights, Evaluation } from "./core/cost.ts";
import { Problem } from "./core/problem.ts";
import { Timetable } from "./core/timetable.ts";
import { Loader } from "./io/loader.ts";
import { XhsttWriter } from "./io/xhstt-writer.ts";
import { UNASSIGNED, type Instance, type Solution } from "./model.ts";
import { Annealing } from "./solvers/annealing.ts";
import { Dsatur } from "./solvers/dsatur.ts";
import type { Solver } from "./solvers/solver.ts";

export interface TimetablerOptions {
  constructive?: Solver;
  improver?: Solver | null;
  weights?: Partial<CostWeights>;
}

export interface ScheduledLesson {
  day: number;
  period: number;
  class: string;
  subject: string;
  teachers: string[];
}

export class Timetabler {
  private readonly constructive: Solver;
  private readonly improver: Solver | null;
  private readonly weights: Partial<CostWeights> | undefined;

  constructor(options: TimetablerOptions = {}) {
    this.weights = options.weights;
    this.constructive = options.constructive ?? Dsatur.recommended();
    this.improver = options.improver === undefined ? new Annealing({ weights: options.weights }) : options.improver;
  }

  run(source: Instance | string): Schedule {
    const instance = this.load(source);
    const problem = this.prepare(instance);
    let clock = performance.now();
    const start = this.construct(problem);
    const constructiveSeconds = (performance.now() - clock) / 1000;
    clock = performance.now();
    const slotOf = this.improve(problem, start);
    const improvementSeconds = (performance.now() - clock) / 1000;
    return new Schedule(
      problem,
      start,
      slotOf,
      this.evaluate(problem, start),
      this.evaluate(problem, slotOf),
      constructiveSeconds,
      improvementSeconds,
    );
  }

  load(source: Instance | string): Instance {
    if (typeof source === "string") return Loader.instance(source);
    Loader.validateInstance(source);
    return source;
  }

  prepare(instance: Instance): Problem {
    return Problem.from(instance);
  }

  construct(problem: Problem): Solution {
    return this.constructive.solve(problem).slotOf;
  }

  improve(problem: Problem, start: Solution): Solution {
    return this.improver ? this.improver.solve(problem, start).slotOf : start;
  }

  evaluate(problem: Problem, slotOf: Solution): Evaluation {
    return Timetable.from(problem, slotOf, this.weights).evaluation();
  }
}

export class Schedule {
  readonly problem: Problem;
  readonly start: Solution;
  readonly slotOf: Solution;
  readonly startEvaluation: Evaluation;
  readonly evaluation: Evaluation;
  readonly constructiveSeconds: number;
  readonly improvementSeconds: number;

  constructor(
    problem: Problem,
    start: Solution,
    slotOf: Solution,
    startEvaluation: Evaluation,
    evaluation: Evaluation,
    constructiveSeconds: number,
    improvementSeconds: number,
  ) {
    this.problem = problem;
    this.start = start;
    this.slotOf = slotOf;
    this.startEvaluation = startEvaluation;
    this.evaluation = evaluation;
    this.constructiveSeconds = constructiveSeconds;
    this.improvementSeconds = improvementSeconds;
  }

  get instance(): Instance {
    return this.problem.instance;
  }

  get feasible(): boolean {
    return this.evaluation.hard.total === 0;
  }

  lessons(): ScheduledLesson[] {
    const { problem, slotOf } = this;
    const { instance } = problem;
    const lessons: ScheduledLesson[] = [];
    for (let l = 0; l < problem.nLessons; l++) {
      if (slotOf[l] === UNASSIGNED) continue;
      const requirement = instance.requirements[problem.lessonReq[l]];
      lessons.push({
        day: problem.dayOf(slotOf[l]),
        period: problem.periodOf(slotOf[l]),
        class: requirement.class,
        subject: requirement.subject,
        teachers: requirement.teachers,
      });
    }
    return lessons.sort((a, b) => a.day - b.day || a.period - b.period || a.class.localeCompare(b.class));
  }

  classGrid(classId: string): ScheduledLesson[][][] {
    return this.grid((lesson) => lesson.class === classId);
  }

  teacherGrid(teacherId: string): ScheduledLesson[][][] {
    return this.grid((lesson) => lesson.teachers.includes(teacherId));
  }

  toJson(): { instance: string; cost: number; slotOf: number[] } {
    return { instance: this.instance.name, cost: this.evaluation.cost, slotOf: Array.from(this.slotOf) };
  }

  toXhstt(): string {
    return XhsttWriter.archive(this.instance, [{ description: "timetable", slotOf: this.slotOf }]);
  }

  save(path: string) {
    writeFileSync(path, path.endsWith(".xml") ? this.toXhstt() : JSON.stringify(this.toJson()) + "\n");
  }

  private grid(belongs: (lesson: ScheduledLesson) => boolean): ScheduledLesson[][][] {
    const { days, periods } = this.problem;
    const grid: ScheduledLesson[][][] = Array.from({ length: days }, () => Array.from({ length: periods }, () => []));
    for (const lesson of this.lessons()) if (belongs(lesson)) grid[lesson.day][lesson.period].push(lesson);
    return grid;
  }
}

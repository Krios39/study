import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Timetable } from "../src/core/timetable.ts";
import { Loader } from "../src/io/loader.ts";
import { XhsttEvaluator } from "../src/io/xhstt-evaluator.ts";
import { XhsttReader } from "../src/io/xhstt-reader.ts";
import { Xml } from "../src/io/xml.ts";
import { Annealing } from "../src/solvers/annealing.ts";
import { Dsatur } from "../src/solvers/dsatur.ts";
import { Tabu } from "../src/solvers/tabu.ts";
import { Timetabler } from "../src/timetabler.ts";

const path = fileURLToPath(new URL("../instances/mini.json", import.meta.url));
const quick = new Annealing({ evaluations: 20000 });

describe("Timetabler", () => {
  it("does the whole job from a file path", () => {
    const schedule = new Timetabler({ improver: quick }).run(path);
    expect(schedule.instance.name).toBe("mini-3");
    expect(schedule.feasible).toBe(true);
    expect(schedule.evaluation.cost).toBeLessThan(schedule.startEvaluation.cost);
    expect(Timetable.from(schedule.problem, schedule.slotOf).cost).toBe(schedule.evaluation.cost);
  });

  it("accepts an instance object and gives the same result as the path", () => {
    const fromPath = new Timetabler({ improver: quick }).run(path);
    const fromObject = new Timetabler({ improver: quick }).run(Loader.instance(path));
    expect(Array.from(fromObject.slotOf)).toEqual(Array.from(fromPath.slotOf));
  });

  it("rejects an invalid instance", () => {
    const broken = Loader.instance(path);
    broken.requirements[0].teachers = ["nobody"];
    expect(() => new Timetabler().run(broken)).toThrow(/unknown teacher/);
  });

  it("takes any solvers for the two stages", () => {
    const classic = new Timetabler({ constructive: Dsatur.classic(), improver: null }).run(path);
    expect(Array.from(classic.slotOf)).toEqual(Array.from(classic.start));
    const tabu = new Timetabler({ improver: new Tabu({ evaluations: 20000, candidates: 100, tenure: 2 }) }).run(path);
    expect(tabu.evaluation.cost).toBeLessThan(tabu.startEvaluation.cost);
  });

  it("exposes each stage separately with the same outcome as the whole run", () => {
    const timetabler = new Timetabler({ improver: quick });
    const whole = timetabler.run(path);
    const problem = timetabler.prepare(timetabler.load(path));
    const start = timetabler.construct(problem);
    const slotOf = timetabler.improve(problem, start);
    expect(Array.from(start)).toEqual(Array.from(whole.start));
    expect(Array.from(slotOf)).toEqual(Array.from(whole.slotOf));
    expect(timetabler.evaluate(problem, slotOf)).toEqual(whole.evaluation);
  });

  it("uses the given weights for search and evaluation", () => {
    const weights = { difficulty: 0, misplaced: 0, dayImbalance: 0 };
    const schedule = new Timetabler({ weights, improver: new Annealing({ evaluations: 20000, weights }) }).run(path);
    expect(schedule.evaluation.cost).toBe(Timetable.from(schedule.problem, schedule.slotOf, weights).cost);
  });
});

describe("Schedule", () => {
  const schedule = new Timetabler({ improver: quick }).run(path);

  it("lists every lesson with its day, period, class, subject and teachers", () => {
    const lessons = schedule.lessons();
    expect(lessons.length).toBe(schedule.problem.nLessons);
    for (const lesson of lessons) {
      expect(lesson.day).toBeLessThan(schedule.instance.days);
      expect(lesson.period).toBeLessThan(schedule.instance.periodsPerDay);
      expect(lesson.teachers.length).toBeGreaterThan(0);
    }
  });

  it("builds grids without clashes for classes and teachers", () => {
    for (const cls of schedule.instance.classes) {
      const cells = schedule.classGrid(cls.id).flat();
      expect(cells.every((cell) => cell.length <= 1)).toBe(true);
      expect(cells.flat().every((lesson) => lesson.class === cls.id)).toBe(true);
    }
    for (const teacher of schedule.instance.teachers) {
      expect(schedule.teacherGrid(teacher.id).flat().every((cell) => cell.length <= 1)).toBe(true);
    }
    const total = schedule.instance.classes.reduce((sum, cls) => sum + schedule.classGrid(cls.id).flat(2).length, 0);
    expect(total).toBe(schedule.problem.nLessons);
  });

  it("saves the timetable as json or as XHSTT", () => {
    const dir = mkdtempSync(join(tmpdir(), "timetabler-"));
    schedule.save(join(dir, "result.json"));
    schedule.save(join(dir, "result.xml"));
    const saved = JSON.parse(readFileSync(join(dir, "result.json"), "utf8"));
    expect(saved).toEqual(schedule.toJson());
    expect(existsSync(join(dir, "result.xml"))).toBe(true);
    const document = Xml.parse(readFileSync(join(dir, "result.xml"), "utf8"));
    const cost = XhsttEvaluator.evaluate(XhsttReader.instanceNodes(document)[0], XhsttReader.solutionNodes(document)[0]);
    expect(cost.infeasibility).toBe(0);
  });
});

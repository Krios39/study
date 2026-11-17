import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Annealing } from "../src/annealing.ts";
import { Dsatur } from "../src/dsatur.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { Rng } from "../src/rng.ts";
import { Timetable } from "../src/timetable.ts";
import { XhsttEvaluator } from "../src/xhstt-eval.ts";
import { XHSTT_EXPORT_WEIGHTS, XhsttExport } from "../src/xhstt-export.ts";
import { Xhstt, type XmlNode } from "../src/xhstt.ts";

const load = (name: string) => Loader.instance(fileURLToPath(new URL(`../instances/${name}.json`, import.meta.url)));
const best = { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" } as const;
const solutionsOf = (document: XmlNode) =>
  document.children[0].children.find((c) => c.name === "SolutionGroups")!.children[0].children.filter((c) => c.name === "Solution");

describe("XHSTT export", () => {
  it.each(["mini", "medium-30"])("gives the same cost by the XHSTT definitions on %s", (name) => {
    const instance = load(name);
    const problem = Problem.from(instance);
    const start = Dsatur.solve(problem, best).slotOf;
    const annealed = Annealing.run(problem, start, { seed: 1, iterations: 30000 }).slotOf;
    const document = Xhstt.parseXml(XhsttExport.archive(instance, [
      { description: "start", slotOf: start },
      { description: "annealed", slotOf: annealed },
    ]));
    const node = Xhstt.instanceNodes(document)[0];
    [start, annealed].forEach((slotOf, index) => {
      const ours = Timetable.from(problem, slotOf, XHSTT_EXPORT_WEIGHTS);
      const cost = XhsttEvaluator.evaluate(node, solutionsOf(document)[index]);
      expect(cost.objective).toBe(ours.cost - ours.weights.hard * ours.hard);
      expect(cost.infeasibility === 0).toBe(ours.hard === 0);
    });
  });

  it("agrees on the soft cost for timetables without teacher clashes after random swaps", () => {
    const instance = load("medium-30");
    const problem = Problem.from(instance);
    const slotOf = Dsatur.solve(problem, best).slotOf;
    const rng = new Rng(9);
    const table = Timetable.from(problem, slotOf, XHSTT_EXPORT_WEIGHTS);
    for (let i = 0; i < 300; i++) {
      const a = rng.int(0, problem.nLessons - 1);
      const b = rng.int(0, problem.nLessons - 1);
      if (problem.lessonClass[a] !== problem.lessonClass[b]) continue;
      table.swap(a, b);
      if (table.violations().teacherClash > 0) table.swap(a, b);
    }
    const document = Xhstt.parseXml(XhsttExport.archive(instance, [{ description: "shuffled", slotOf: table.slotOf }]));
    const cost = XhsttEvaluator.evaluate(Xhstt.instanceNodes(document)[0], solutionsOf(document)[0]);
    expect(cost.objective).toBe(table.cost - table.weights.hard * table.hard);
  });

  it("counts unassigned lessons as infeasibility", () => {
    const instance = load("mini");
    const problem = Problem.from(instance);
    const slotOf = Dsatur.solve(problem, best).slotOf;
    slotOf[0] = -1;
    slotOf[1] = -1;
    const document = Xhstt.parseXml(XhsttExport.archive(instance, [{ description: "holes", slotOf }]));
    const cost = XhsttEvaluator.evaluate(Xhstt.instanceNodes(document)[0], solutionsOf(document)[0]);
    expect(cost.byConstraint.AssignTimes).toBe(2);
  });

  it("can be read back by the importer", () => {
    const instance = load("mini");
    const problem = Problem.from(instance);
    const { instance: back, report } = Xhstt.convert(Xhstt.instanceNodes(Xhstt.parseXml(XhsttExport.archive(instance)))[0]);
    expect(report.lessons).toBe(problem.nLessons);
    expect(report.eventsSkipped).toEqual({});
    expect([back!.days, back!.periodsPerDay]).toEqual([instance.days, instance.periodsPerDay]);
    expect(back!.classes.map((c) => c.id).sort()).toEqual(instance.classes.map((c) => c.id).sort());
    expect(back!.teachers.map((t) => [t.id, t.unavailable]).sort()).toEqual(instance.teachers.map((t) => [t.id, t.unavailable]).sort());
  });
});

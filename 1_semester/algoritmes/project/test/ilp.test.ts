import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Annealing } from "../src/solvers/annealing.ts";
import { Dsatur } from "../src/solvers/dsatur.ts";
import { hardViolations } from "./support/hard.ts";
import { Ilp } from "../src/solvers/exact.ts";
import { Loader } from "../src/io/loader.ts";
import type { Instance } from "../src/model.ts";
import { Problem } from "../src/core/problem.ts";
import { Timetable } from "../src/core/timetable.ts";

const mini = Problem.from(Loader.instance(fileURLToPath(new URL("../instances/mini.json", import.meta.url))));
const start = new Dsatur({ respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" }).solve(mini).slotOf;

const crowded: Instance = {
  name: "crowded",
  days: 1,
  periodsPerDay: 2,
  subjects: [{ id: "math", difficulty: 11 }],
  teachers: [{ id: "t1" }],
  classes: [
    { id: "A", grade: 5, firstPeriod: 0, maxPerDay: 2 },
    { id: "B", grade: 5, firstPeriod: 0, maxPerDay: 2 },
  ],
  requirements: [
    { class: "A", subject: "math", teachers: ["t1"], hours: 2 },
    { class: "B", subject: "math", teachers: ["t1"], hours: 1 },
  ],
};

describe("exact model", () => {
  it("finds a timetable without hard violations", async () => {
    const result = await Ilp.solve(mini, { hardOnly: true, timeLimit: 30 });
    expect(result.status).toBe("optimal");
    expect(hardViolations(mini, result.slotOf!).total).toBe(0);
  }, 60000);

  it("proves that an overloaded teacher has no timetable", async () => {
    const result = await Ilp.solve(Problem.from(crowded), { hardOnly: true, timeLimit: 30 });
    expect(result.status).toBe("infeasible");
    expect(result.slotOf).toBeUndefined();
  }, 60000);

  it("prices a timetable exactly like the incremental evaluation", async () => {
    const weights = { teacherGap: 0, shiftBreak: 0, shiftIdle: 0, misplaced: 0, dayImbalance: 0 };
    const annealed = new Annealing({ seed: 1, evaluations: 30000, weights }).solve(mini, start);
    const result = await Ilp.solve(mini, { timeLimit: 5, start: annealed.slotOf, weights });
    const checked = Timetable.from(mini, result.slotOf!, weights);
    expect(checked.hard).toBe(0);
    expect(result.objective).toBeCloseTo(checked.cost, 6);
    expect(result.objective).toBeLessThanOrEqual(annealed.cost + 1e-6);
    expect(result.bound).toBeLessThanOrEqual(result.objective + 1e-6);
  }, 60000);

  it("proves the optimum of one soft term and annealing does not beat it", async () => {
    const weights = { difficulty: 0, sameSubjectInDay: 0, teacherGap: 0, shiftBreak: 0, shiftIdle: 0, misplaced: 0, teacherWish: 0 };
    const annealed = new Annealing({ seed: 1, evaluations: 30000, weights }).solve(mini, start);
    const result = await Ilp.solve(mini, { timeLimit: 30, start: annealed.slotOf, weights });
    expect(result.status).toBe("optimal");
    expect(annealed.cost).toBeGreaterThanOrEqual(result.objective - 1e-6);
    expect(Timetable.from(mini, result.slotOf!, weights).cost).toBeCloseTo(result.objective, 6);
  }, 60000);
});

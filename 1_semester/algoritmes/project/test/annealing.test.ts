import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Annealing } from "../src/solvers/annealing.ts";
import { Dsatur } from "../src/solvers/dsatur.ts";
import { hardViolations } from "./support/hard.ts";
import { Loader } from "../src/io/loader.ts";
import { UNASSIGNED } from "../src/model.ts";
import { Problem } from "../src/core/problem.ts";
import { Rng } from "../src/core/rng.ts";
import { softStats } from "./support/soft.ts";
import { Timetable } from "../src/core/timetable.ts";

const load = (name: string) =>
  Problem.from(Loader.instance(fileURLToPath(new URL(`../instances/${name}.json`, import.meta.url))));
const mini = load("mini");
const medium = load("medium-30");
const best = { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" } as const;

describe("Timetable", () => {
  it("matches the full evaluation on a DSATUR timetable", () => {
    for (const problem of [mini, medium]) {
      for (const options of [best, {}]) {
        const slotOf = new Dsatur(options).solve(problem).slotOf;
        const timetable = Timetable.from(problem, slotOf);
        expect(timetable.violations()).toEqual(hardViolations(problem, slotOf));
        expect(timetable.soft()).toEqual(softStats(problem, slotOf));
      }
    }
  });

  it("stays consistent after random moves and swaps, including clashes and unassigned lessons", () => {
    const rng = new Rng(7);
    const timetable = Timetable.from(medium, new Dsatur(best).solve(medium).slotOf);
    for (let i = 0; i < 5000; i++) {
      const lesson = rng.int(0, medium.nLessons - 1);
      if (rng.chance(0.5)) timetable.move(lesson, rng.int(UNASSIGNED, medium.nSlots - 1));
      else timetable.swap(lesson, rng.int(0, medium.nLessons - 1));
      if (i % 500 === 0) {
        expect(timetable.violations()).toEqual(hardViolations(medium, timetable.slotOf));
        expect(timetable.soft()).toEqual(softStats(medium, timetable.slotOf));
      }
    }
    expect(timetable.violations()).toEqual(hardViolations(medium, timetable.slotOf));
    expect(timetable.soft()).toEqual(softStats(medium, timetable.slotOf));
  });

  it("returns to the same cost when a move is undone", () => {
    const slotOf = new Dsatur(best).solve(mini).slotOf;
    const timetable = Timetable.from(mini, slotOf);
    const cost = timetable.cost;
    timetable.move(0, (slotOf[0] + 3) % mini.nSlots);
    timetable.move(0, slotOf[0]);
    timetable.swap(0, 50);
    timetable.swap(0, 50);
    expect(timetable.cost).toBe(cost);
  });

  it("splits the cost into parts that add up to it", () => {
    for (const options of [best, {}]) {
      const timetable = Timetable.from(medium, new Dsatur(options).solve(medium).slotOf);
      const sum = Object.values(timetable.breakdown()).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(timetable.cost, 6);
    }
  });
});

describe("Annealing", () => {
  const start = new Dsatur(best).solve(mini).slotOf;

  it.each([
    ["moves only", { kempeShare: 0, swapShare: 0 }],
    ["swaps only", { kempeShare: 0, swapShare: 1 }],
    ["chains only", { kempeShare: 1 }],
    ["the default mix", {}],
  ])("never returns a worse timetable with %s", (_, mix) => {
    const result = new Annealing({ ...mix, evaluations: 20000, seed: 3 }).solve(mini, start);
    expect(result.cost).toBeLessThanOrEqual(result.startCost);
    expect(Timetable.from(mini, result.slotOf).cost).toBe(result.cost);
    expect(hardViolations(mini, result.slotOf).total).toBe(0);
  });

  it("improves the soft cost of the DSATUR timetable", () => {
    const result = new Annealing({ evaluations: 50000, seed: 3 }).solve(mini, start);
    expect(result.cost).toBeLessThan(result.startCost);
  });

  it("is reproducible for a fixed seed", () => {
    const a = new Annealing({ evaluations: 5000, seed: 11 }).solve(mini, start);
    const b = new Annealing({ evaluations: 5000, seed: 11 }).solve(mini, start);
    expect(Array.from(a.slotOf)).toEqual(Array.from(b.slotOf));
  });

  it("places lessons that the start left unassigned", () => {
    const empty = new Int32Array(mini.nLessons).fill(UNASSIGNED);
    const result = new Annealing({ kempeShare: 0, swapShare: 0, evaluations: 200000, seed: 5 }).solve(mini, empty);
    expect(hardViolations(mini, result.slotOf).unassigned).toBe(0);
  });
});

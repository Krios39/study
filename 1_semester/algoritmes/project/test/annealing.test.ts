import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Annealing } from "../src/annealing.ts";
import { Dsatur } from "../src/dsatur.ts";
import { hardViolations } from "../src/hard.ts";
import { Loader } from "../src/loader.ts";
import { UNASSIGNED } from "../src/model.ts";
import { Problem } from "../src/problem.ts";
import { Rng } from "../src/rng.ts";
import { softStats } from "../src/soft.ts";
import { Timetable } from "../src/timetable.ts";

const load = (name: string) =>
  Problem.from(Loader.instance(fileURLToPath(new URL(`../instances/${name}.json`, import.meta.url))));
const mini = load("mini");
const medium = load("medium-30");
const best = { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" } as const;

describe("Timetable", () => {
  it("matches the full evaluation on a DSATUR timetable", () => {
    for (const problem of [mini, medium]) {
      for (const options of [best, {}]) {
        const slotOf = Dsatur.solve(problem, options).slotOf;
        const timetable = Timetable.from(problem, slotOf);
        expect(timetable.violations()).toEqual(hardViolations(problem, slotOf));
        expect(timetable.soft()).toEqual(softStats(problem, slotOf));
      }
    }
  });

  it("stays consistent after random moves and swaps, including clashes and unassigned lessons", () => {
    const rng = new Rng(7);
    const timetable = Timetable.from(medium, Dsatur.solve(medium, best).slotOf);
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
    const slotOf = Dsatur.solve(mini, best).slotOf;
    const timetable = Timetable.from(mini, slotOf);
    const cost = timetable.cost;
    timetable.move(0, (slotOf[0] + 3) % mini.nSlots);
    timetable.move(0, slotOf[0]);
    timetable.swap(0, 50);
    timetable.swap(0, 50);
    expect(timetable.cost).toBe(cost);
  });
});

describe("Annealing", () => {
  const start = Dsatur.solve(mini, best).slotOf;

  it.each(["move", "swap", "both"] as const)("never returns a worse timetable with %s", (moves) => {
    const result = Annealing.run(mini, start, { moves, iterations: 20000, seed: 3 });
    expect(result.cost).toBeLessThanOrEqual(result.startCost);
    expect(Timetable.from(mini, result.slotOf).cost).toBe(result.cost);
    expect(hardViolations(mini, result.slotOf).total).toBe(0);
  });

  it("improves the soft cost of the DSATUR timetable", () => {
    const result = Annealing.run(mini, start, { iterations: 50000, seed: 3 });
    expect(result.cost).toBeLessThan(result.startCost);
  });

  it("is reproducible for a fixed seed", () => {
    const a = Annealing.run(mini, start, { iterations: 5000, seed: 11 });
    const b = Annealing.run(mini, start, { iterations: 5000, seed: 11 });
    expect(Array.from(a.slotOf)).toEqual(Array.from(b.slotOf));
  });

  it("places lessons that the start left unassigned", () => {
    const empty = new Int32Array(mini.nLessons).fill(UNASSIGNED);
    const result = Annealing.run(mini, empty, { moves: "move", iterations: 200000, seed: 5 });
    expect(hardViolations(mini, result.slotOf).unassigned).toBe(0);
  });
});

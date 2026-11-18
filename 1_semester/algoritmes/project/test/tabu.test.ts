import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Dsatur } from "../src/solvers/dsatur.ts";
import { hardViolations } from "./support/hard.ts";
import { Loader } from "../src/io/loader.ts";
import { UNASSIGNED } from "../src/model.ts";
import { MoveSampler } from "../src/solvers/moves.ts";
import { Problem } from "../src/core/problem.ts";
import { Rng } from "../src/core/rng.ts";
import { Tabu } from "../src/solvers/tabu.ts";
import { Timetable } from "../src/core/timetable.ts";

const mini = Problem.from(Loader.instance(fileURLToPath(new URL("../instances/mini.json", import.meta.url))));
const start = new Dsatur({ respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" }).solve(mini).slotOf;

describe("MoveSampler", () => {
  it("proposes moves that start from the current slots and change them", () => {
    const sampler = new MoveSampler(mini, new Rng(3));
    const slotOf = start.slice();
    let proposed = 0;
    for (let i = 0; i < 3000; i++) {
      if (!sampler.sample(slotOf)) continue;
      proposed++;
      const seen = new Set<number>();
      for (let k = 0; k < sampler.length; k++) {
        expect(sampler.from[k]).toBe(slotOf[sampler.lessons[k]]);
        expect(sampler.to[k]).not.toBe(sampler.from[k]);
        seen.add(sampler.lessons[k]);
      }
      expect(seen.size).toBe(sampler.length);
      expect(sampler.length).toBeLessThanOrEqual(16);
    }
    expect(proposed).toBeGreaterThan(1000);
  });
});

describe("Tabu search", () => {
  it("never returns a worse timetable and reports its real cost", () => {
    const result = new Tabu({ evaluations: 40000, seed: 2 }).solve(mini, start);
    expect(result.cost).toBeLessThan(result.startCost);
    expect(Timetable.from(mini, result.slotOf).cost).toBe(result.cost);
    expect(hardViolations(mini, result.slotOf).total).toBe(0);
    expect(result.evaluations).toBe(40000);
    expect(result.worsening).toBeGreaterThan(0);
  });

  it("is reproducible for a fixed seed", () => {
    const a = new Tabu({ evaluations: 8000, seed: 6 }).solve(mini, start);
    const b = new Tabu({ evaluations: 8000, seed: 6 }).solve(mini, start);
    expect(Array.from(a.slotOf)).toEqual(Array.from(b.slotOf));
  });

  it("blocks recently moved lessons", () => {
    const result = new Tabu({ evaluations: 20000, seed: 2, tenure: 40 }).solve(mini, start);
    expect(result.blocked).toBeGreaterThan(0);
  });

  it("places lessons that the start left unassigned", () => {
    const empty = new Int32Array(mini.nLessons).fill(UNASSIGNED);
    const result = new Tabu({ evaluations: 200000, seed: 5 }).solve(mini, empty);
    expect(hardViolations(mini, result.slotOf).unassigned).toBe(0);
  });
});

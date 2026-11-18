import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Annealing } from "../src/solvers/annealing.ts";
import { Dsatur } from "../src/solvers/dsatur.ts";
import { hardViolations } from "./support/hard.ts";
import { KempeChain } from "../src/solvers/kempe.ts";
import { Loader } from "../src/io/loader.ts";
import { Problem } from "../src/core/problem.ts";
import { Rng } from "../src/core/rng.ts";
import { Timetable } from "../src/core/timetable.ts";

const load = (name: string) =>
  Problem.from(Loader.instance(fileURLToPath(new URL(`../instances/${name}.json`, import.meta.url))));
const best = { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" } as const;

describe("Kempe chain", () => {
  it.each(["mini", "medium-30"])("never creates a class or teacher clash on %s", (name) => {
    const problem = load(name);
    const slotOf = new Dsatur(best).solve(problem).slotOf;
    const chain = new KempeChain(problem);
    const rng = new Rng(5);
    for (let i = 0; i < 2000; i++) {
      const lesson = rng.int(0, problem.nLessons - 1);
      const home = slotOf[lesson];
      const slot = rng.int(0, problem.nSlots - 1);
      if (slot === home) continue;
      const length = chain.build(slotOf, lesson, slot);
      const moved = Array.from(chain.lessons.subarray(0, length));
      expect(new Set(moved).size).toBe(length);
      for (let k = 0; k < length; k++) {
        expect([home, slot]).toContain(chain.from[k]);
        expect(slotOf[moved[k]]).toBe(chain.from[k]);
      }
      for (let k = 0; k < length; k++) slotOf[moved[k]] = chain.from[k] === home ? slot : home;
      const violations = hardViolations(problem, slotOf);
      expect(violations.classClash).toBe(0);
      expect(violations.teacherClash).toBe(0);
      expect(violations.unassigned).toBe(0);
    }
  });

  it("is a plain move when nothing stands in the way", () => {
    const problem = load("mini");
    const slotOf = new Dsatur(best).solve(problem).slotOf;
    const chain = new KempeChain(problem);
    const cls = problem.lessonClass[0];
    const busy = new Set<number>();
    for (let l = 0; l < problem.nLessons; l++) {
      if (problem.lessonClass[l] === cls || problem.teachersOf(l).some((t) => problem.teachersOf(0).includes(t))) busy.add(slotOf[l]);
    }
    let free = -1;
    for (let s = 0; s < problem.nSlots && free < 0; s++) if (!busy.has(s)) free = s;
    expect(free).toBeGreaterThanOrEqual(0);
    expect(chain.build(slotOf, 0, free)).toBe(1);
  });
});

describe("Annealing with Kempe chains", () => {
  const problem = load("mini");
  const start = new Dsatur(best).solve(problem).slotOf;

  it("keeps the timetable valid and consistent", () => {
    const result = new Annealing({ evaluations: 30000, seed: 2, kempeShare: 0.5 }).solve(problem, start);
    expect(result.cost).toBeLessThanOrEqual(result.startCost);
    expect(Timetable.from(problem, result.slotOf).cost).toBe(result.cost);
    expect(hardViolations(problem, result.slotOf).total).toBe(0);
    expect(result.kempe.tried).toBeGreaterThan(0);
    expect(result.kempe.accepted).toBeGreaterThan(0);
  });

  it("rejects chains longer than the limit", () => {
    const result = new Annealing({ evaluations: 20000, seed: 2, kempeShare: 1, kempeMaxLength: 1 }).solve(problem, start);
    expect(result.kempe.tooLong).toBeGreaterThan(0);
    expect(result.kempe.acceptedLengthSum).toBe(result.kempe.accepted);
  });

  it("uses a half share of chains by default", () => {
    const plain = new Annealing({ evaluations: 5000, seed: 4 }).solve(problem, start);
    const zero = new Annealing({ evaluations: 5000, seed: 4, kempeShare: 0.5 }).solve(problem, start);
    expect(Array.from(zero.slotOf)).toEqual(Array.from(plain.slotOf));
  });
});

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Problem } from "../src/core/problem.ts";
import { Loader } from "../src/io/loader.ts";
import { Annealing } from "../src/solvers/annealing.ts";
import { Dsatur } from "../src/solvers/dsatur.ts";
import { Solver } from "../src/solvers/solver.ts";
import { Tabu } from "../src/solvers/tabu.ts";

const problem = Problem.from(Loader.instance(fileURLToPath(new URL("../instances/mini.json", import.meta.url))));

describe("solver hierarchy", () => {
  it("lets every solver be used through the common interface", () => {
    const solvers: Solver[] = [Dsatur.classic(), Dsatur.recommended(), new Annealing({ evaluations: 2000 }), new Tabu({ evaluations: 2000 })];
    const start = Dsatur.recommended().solve(problem).slotOf;
    for (const solver of solvers) {
      const result = solver.solve(problem, start);
      expect(result.slotOf.length).toBe(problem.nLessons);
      expect(solver.name.length).toBeGreaterThan(0);
    }
  });

  it("gives the same DSATUR timetable step by step as in one call", () => {
    const whole = Dsatur.recommended().solve(problem);
    const run = Dsatur.recommended().start(problem);
    const order: number[] = [];
    for (let step = run.step(); step !== undefined; step = run.step()) {
      expect(run.current[step.lesson]).toBe(step.slot);
      order.push(step.lesson);
    }
    expect(run.finished).toBe(true);
    expect(order).toEqual(Array.from(whole.order));
    expect(Array.from(run.result().slotOf)).toEqual(Array.from(whole.slotOf));
  });

  it("announces the next DSATUR lesson and puts it into a free slot", () => {
    const run = Dsatur.recommended().start(problem);
    while (!run.finished) {
      const lesson = run.peek()!;
      const free = Array.from({ length: problem.nSlots }, (_, slot) => slot).filter((slot) => run.isFree(lesson, slot));
      expect(free.length).toBe(run.freeSlotsOf(lesson));
      const step = run.step()!;
      expect(step.lesson).toBe(lesson);
      expect(free).toContain(step.slot);
      expect(run.isPlaced(lesson)).toBe(true);
    }
    expect(run.peek()).toBeUndefined();
  });

  it("reports every annealing attempt", () => {
    const start = Dsatur.recommended().solve(problem).slotOf;
    const run = new Annealing({ evaluations: 3000, seed: 3 }).start(problem, start);
    let accepted = 0;
    while (!run.finished) {
      const before = run.timetable.cost;
      run.advance();
      const { last } = run;
      if (last.sampled && last.accepted) {
        accepted++;
        expect(run.timetable.cost).toBeCloseTo(before + last.delta, 6);
        expect(run.sampler.kind).not.toBe("none");
      } else {
        expect(run.timetable.cost).toBe(before);
      }
    }
    expect(run.evaluations).toBe(run.budget);
    expect(run.result().accepted).toBe(accepted);
  });

  it.each([
    ["annealing", new Annealing({ evaluations: 5000, seed: 7 })],
    ["tabu search", new Tabu({ evaluations: 5000, seed: 7 })],
  ])("gives the same %s result step by step as in one call", (_, solver) => {
    const start = Dsatur.recommended().solve(problem).slotOf;
    const whole = solver.solve(problem, start);
    const run = solver.start(problem, start);
    let previous = run.cost;
    while (!run.finished) {
      run.advance();
      expect(run.cost).toBeLessThanOrEqual(previous);
      previous = run.cost;
    }
    expect(Array.from(run.result().slotOf)).toEqual(Array.from(whole.slotOf));
    expect(run.result().cost).toBe(whole.cost);
  });
});

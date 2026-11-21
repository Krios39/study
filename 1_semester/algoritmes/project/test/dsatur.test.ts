import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Dsatur } from "../src/solvers/dsatur.ts";
import { hardViolations } from "./support/hard.ts";
import { Loader } from "../src/io/loader.ts";
import { UNASSIGNED, type Instance } from "../src/model.ts";
import { Problem } from "../src/core/problem.ts";
import { softStats } from "./support/soft.ts";

const mini = Problem.from(Loader.instance(fileURLToPath(new URL("../instances/mini.json", import.meta.url))));

const tiny: Instance = {
  name: "tiny",
  days: 1,
  periodsPerDay: 4,
  subjects: [{ id: "math", difficulty: 11 }, { id: "pe", difficulty: 5 }],
  teachers: [{ id: "t1", unavailable: [[0, 0]] }, { id: "t2" }],
  classes: [
    { id: "A", grade: 5, firstPeriod: 0, maxPerDay: 4 },
    { id: "B", grade: 5, firstPeriod: 0, maxPerDay: 4 },
  ],
  requirements: [
    { class: "A", subject: "math", teachers: ["t1"], hours: 2 },
    { class: "A", subject: "pe", teachers: ["t2"], hours: 1 },
    { class: "B", subject: "math", teachers: ["t1"], hours: 1 },
  ],
};

describe("classic DSATUR", () => {
  it("follows saturation, then degree, then index, and takes the first free slot", () => {
    const { slotOf, order } = new Dsatur().solve(Problem.from(tiny));
    expect(Array.from(order)).toEqual([0, 1, 2, 3]);
    expect(Array.from(slotOf)).toEqual([0, 1, 2, 2]);
  });

  it("skips forbidden slots only when asked to", () => {
    const { slotOf } = new Dsatur({ respectAllowed: true }).solve(Problem.from(tiny));
    expect(Array.from(slotOf)).toEqual([1, 2, 0, 3]);
  });

  it("places every lesson exactly once", () => {
    const { order } = new Dsatur().solve(mini);
    expect(Array.from(order).sort((a, b) => a - b)).toEqual(Array.from({ length: mini.nLessons }, (_, i) => i));
  });

  it("gives neighbours different slots on the mini instance", () => {
    for (const respectAllowed of [false, true]) {
      const { slotOf } = new Dsatur({ respectAllowed }).solve(mini);
      for (let l = 0; l < mini.nLessons; l++) {
        if (slotOf[l] === UNASSIGNED) continue;
        for (const n of mini.neighbours(l)) expect(slotOf[n]).not.toBe(slotOf[l]);
      }
      expect(hardViolations(mini, slotOf)).toMatchObject({ classClash: 0, teacherClash: 0 });
    }
  });

  it("keeps teachers out of unavailable slots when asked to", () => {
    const { slotOf } = new Dsatur({ respectAllowed: true }).solve(mini);
    expect(hardViolations(mini, slotOf)).toMatchObject({ classSlot: 0, teacherUnavailable: 0 });
  });
});

describe("DSATUR with least-penalty slots", () => {
  const options = { respectAllowed: true, slotRule: "leastPenalty" } as const;

  it("refuses to price slots outside the class window", () => {
    expect(() => new Dsatur({ slotRule: "leastPenalty" }).solve(mini)).toThrow();
  });

  it("puts two lessons of one subject on different days when it can", () => {
    const week: Instance = { ...tiny, days: 2, teachers: [{ id: "t1" }, { id: "t2" }] };
    const problem = Problem.from(week);
    const { slotOf } = new Dsatur(options).solve(problem);
    expect(problem.dayOf(slotOf[0])).not.toBe(problem.dayOf(slotOf[1]));
    expect(hardViolations(problem, slotOf)).toMatchObject({ classClash: 0, teacherClash: 0, unassigned: 0 });
  });

  it("keeps the graph colouring valid on the mini instance", () => {
    const { slotOf } = new Dsatur(options).solve(mini);
    expect(hardViolations(mini, slotOf)).toMatchObject({ classClash: 0, teacherClash: 0, classSlot: 0, teacherUnavailable: 0 });
  });

  it("repeats subjects less and balances days better than the first-free rule", () => {
    const first = softStats(mini, new Dsatur({ respectAllowed: true }).solve(mini).slotOf);
    const least = softStats(mini, new Dsatur(options).solve(mini).slotOf);
    expect(least.sameSubjectInDay).toBeLessThan(first.sameSubjectInDay);
    expect(least.dayImbalance).toBeLessThan(first.dayImbalance);
  });
});

describe("DSATUR ordered by really free slots", () => {
  it("places the lesson with a restricted teacher before freer ones", () => {
    const school: Instance = {
      ...tiny,
      teachers: [{ id: "t1" }, { id: "t2", unavailable: [[0, 0], [0, 1], [0, 2]] }],
    };
    const problem = Problem.from(school);
    expect(new Dsatur({ respectAllowed: true }).solve(problem).order[0]).toBe(0);
    const { order, slotOf } = new Dsatur({ respectAllowed: true, lessonRule: "freeSlots" }).solve(problem);
    expect(order[0]).toBe(2);
    expect(slotOf[2]).toBe(3);
  });

  it("leaves no music lesson without a slot on the mini instance", () => {
    const first = new Dsatur({ respectAllowed: true }).solve(mini);
    const free = new Dsatur({ respectAllowed: true, lessonRule: "freeSlots" }).solve(mini);
    expect(hardViolations(mini, first.slotOf).unassigned).toBe(2);
    expect(hardViolations(mini, free.slotOf)).toMatchObject({ unassigned: 0, classClash: 0, teacherClash: 0 });
  });

  it("matches saturation order when no slot is forbidden", () => {
    const a = new Dsatur({ lessonRule: "saturation" }).solve(mini);
    const b = new Dsatur({ lessonRule: "freeSlots" }).solve(mini);
    expect(Array.from(b.order)).toEqual(Array.from(a.order));
  });
});

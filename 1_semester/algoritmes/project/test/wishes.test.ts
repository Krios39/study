import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { RandomGenerator } from "../src/random-generator.ts";
import { wishOptions } from "../src/wishes.ts";

const file = (name: string) => fileURLToPath(new URL(`../instances/${name}`, import.meta.url));
const subjects = Loader.subjects(file("subjects.json"));
const curriculum = Loader.curriculum(file("curriculum.json"), subjects);
const school = (seed: number, shifts: 1 | 2, wishShare: number) =>
  RandomGenerator.generate({ seed, size: "medium", shifts, wishShare }, subjects, curriculum).instance;
const label = (wish: { kind: string; periods: number[] }) => `${wish.kind} ${wish.periods.join("-")}`;

describe("teacher wishes", () => {
  it("offers both shift wishes and three free windows in a two-shift day", () => {
    expect(wishOptions(16).map(label)).toEqual([
      "noFirstShift 0-7",
      "noSecondShift 8-15",
      "freePeriods 0-4",
      "freePeriods 4-10",
      "freePeriods 11-15",
    ]);
  });

  it("offers only the free windows that fit a single-shift day", () => {
    expect(wishOptions(8).map(label)).toEqual(["freePeriods 0-4", "freePeriods 4-7"]);
  });

  it("draws all three kinds across two-shift schools", () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) for (const t of school(seed, 2, 1).teachers) if (t.wish) kinds.add(t.wish.kind);
    expect([...kinds].sort()).toEqual(["freePeriods", "noFirstShift", "noSecondShift"]);
  });

  it("only draws wishes that leave every lesson a slot and the teacher spare room", () => {
    for (const shifts of [1, 2] as const) {
      for (let seed = 1; seed <= 5; seed++) {
        const instance = school(seed, shifts, 1);
        Loader.validateInstance(instance);
        const problem = Problem.from(instance);
        const free = (teacher: number, slot: number) => !problem.teacherWished[teacher * problem.periods + problem.periodOf(slot)];
        instance.teachers.forEach((t, ti) => {
          if (!t.wish) return;
          const shifts = new Map<number, { load: number; usable: Set<number> }>();
          for (let l = 0; l < problem.nLessons; l++) {
            if (!problem.teachersOf(l).includes(ti)) continue;
            const first = instance.classes[problem.lessonClass[l]].firstPeriod;
            const shift = shifts.get(first) ?? { load: 0, usable: new Set<number>() };
            shifts.set(first, shift);
            shift.load++;
            let own = 0;
            for (let s = 0; s < problem.nSlots; s++) {
              if (!problem.isAllowed(l, s) || !free(ti, s)) continue;
              shift.usable.add(s);
              own++;
            }
            expect(own).toBeGreaterThan(0);
          }
          for (const shift of shifts.values()) expect(shift.load).toBeLessThanOrEqual(shift.usable.size);
        });
      }
    }
  });

  it("does not change the rest of the school", () => {
    const none = school(9, 2, 0);
    const all = school(9, 2, 1);
    expect(none.teachers.every((t) => t.wish === undefined)).toBe(true);
    expect(all.teachers.some((t) => t.wish !== undefined)).toBe(true);
    expect(all.requirements).toEqual(none.requirements);
    expect(all.teachers.map((t) => [t.id, t.unavailable])).toEqual(none.teachers.map((t) => [t.id, t.unavailable]));
  });

  it("rejects a wish outside the day", () => {
    const instance = school(9, 1, 0);
    instance.teachers[0].wish = { kind: "freePeriods", periods: [4, 10] };
    expect(() => Loader.validateInstance(instance)).toThrow(/wish periods/);
  });
});

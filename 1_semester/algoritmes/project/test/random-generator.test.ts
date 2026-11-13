import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { RandomGenerator } from "../src/random-generator.ts";

const path = (name: string) => fileURLToPath(new URL(`../instances/${name}`, import.meta.url));
const subjects = Loader.subjects(path("subjects.json"));
const curriculum = Loader.curriculum(path("curriculum.json"), subjects);

describe("random generator", () => {
  it("gives the same school for the same seed", () => {
    const a = RandomGenerator.generate({ seed: 7 }, subjects, curriculum);
    const b = RandomGenerator.generate({ seed: 7 }, subjects, curriculum);
    expect(b).toEqual(a);
    expect(RandomGenerator.generate({ seed: 8 }, subjects, curriculum).instance).not.toEqual(a.instance);
  });

  it("produces valid instances of the requested size", () => {
    const ranges = { small: [4, 10], medium: [12, 30], large: [35, 60] } as const;
    for (const size of ["small", "medium", "large"] as const) {
      for (let seed = 1; seed <= 30; seed++) {
        const { instance, meta } = RandomGenerator.generate({ seed, size }, subjects, curriculum);
        Loader.validateInstance(instance);
        expect(instance.classes.length).toBeGreaterThanOrEqual(ranges[size][0]);
        expect(instance.classes.length).toBeLessThanOrEqual(ranges[size][1]);
        expect(Problem.from(instance).nLessons).toBe(meta.lessons);
        expect(Object.values(meta.classesPerGrade).reduce((a, b) => a + b, 0)).toBe(instance.classes.length);
      }
    }
  });

  it("keeps teacher loads inside the requested range when it can", () => {
    const { meta } = RandomGenerator.generate(
      { seed: 3, size: "large", loadRange: [18, 18], unavailableShare: 0 },
      subjects,
      curriculum,
    );
    expect(meta.meanLoad).toBeGreaterThan(12);
    expect(meta.maxLoad).toBeLessThanOrEqual(18 + 5);
  });

  it("flags a teacher who has more lessons than available slots", () => {
    const { meta } = RandomGenerator.generate(
      { seed: 5, size: "medium", shifts: 1, loadRange: [40, 40], unavailableShare: 1, daysOff: 2 },
      subjects,
      curriculum,
    );
    expect(meta.provablyInfeasible.length).toBeGreaterThan(0);
  });
});

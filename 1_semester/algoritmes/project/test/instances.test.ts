import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hardViolations } from "../src/hard.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";

const path = (name: string) => fileURLToPath(new URL(`../instances/${name}`, import.meta.url));

describe("generated instances", () => {
  it.each([
    ["small-7", 7],
    ["small-10", 10],
    ["medium-20", 20],
    ["medium-30", 30],
    ["large-60", 60],
  ])("%s loads and its hidden timetable is feasible", (name, classes) => {
    const instance = Loader.instance(path(`${name}.json`));
    const problem = Problem.from(instance);
    const hidden = JSON.parse(readFileSync(path(`${name}.hidden.json`), "utf8")) as { slotOf: number[] };
    expect(instance.classes).toHaveLength(classes);
    expect(hidden.slotOf).toHaveLength(problem.nLessons);
    expect(hardViolations(problem, Int32Array.from(hidden.slotOf)).total).toBe(0);
  });
});

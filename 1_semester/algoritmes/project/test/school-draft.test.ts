import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { SchoolDraft } from "../demo/src/school.ts";
import { hardViolations } from "./support/hard.ts";
import { Loader } from "../src/io/loader.ts";
import { Problem } from "../src/core/problem.ts";
import { Annealing } from "../src/solvers/annealing.ts";
import { Dsatur } from "../src/solvers/dsatur.ts";

const path = (name: string) => fileURLToPath(new URL(`../instances/${name}`, import.meta.url));
const subjects = Loader.subjects(path("subjects.json"));
const draft = new SchoolDraft(subjects, Loader.curriculum(path("curriculum.json"), subjects));
const kazakh = new SchoolDraft(subjects, Loader.curriculum(path("curriculum-kk.json"), subjects));
const oneOfEach = new Map(SchoolDraft.grades.map((grade) => [grade, 1]));
const staff = (classes: Map<number, number>, split: boolean) => new Map(draft.groups(classes, split).map((row) => [row.group, row.suggested]));

describe("SchoolDraft", () => {
  it("builds a valid school that the solvers can schedule", () => {
    const instance = draft.instance(oneOfEach, staff(oneOfEach, true), new Map(), true);
    Loader.validateInstance(instance);
    expect(instance.classes).toHaveLength(7);
    expect(SchoolDraft.verdict(instance).impossible).toEqual([]);
    const problem = Problem.from(instance);
    const start = Dsatur.recommended().solve(problem).slotOf;
    const result = new Annealing({ evaluations: 60000 }).solve(problem, start);
    expect(hardViolations(problem, result.slotOf).total).toBe(0);
  });

  it("builds a school taught in Kazakh from its own curriculum", () => {
    const groups = kazakh.groups(oneOfEach, true);
    const instance = kazakh.instance(oneOfEach, new Map(groups.map((row) => [row.group, row.suggested])), new Map(), true);
    Loader.validateInstance(instance);
    expect(instance.subjects.map((subject) => subject.id)).toContain("kazakh_literature");
    expect(kazakh.splitSubjects).toEqual(["english_language", "informatics"]);
    expect(SchoolDraft.verdict(instance).impossible).toEqual([]);
  });

  it("gives every teacher of a subject a similar load", () => {
    const classes = new Map([[5, 3], [6, 3]]);
    const instance = draft.instance(classes, staff(classes, false), new Map(), false);
    const math = SchoolDraft.rows(instance).filter((row) => row.group === "math");
    expect(math.length).toBeGreaterThan(1);
    expect(Math.max(...math.map((row) => row.load)) - Math.min(...math.map((row) => row.load))).toBeLessThanOrEqual(5);
  });

  it("reports a school with too few teachers as impossible", () => {
    const classes = new Map([[5, 6], [6, 6]]);
    const teachers = staff(classes, false);
    teachers.set("math", 1);
    const verdict = SchoolDraft.verdict(draft.instance(classes, teachers, new Map(), false));
    expect(verdict.impossible.some((issue) => issue.params.teacher === "math1")).toBe(true);
  });

  it("counts closed thirds of a day against the times a teacher can work", () => {
    const instance = draft.instance(oneOfEach, staff(oneOfEach, true), new Map([["math1", [12, 13, 14, 24]]]), true);
    Loader.validateInstance(instance);
    const [free, busy] = [SchoolDraft.rows(draft.instance(oneOfEach, staff(oneOfEach, true), new Map(), true)), SchoolDraft.rows(instance)].map(
      (rows) => rows.find((row) => row.id === "math1")!.free,
    );
    expect(busy).toBe(free - 11);
    expect(instance.teachers.find((teacher) => teacher.id === "math1")!.unavailable).toContainEqual([4, 2]);
  });

  it("gives a class to the teacher it is pinned to", () => {
    const classes = new Map([[5, 3], [6, 3]]);
    const pinned = new Map([[SchoolDraft.linkKey("5A", "math"), ["math2"]], [SchoolDraft.linkKey("5B", "math"), ["math2"]], [SchoolDraft.linkKey("5C", "math"), ["math2"]]]);
    const instance = draft.instance(classes, staff(classes, false), new Map(), false, new Set(), pinned);
    Loader.validateInstance(instance);
    const math = instance.requirements.filter((requirement) => requirement.subject === "math" && requirement.class.startsWith("5"));
    expect(math.map((requirement) => requirement.teachers)).toEqual([["math2"], ["math2"], ["math2"]]);
    expect(draft.links(instance).get(SchoolDraft.linkKey("6A", "math"))).toEqual(["math1"]);
  });

  it("puts grades 6 to 8 into the afternoon of a two-shift school", () => {
    const instance = draft.instance(oneOfEach, staff(oneOfEach, true), new Map([["math1", [3]]]), true, new Set([6, 7, 8]));
    Loader.validateInstance(instance);
    expect(instance.periodsPerDay).toBe(16);
    expect(instance.classes.filter((cls) => cls.firstPeriod === 8).map((cls) => cls.grade)).toEqual([6, 7, 8]);
    expect(instance.teachers.find((teacher) => teacher.id === "math1")!.unavailable).toContainEqual([0, 8]);
    const problem = Problem.from(instance);
    const result = new Annealing({ evaluations: 60000 }).solve(problem, Dsatur.recommended().solve(problem).slotOf);
    expect(hardViolations(problem, result.slotOf).total).toBe(0);
    const morning = new Map([[5, 2], [9, 1]]);
    expect(draft.instance(morning, staff(morning, true), new Map(), true, new Set([6, 7, 8])).periodsPerDay).toBe(8);
  });
});

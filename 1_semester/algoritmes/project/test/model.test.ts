import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { Problem } from "../src/core/problem.ts";
import { hardViolations } from "./support/hard.ts";
import { Loader } from "../src/io/loader.ts";
import { UNASSIGNED, type Instance, type LanguageOfInstruction, type SplitRule } from "../src/model.ts";
import { SubjectCatalog } from "../src/io/subject-catalog.ts";

const mini = Loader.instance(fileURLToPath(new URL("../instances/mini.json", import.meta.url)));

const tiny: Instance = {
  name: "tiny",
  days: 1,
  periodsPerDay: 4,
  subjects: [{ id: "math", difficulty: 11 }, { id: "pe", difficulty: 5 }],
  teachers: [{ id: "t1", unavailable: [[0, 3]] }, { id: "t2" }],
  classes: [
    { id: "A", grade: 5, firstPeriod: 0, maxPerDay: 3 },
    { id: "B", grade: 5, firstPeriod: 0, maxPerDay: 4 },
  ],
  requirements: [
    { class: "A", subject: "math", teachers: ["t1"], hours: 2 },
    { class: "A", subject: "pe", teachers: ["t2"], hours: 1 },
    { class: "B", subject: "math", teachers: ["t1"], hours: 1 },
  ],
};

function neighbours(c: Problem, l: number): number[] {
  return Array.from(c.neighbours(l)).sort((a, b) => a - b);
}

describe("mini instance", () => {
  const c = Problem.from(mini);

  it("expands requirements into lessons", () => {
    expect(c.nLessons).toBe(29 + 29 + 32);
    expect(c.nSlots).toBe(35);
  });

  it("keeps both teachers on a subgroup lesson", () => {
    const l = c.lessonReq.indexOf(mini.requirements.findIndex((r) => r.subject === "kazakh_language"));
    expect(c.teachersOf(l)).toHaveLength(2);
  });

  it("builds a symmetric conflict graph without loops or duplicates", () => {
    for (let l = 0; l < c.nLessons; l++) {
      const ns = neighbours(c, l);
      expect(ns).not.toContain(l);
      expect(new Set(ns).size).toBe(ns.length);
      for (const m of ns) expect(neighbours(c, m)).toContain(l);
    }
  });

  it("blocks slots of unavailable teachers", () => {
    const l = c.lessonReq.indexOf(mini.requirements.findIndex((r) => r.subject === "physics"));
    for (let p = 0; p < c.periods; p++) expect(c.isAllowed(l, c.slot(0, p))).toBe(false);
    expect(c.isAllowed(l, c.slot(1, 0))).toBe(true);
  });

  it("counts every lesson of an empty solution as unassigned", () => {
    const v = hardViolations(c, new Int32Array(c.nLessons).fill(UNASSIGNED));
    expect(v.unassigned).toBe(c.nLessons);
    expect(v.total).toBe(c.nLessons);
  });
});

describe("tiny instance", () => {
  const c = Problem.from(tiny);

  it("links lessons by class and by teacher", () => {
    expect(neighbours(c, 0)).toEqual([1, 2, 3]);
    expect(neighbours(c, 2)).toEqual([0, 1]);
    expect(neighbours(c, 3)).toEqual([0, 1]);
  });

  it("accepts a feasible solution", () => {
    expect(hardViolations(c, Int32Array.from([1, 2, 0, 0])).total).toBe(0);
  });

  it("counts each violation type", () => {
    expect(hardViolations(c, Int32Array.from([1, 2, 0, 3]))).toMatchObject({
      teacherUnavailable: 1,
      classGap: 3,
      total: 4,
    });
    expect(hardViolations(c, Int32Array.from([0, 0, 1, 2]))).toMatchObject({ classClash: 1, teacherClash: 1 });
    expect(hardViolations(c, Int32Array.from([0, 1, 2, 0]))).toMatchObject({ teacherClash: 1, classClash: 0 });
    expect(hardViolations(c, Int32Array.from([0, 2, UNASSIGNED, UNASSIGNED]))).toMatchObject({
      classGap: 1,
      unassigned: 2,
    });
    expect(hardViolations(c, Int32Array.from([1, 2, 3, UNASSIGNED]))).toMatchObject({
      classSlot: 1,
      classGap: 1,
    });
  });
});

describe("validation", () => {
  it("rejects unknown references", () => {
    const bad: Instance = { ...tiny, requirements: [{ class: "Z", subject: "math", teachers: ["t9"], hours: 1 }] };
    expect(() => Loader.validateInstance(bad)).toThrow(/unknown class[\s\S]*unknown teacher/);
  });

  it("rejects a class whose lessons do not fit the week", () => {
    const bad: Instance = { ...tiny, requirements: [{ class: "A", subject: "math", teachers: ["t1"], hours: 4 }] };
    expect(() => Loader.validateInstance(bad)).toThrow(/do not fit/);
  });
});

describe("dictionaries", () => {
  const path = (name: string) => fileURLToPath(new URL(`../instances/${name}`, import.meta.url));

  it("loads subjects and the curriculum that refers to them", () => {
    const subjects = Loader.subjects(path("subjects.json"));
    const curriculum = Loader.curriculum(path("curriculum.json"), subjects);
    expect(subjects.subjects).toHaveLength(22);
    const total = (grade: string) => Object.values(curriculum.hours[grade]).reduce((a, b) => a + b, 0);
    expect(["5", "6", "7", "8", "9", "10", "11"].map(total)).toEqual([29, 29, 32, 33, 34, 34, 34]);
  });

  it("rejects a curriculum with subjects missing from the dictionary", () => {
    const subjects = Loader.subjects(path("subjects.json"));
    const few = { ...subjects, subjects: subjects.subjects.filter((s) => s.id !== "math") };
    expect(() => Loader.curriculum(path("curriculum.json"), few)).toThrow(/unknown subject "math"/);
  });
});

describe("difficulty by language of instruction", () => {
  const dict = Loader.subjects(fileURLToPath(new URL("../instances/subjects.json", import.meta.url)));
  const score = (lang: LanguageOfInstruction, id: string) => new SubjectCatalog(dict, lang).difficulty(id);

  it("swaps Kazakh and Russian language scores", () => {
    expect([score("ru", "kazakh_language"), score("ru", "russian_language")]).toEqual([11, 7]);
    expect([score("kk", "kazakh_language"), score("kk", "russian_language")]).toEqual([7, 11]);
  });

  it("keeps other subjects the same", () => {
    expect(score("ru", "math")).toBe(score("kk", "math"));
  });

  it("matches the mini instance, which is a Russian-language school", () => {
    expect(new SubjectCatalog(dict, "ru").subjects(mini.subjects.map((s) => s.id))).toEqual(
      mini.subjects,
    );
  });
});

describe("subgroups", () => {
  const dict = Loader.subjects(fileURLToPath(new URL("../instances/subjects.json", import.meta.url)));
  const split = (lang: LanguageOfInstruction, rule: SplitRule) => new SubjectCatalog(dict, lang).idsWithSplit(rule).sort();

  it("lists split subjects by language of instruction", () => {
    expect(split("ru", "required")).toEqual(["english_language", "informatics", "kazakh_language"]);
    expect(split("ru", "allowed")).toEqual(["art_labour"]);
    expect(split("kk", "required")).toEqual(["english_language", "informatics"]);
    expect(split("kk", "allowed")).toEqual(["art_labour", "russian_language"]);
  });

  it("splits exactly these subjects in the large class of the mini instance", () => {
    const twoTeachers = (cls: string) =>
      mini.requirements.filter((r) => r.class === cls && r.teachers.length === 2).map((r) => r.subject).sort();
    expect(twoTeachers("5A")).toEqual([...split("ru", "required"), ...split("ru", "allowed")].sort());
    expect(twoTeachers("5B")).toEqual([]);
    expect(twoTeachers("7A")).toEqual([]);
  });
});

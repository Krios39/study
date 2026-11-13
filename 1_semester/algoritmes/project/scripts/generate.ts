import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Dsatur } from "../src/dsatur.ts";
import { Generator, type GeneratorParams } from "../src/generator.ts";
import { hardViolations } from "../src/hard.ts";
import { Loader } from "../src/loader.ts";
import type { Instance } from "../src/model.ts";
import { Problem } from "../src/problem.ts";

const path = (name: string) => fileURLToPath(new URL(`../instances/${name}`, import.meta.url));

const common = { largeClassShare: 0.5, teacherMaxLoad: 24, unavailableShare: 0.3 };
const sets: GeneratorParams[] = [
  { name: "small-7", seed: 1, classes: 7, shifts: 1, ...common },
  { name: "small-10", seed: 2, classes: 10, shifts: 1, ...common },
  { name: "medium-20", seed: 3, classes: 20, shifts: 1, ...common },
  { name: "medium-30", seed: 4, classes: 30, shifts: 2, ...common },
  { name: "large-60", seed: 5, classes: 60, shifts: 2, ...common },
];

function format(inst: Instance): string {
  const list = (items: unknown[]) => "[\n" + items.map((x) => "    " + JSON.stringify(x)).join(",\n") + "\n  ]";
  return (
    "{\n" +
    `  "name": ${JSON.stringify(inst.name)},\n` +
    `  "days": ${inst.days},\n` +
    `  "periodsPerDay": ${inst.periodsPerDay},\n` +
    `  "subjects": ${list(inst.subjects)},\n` +
    `  "teachers": ${list(inst.teachers)},\n` +
    `  "classes": ${list(inst.classes)},\n` +
    `  "requirements": ${list(inst.requirements)}\n` +
    "}\n"
  );
}

const subjects = Loader.subjects(path("subjects.json"));
const curriculum = Loader.curriculum(path("curriculum.json"), subjects);

for (const params of sets) {
  const { instance, hidden } = Generator.generate(params, subjects, curriculum);
  Loader.validateInstance(instance);
  const problem = Problem.from(instance);
  const hiddenViolations = hardViolations(problem, Int32Array.from(hidden)).total;
  if (hiddenViolations !== 0) throw new Error(`${params.name}: hidden timetable has ${hiddenViolations} hard violations`);

  writeFileSync(path(`${params.name}.json`), format(instance));
  writeFileSync(path(`${params.name}.hidden.json`), JSON.stringify({ instance: instance.name, slotOf: hidden }) + "\n");

  const started = performance.now();
  const dsatur = hardViolations(problem, Dsatur.solve(problem, { respectAllowed: true }).slotOf);
  const ms = performance.now() - started;
  const loads = new Map<string, number>();
  for (const r of instance.requirements) for (const t of r.teachers) loads.set(t, (loads.get(t) ?? 0) + r.hours);
  const meanLoad = [...loads.values()].reduce((a, b) => a + b, 0) / loads.size;
  console.log(
    [
      params.name.padEnd(10),
      `classes ${instance.classes.length}`,
      `teachers ${instance.teachers.length}`,
      `lessons ${problem.nLessons}`,
      `slots ${problem.nSlots}`,
      `edges ${problem.adjList.length / 2}`,
      `mean load ${meanLoad.toFixed(1)}`,
      `dsatur: unassigned ${dsatur.unassigned}, gaps ${dsatur.classGap}, other ${dsatur.total - dsatur.unassigned - dsatur.classGap}, ${ms.toFixed(1)} ms`,
    ].join(" | "),
  );
}

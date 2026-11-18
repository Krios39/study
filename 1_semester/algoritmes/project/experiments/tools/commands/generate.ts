import { writeFileSync } from "node:fs";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { PlantedGenerator, type PlantedParams } from "../../../src/generators/planted-generator.ts";
import { Loader } from "../../../src/io/loader.ts";
import type { Instance } from "../../../src/model.ts";
import { Problem } from "../../../src/core/problem.ts";
import { RandomGenerator } from "../../../src/generators/random-generator.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { Command } from "../command.ts";
import { Workspace } from "../workspace.ts";

export class GenerateCommand extends Command {
  readonly name = "generate";
  readonly summary = "Generate the fixed project schools with a planted timetable";

  async run() {
    const path = (name: string) => Workspace.path(`instances/${name}`);

    const common = { largeClassShare: 0.5, teacherMaxLoad: 24, unavailableShare: 0.3 };
    const sets: PlantedParams[] = [
      { name: "small-7", seed: 1, classes: 7, shifts: 1, ...common },
      { name: "small-10", seed: 2, classes: 10, shifts: 1, ...common },
      { name: "medium-20", seed: 3, classes: 20, shifts: 1, ...common },
      { name: "medium-30", seed: 4, classes: 30, shifts: 2, ...common },
      { name: "large-60", seed: 5, classes: 60, shifts: 2, ...common },
    ];
    const heavySeeds = [1, 2, 4];

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

    const { subjects, curriculum } = Workspace.dictionaries();

    for (const params of sets) {
      const { instance, hidden } = new PlantedGenerator(subjects, curriculum).generate(params);
      Loader.validateInstance(instance);
      const problem = Problem.from(instance);
      const hiddenViolations = Timetable.from(problem, Int32Array.from(hidden)).violations().total;
      if (hiddenViolations !== 0) throw new Error(`${params.name}: hidden timetable has ${hiddenViolations} hard violations`);

      writeFileSync(path(`${params.name}.json`), format(instance));
      writeFileSync(path(`${params.name}.hidden.json`), JSON.stringify({ instance: instance.name, slotOf: hidden }) + "\n");

      const started = performance.now();
      const dsatur = Timetable.from(problem, new Dsatur({ respectAllowed: true }).solve(problem).slotOf).violations();
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

    for (const seed of heavySeeds) {
      const name = `heavy-${seed}`;
      const { instance, meta } = new RandomGenerator(subjects, curriculum).generate({ seed, name, size: "medium", shifts: 1, loadRange: [24, 24], unavailableShare: 0 });
      Loader.validateInstance(instance);
      writeFileSync(path(`${name}.json`), format(instance));
      const problem = Problem.from(instance);
      const dsatur = Timetable.from(problem, Dsatur.recommended().solve(problem).slotOf).violations();
      console.log(
        [
          name.padEnd(10),
          `classes ${instance.classes.length}`,
          `teachers ${instance.teachers.length}`,
          `lessons ${problem.nLessons}`,
          `mean load ${meta.meanLoad.toFixed(1)}`,
          `best dsatur: unassigned ${dsatur.unassigned}, gaps ${dsatur.classGap}`,
        ].join(" | "),
      );
    }
  }
}

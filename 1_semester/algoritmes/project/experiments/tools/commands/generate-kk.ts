import { writeFileSync } from "node:fs";
import { Problem } from "../../../src/core/problem.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { PlantedGenerator, type PlantedParams } from "../../../src/generators/planted-generator.ts";
import { RandomGenerator } from "../../../src/generators/random-generator.ts";
import { Loader } from "../../../src/io/loader.ts";
import type { Instance } from "../../../src/model.ts";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { Command } from "../command.ts";
import { Workspace } from "../workspace.ts";

export class GenerateKkCommand extends Command {
  readonly name = "generate-kk";
  readonly summary = "Generate twins of the project schools with Kazakh as the language of instruction";

  async run() {
    const { subjects, curriculum } = Workspace.dictionaries("kk");
    const common = { largeClassShare: 0.5, teacherMaxLoad: 24, unavailableShare: 0.3 };
    const planted: PlantedParams[] = [
      { name: "mini-kk", seed: 11, classes: 3, shifts: 1, ...common },
      { name: "small-7-kk", seed: 1, classes: 7, shifts: 1, ...common },
      { name: "small-10-kk", seed: 2, classes: 10, shifts: 1, ...common },
      { name: "medium-20-kk", seed: 3, classes: 20, shifts: 1, ...common },
      { name: "medium-30-kk", seed: 4, classes: 30, shifts: 2, ...common },
      { name: "large-60-kk", seed: 5, classes: 60, shifts: 2, ...common },
      { name: "large-100-1shift-1-kk", seed: 1001, classes: 100, shifts: 1, ...common },
      { name: "large-100-2shift-1-kk", seed: 1001, classes: 100, shifts: 2, ...common },
    ];
    for (const params of planted) {
      const { instance, hidden } = new PlantedGenerator(subjects, curriculum).generate(params);
      const hard = Timetable.from(Problem.from(instance), Int32Array.from(hidden)).violations().total;
      if (hard !== 0) throw new Error(`${params.name}: hidden timetable has ${hard} hard violations`);
      this.save(instance);
    }
    for (const seed of [1, 2, 4]) {
      const name = `heavy-${seed}-kk`;
      const { instance } = new RandomGenerator(subjects, curriculum).generate({ seed, name, size: "medium", shifts: 1, loadRange: [24, 24], unavailableShare: 0 });
      this.save(instance);
    }
  }

  private save(instance: Instance) {
    Loader.validateInstance(instance);
    writeFileSync(Workspace.path(`instances/${instance.name}.json`), JSON.stringify(instance) + "\n");
    const problem = Problem.from(instance);
    const start = Timetable.from(problem, Dsatur.recommended().solve(problem).slotOf).evaluation();
    console.log(
      [
        instance.name.padEnd(24),
        `classes ${instance.classes.length}`,
        `teachers ${instance.teachers.length}`,
        `lessons ${problem.nLessons}`,
        `dsatur hard ${start.hard.total}`,
        `cost ${Math.round(start.cost)}`,
      ].join(" | "),
    );
  }
}

import { Problem } from "../../src/core/problem.ts";
import { RandomGenerator, type RandomMeta, type RandomParams } from "../../src/generators/random-generator.ts";
import type { Instance } from "../../src/model.ts";
import { Ilp } from "../../src/solvers/exact.ts";
import { Workspace } from "./workspace.ts";

export interface SchoolGroup {
  name: string;
  count: number;
  params: (seed: number) => RandomParams;
  confirm?: boolean;
}

export interface School {
  group: string;
  seed: number;
  instance: Instance;
  meta: RandomMeta;
  problem: Problem;
}

const dense = (load: number): RandomParams => ({ seed: 0, size: "medium", shifts: 1, loadRange: [load, load], unavailableShare: 0 });

export class SchoolSets {
  static readonly stress: SchoolGroup[] = [
    { name: "small", count: 8, params: (seed) => ({ seed, size: "small" }) },
    { name: "medium", count: 8, params: (seed) => ({ seed, size: "medium" }) },
    { name: "medium-heavy", count: 8, params: (seed) => ({ ...dense(24), seed }) },
    { name: "large", count: 6, params: (seed) => ({ seed, size: "large" }) },
  ];

  static readonly hard: SchoolGroup[] = [26, 28, 30, 32, 34, 36, 38, 40].map((load) => ({
    name: `нагрузка ${load}`,
    count: 8,
    params: (seed) => ({ ...dense(load), seed }),
    confirm: true,
  }));

  static named(name: string): SchoolGroup[] {
    if (name === "stress") return SchoolSets.stress;
    if (name === "hard") return SchoolSets.hard;
    throw new Error(`unknown school set "${name}"`);
  }

  static async *schools(groups: SchoolGroup[], firstSeed = 1, seedLimit = 500): AsyncGenerator<School> {
    const { subjects, curriculum } = Workspace.dictionaries();
    const generator = new RandomGenerator(subjects, curriculum);
    for (const group of groups) {
      let taken = 0;
      for (let seed = firstSeed; taken < group.count && seed < firstSeed + seedLimit; seed++) {
        const { instance, meta } = generator.generate(group.params(seed));
        if (meta.provablyInfeasible.length > 0) continue;
        const problem = Problem.from(instance);
        if (group.confirm && !(await Ilp.solve(problem, { hardOnly: true, timeLimit: 20 })).slotOf) continue;
        taken++;
        yield { group: group.name, seed, instance, meta, problem };
      }
    }
  }
}

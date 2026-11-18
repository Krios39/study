import { mkdirSync, writeFileSync } from "node:fs";
import { Annealing } from "../../../src/solvers/annealing.ts";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { Ilp } from "../../../src/solvers/exact.ts";
import { Problem } from "../../../src/core/problem.ts";
import { RandomGenerator } from "../../../src/generators/random-generator.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { Workspace } from "../workspace.ts";
import type { Args } from "../args.ts";
import { Command } from "../command.ts";

export class HardsetCommand extends Command {
  readonly name = "hardset";
  readonly summary = "Test the solvers on dense schools confirmed by the exact solver";

  async run(args: Args) {
    const load = Number(args.get("load") ?? 28);
    const wanted = Number(args.get("schools") ?? 8);
    const maxSeeds = Number(args.get("max-seeds") ?? 60);
    const limit = Number(args.get("limit") ?? 20);

    const { subjects, curriculum } = Workspace.dictionaries();

    mkdirSync(Workspace.path("experiments/raw"), { recursive: true });
    const lines: string[] = [];
    const counts = { obvious: 0, infeasible: 0, unknown: 0, feasible: 0 };
    const solved = { dsatur: 0, annealing: 0, kempe: 0 };
    const soft = { annealing: 0, kempe: 0 };
    for (let seed = 1; seed <= maxSeeds && counts.feasible < wanted; seed++) {
      const { instance, meta } = new RandomGenerator(subjects, curriculum).generate({ seed, size: "medium", shifts: 1, loadRange: [load, load], unavailableShare: 0 });
      if (meta.provablyInfeasible.length > 0) {
        counts.obvious++;
        continue;
      }
      const problem = Problem.from(instance);
      const exact = await Ilp.solve(problem, { hardOnly: true, timeLimit: limit });
      if (exact.status === "infeasible") {
        counts.infeasible++;
        continue;
      }
      if (!exact.slotOf) {
        counts.unknown++;
        continue;
      }
      counts.feasible++;
      const slotOf = Dsatur.recommended().solve(problem).slotOf;
      const dsatur = Timetable.from(problem, slotOf);
      const plain = Timetable.from(problem, new Annealing({ seed: 1, kempeShare: 0 }).solve(problem, slotOf).slotOf);
      const kempe = Timetable.from(problem, new Annealing({ seed: 1, kempeShare: 0.5 }).solve(problem, slotOf).slotOf);
      if (dsatur.hard === 0) solved.dsatur++;
      if (plain.hard === 0) solved.annealing++;
      if (kempe.hard === 0) solved.kempe++;
      const per100 = (table: Timetable) => (100 * (table.cost - 1000 * table.hard)) / problem.nLessons;
      soft.annealing += per100(plain);
      soft.kempe += per100(kempe);
      lines.push(
        JSON.stringify({
          load,
          seed,
          classes: instance.classes.length,
          teachers: instance.teachers.length,
          lessons: problem.nLessons,
          maxLoadShare: Number(meta.maxLoadShare.toFixed(2)),
          exactSeconds: Number(exact.seconds.toFixed(2)),
          dsaturHard: dsatur.hard,
          annealingHard: plain.hard,
          kempeHard: kempe.hard,
          annealingSoftPer100: Number(per100(plain).toFixed(1)),
          kempeSoftPer100: Number(per100(kempe).toFixed(1)),
        }),
      );
    }
    writeFileSync(Workspace.path(`experiments/raw/hardset-load${load}.jsonl`), lines.join("\n") + "\n");
    const n = Math.max(1, counts.feasible);
    console.log(
      `нагрузка ${load}: очевидно нерешаемых ${counts.obvious}, нерешаемых по решателю ${counts.infeasible}, не успел ${counts.unknown}, с расписанием ${counts.feasible}` +
        ` | без нарушений: DSATUR ${solved.dsatur}, отжиг ${solved.annealing}, отжиг с цепочками ${solved.kempe}` +
        ` | мягкая цена: отжиг ${(soft.annealing / n).toFixed(1)}, с цепочками ${(soft.kempe / n).toFixed(1)}`,
    );
  }
}

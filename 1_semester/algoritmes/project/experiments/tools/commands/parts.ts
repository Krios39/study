import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { Annealing } from "../../../src/solvers/annealing.ts";
import { Ilp } from "../../../src/solvers/exact.ts";
import { Problem } from "../../../src/core/problem.ts";
import { RandomGenerator } from "../../../src/generators/random-generator.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { COST_PARTS } from "../cost-parts.ts";
import { Workspace } from "../workspace.ts";
import type { Args } from "../args.ts";
import { Command } from "../command.ts";

export class PartsCommand extends Command {
  readonly name = "parts";
  readonly summary = "Compare annealing with the exact reference per cost term";

  async run(args: Args) {
    const COLUMNS = [
      "school",
      "classes",
      "lessons",
      "part",
      "status",
      "exact",
      "bound",
      "annealingAloneMean",
      "annealingAloneBest",
      "inFullCostMean",
      "seconds",
    ];

    mkdirSync(Workspace.path("experiments/raw"), { recursive: true });

    if (args.has("merge")) {
      const rows = readdirSync(Workspace.path("experiments/raw"))
        .filter((name) => name.startsWith("parts-") && name.endsWith(".jsonl"))
        .sort()
        .flatMap((name) => readFileSync(Workspace.path(`experiments/raw/${name}`), "utf8").trim().split("\n"))
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Record<string, string | number>);
      writeFileSync(Workspace.path("experiments/parts.csv"), [COLUMNS.join(","), ...rows.map((row) => COLUMNS.map((c) => row[c]).join(","))].join("\n") + "\n");
      console.log(`experiments/parts.csv: ${rows.length} строк`);
    } else {
      const limit = Number(args.get("limit") ?? 60);
      const seeds = Number(args.get("seeds") ?? 3);
      let school = args.get("instance");
      let problem: Problem;
      if (school) {
        problem = Workspace.problem(school);
      } else {
        const seed = Number(args.get("random") ?? 1);
        const { subjects, curriculum } = Workspace.dictionaries();
        school = `random-small-${seed}`;
        problem = Problem.from(new RandomGenerator(subjects, curriculum).generate({ seed, size: "small", name: school }).instance);
      }

      const hard = await Ilp.solve(problem, { hardOnly: true, timeLimit: limit });
      if (!hard.slotOf) throw new Error(`${school}: no feasible timetable (${hard.status})`);
      const start = hard.slotOf;
      const full = Array.from({ length: seeds }, (_, i) => new Annealing({ seed: i + 1 }).solve(problem, start).slotOf);

      const lines: string[] = [];
      for (const [part, weights] of COST_PARTS) {
        const alone = Array.from({ length: seeds }, (_, i) => new Annealing({ seed: i + 1, weights }).solve(problem, start));
        const best = alone.reduce((a, b) => (b.cost < a.cost ? b : a));
        const result = await Ilp.solve(problem, { timeLimit: limit, start: best.slotOf, weights });
        const inFull = full.map((slotOf) => Timetable.from(problem, slotOf, weights).cost);
        const mean = (values: number[]) => Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
        const row = {
          school,
          classes: problem.nClasses,
          lessons: problem.nLessons,
          part,
          status: result.status,
          exact: Number(result.objective.toFixed(2)),
          bound: Number(result.bound.toFixed(2)),
          annealingAloneMean: mean(alone.map((run) => run.cost)),
          annealingAloneBest: Number(best.cost.toFixed(2)),
          inFullCostMean: mean(inFull),
          seconds: Number(result.seconds.toFixed(1)),
        };
        lines.push(JSON.stringify(row));
        console.log(
          `${school.padEnd(15)} ${part.padEnd(22)} ${result.status.padEnd(9)} эталон ${String(row.exact).padStart(6)} граница ${String(row.bound).padStart(6)}` +
            ` | отжиг по этой части ${String(row.annealingAloneMean).padStart(7)} | в полной цене ${String(row.inFullCostMean).padStart(7)} | ${row.seconds} с`,
        );
      }
      writeFileSync(Workspace.path(`experiments/raw/parts-${school}.jsonl`), lines.join("\n") + "\n");
    }
  }
}

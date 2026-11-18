import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { Annealing } from "../../../src/solvers/annealing.ts";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { Ilp } from "../../../src/solvers/exact.ts";
import type { CostWeights } from "../../../src/core/cost.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { COST_PARTS } from "../cost-parts.ts";
import { Workspace } from "../workspace.ts";
import type { Args } from "../args.ts";
import { Command } from "../command.ts";

export class ReferenceCommand extends Command {
  readonly name = "reference";
  readonly summary = "Compute exact reference values per cost term";

  async run(args: Args) {
    const names = (args.get("instances") ?? "mini").split(",");
    const limit = Number(args.get("limit") ?? 60);
    const fullLimit = Number(args.get("full-limit") ?? limit);
    const hardOnly = args.has("hard-only");

    mkdirSync(Workspace.path("experiments/raw"), { recursive: true });
    const summaryPath = Workspace.path("experiments/reference.csv");
    const header = [
      "instance",
      "lessons",
      "hardStatus",
      "hardSeconds",
      "part",
      "limitSeconds",
      "status",
      "seconds",
      "annealing",
      "model",
      "bound",
      "checked",
      "columns",
      "rows",
    ];
    if (!existsSync(summaryPath)) writeFileSync(summaryPath, header.join(",") + "\n");
    const record = (values: (string | number)[]) => appendFileSync(summaryPath, values.join(",") + "\n");
    const round = (value: number) => (Number.isFinite(value) ? Number(value.toFixed(2)) : "");

    for (const name of names) {
      const problem = Workspace.problem(name);
      const dsatur = Dsatur.recommended().solve(problem).slotOf;
      const hard = await Ilp.solve(problem, { hardOnly: true, timeLimit: limit });
      const hardChecked = hard.slotOf ? Timetable.from(problem, hard.slotOf).hard : "";
      console.log(
        `\n${name}: уроков ${problem.nLessons} | только жёсткие: ${hard.status} за ${hard.seconds.toFixed(1)} с` +
          ` (DSATUR оставил ${Timetable.from(problem, dsatur).hard}, проверка решения модели: ${hardChecked})`,
      );
      record([name, problem.nLessons, hard.status, round(hard.seconds), "только жёсткие", limit, hard.status, round(hard.seconds), "", "", "", hardChecked, hard.columns, hard.rows]);
      if (hardOnly || hard.status === "infeasible") continue;

      const start = hard.slotOf ?? dsatur;
      let boundSum = 0;
      let allOptimal = true;
      for (const [label, weights] of [...COST_PARTS, ["полная цена", {}] as [string, Partial<CostWeights>]]) {
        const whole = label === "полная цена";
        const annealed = new Annealing({ seed: 1, weights }).solve(problem, start);
        const table = Timetable.from(problem, annealed.slotOf, weights);
        const seconds = whole ? fullLimit : limit;
        const result = await Ilp.solve(problem, { timeLimit: seconds, start: table.hard === 0 ? annealed.slotOf : undefined, weights });
        const checked = result.slotOf ? Timetable.from(problem, result.slotOf, weights) : undefined;
        if (!whole) {
          boundSum += result.bound;
          if (result.status !== "optimal") allOptimal = false;
        }
        console.log(
          `  ${label.padEnd(24)} ${result.status.padEnd(9)} ${result.seconds.toFixed(1).padStart(6)} с | отжиг ${table.cost.toFixed(1)}` +
            ` | модель ${result.objective.toFixed(1)} | граница ${result.bound.toFixed(1)}` +
            ` | проверка ${checked ? checked.cost.toFixed(1) : "-"}${checked && checked.hard > 0 ? ` (жёстких ${checked.hard})` : ""}`,
        );
        record([name, problem.nLessons, hard.status, round(hard.seconds), label, seconds, result.status, round(result.seconds), round(table.cost), round(result.objective), round(result.bound), checked ? round(checked.cost) : "", result.columns, result.rows]);
        if (whole) {
          const best = Math.max(result.bound, boundSum);
          const upper = Math.min(table.cost, result.objective);
          console.log(
            `  нижняя граница полной цены: ${best.toFixed(1)} (сумма по частям ${boundSum.toFixed(1)}${allOptimal ? ", все части доказаны" : ""}, решатель ${result.bound.toFixed(1)})` +
              ` | лучшее найденное ${upper.toFixed(1)} | отжиг выше границы на ${best > 0 ? ((100 * (table.cost - best)) / best).toFixed(0) : "-"} %`,
          );
          record([name, problem.nLessons, hard.status, round(hard.seconds), "граница полной цены", seconds, allOptimal ? "части доказаны" : "части не все доказаны", "", round(table.cost), round(upper), round(best), "", "", ""]);
        }
      }
    }
  }
}

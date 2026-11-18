import { writeFileSync } from "node:fs";
import { Annealing, type AnnealingOptions } from "../../../src/solvers/annealing.ts";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { BASE_SCHOOLS, Workspace } from "../workspace.ts";
import type { Args } from "../args.ts";
import { Command } from "../command.ts";

export class AnnealCommand extends Command {
  readonly name = "anneal";
  readonly summary = "Improve the project schools by annealing and save the timetables";

  async run(args: Args) {
    const seeds = Number(args.get("seeds") ?? 3);
    const perLesson = Number(args.get("per-lesson") ?? 1000);
    const startTemperature = Number(args.get("t0") ?? 20);
    const endTemperature = Number(args.get("t1") ?? 1);


    const describe = (timetable: Timetable) => {
      const soft = timetable.soft();
      return {
        жёсткие: timetable.hard,
        сложность: soft.difficultySpread,
        повторы: soft.sameSubjectInDay,
        "окна учителей": soft.teacherGaps,
        "макс. окон у учителя": soft.worstTeacherGaps,
        "переходы между сменами": soft.shiftBreaks,
        "простой между сменами": soft.shiftIdle,
        перекос: soft.dayImbalance,
        "не в своей половине": soft.misplaced,
        "против пожеланий": soft.wishesBroken,
        цена: timetable.cost,
      };
    };

    const MIXES: [string, AnnealingOptions][] = [
      ["move", { kempeShare: 0, swapShare: 0 }],
      ["swap", { kempeShare: 0, swapShare: 1 }],
      ["both", {}],
    ];
    for (const name of BASE_SCHOOLS) {
      const problem = Workspace.problem(name);
      const slotOf = Dsatur.recommended().solve(problem).slotOf;
      const rows: Record<string, string | number>[] = [{ вариант: "DSATUR", ...describe(Timetable.from(problem, slotOf)) }];
      let bestCost = Infinity;
      let bestSlots = slotOf;
      for (const [moves, mix] of MIXES) {
        const sum: Record<string, number> = {};
        let solved = 0;
        let seconds = 0;
        for (let seed = 1; seed <= seeds; seed++) {
          const started = performance.now();
          const result = new Annealing({
            ...mix,
            seed,
            evaluations: problem.nLessons * perLesson,
            startTemperature,
            endTemperature,
          }).solve(problem, slotOf);
          seconds += (performance.now() - started) / 1000;
          const stats = describe(Timetable.from(problem, result.slotOf));
          if (stats.жёсткие === 0) solved++;
          if (moves === "both" && result.cost < bestCost) {
            bestCost = result.cost;
            bestSlots = result.slotOf;
          }
          for (const [key, value] of Object.entries(stats)) sum[key] = (sum[key] ?? 0) + value;
        }
        const row: Record<string, string | number> = { вариант: moves };
        for (const [key, value] of Object.entries(sum)) row[key] = Number((value / seeds).toFixed(1));
        row["без жёстких"] = `${solved}/${seeds}`;
        row["сек"] = Number((seconds / seeds).toFixed(1));
        rows.push(row);
      }
      writeFileSync(
        Workspace.path(`instances/${name}.annealed.json`),
        JSON.stringify({ instance: name, moves: "both", cost: bestCost, slotOf: Array.from(bestSlots) }) + "\n",
      );
      console.log(`\n${name}: уроков ${problem.nLessons}, ходов ${problem.nLessons * perLesson}`);
      console.table(rows);
    }
  }
}

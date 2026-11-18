import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { Annealing } from "../../../src/solvers/annealing.ts";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { Tabu } from "../../../src/solvers/tabu.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { Workspace } from "../workspace.ts";
import type { Args } from "../args.ts";
import { Csv } from "../report.ts";
import { SchoolSets } from "../schools.ts";
import { Command } from "../command.ts";

export class CompareCommand extends Command {
  readonly name = "compare";
  readonly summary = "Compare annealing and tabu search on a school set";

  async run(args: Args) {
    const id = args.get("id");
    if (!id) throw new Error("--id is required");
    const set = args.get("set") ?? "stress";
    const algo = args.get("algo") ?? "annealing";
    const perLesson = Number(args.get("per-lesson") ?? 1000);
    const candidates = Number(args.get("candidates") ?? 20);
    const tenure = Number(args.get("tenure") ?? 10);
    const seed = Number(args.get("seed") ?? 1);
    const note = args.get("note") ?? "";

    const groups = SchoolSets.named(set);

    mkdirSync(Workspace.path("experiments/raw"), { recursive: true });
    const rawPath = Workspace.path(`experiments/raw/${id}.jsonl`);
    writeFileSync(rawPath, "");

    const rows: { group: string; lessons: number; seconds: number; hard: number; soft: number; dsaturHard: number }[] = [];
    for await (const { group, seed: schoolSeed, instance, meta, problem } of SchoolSets.schools(groups)) {
      const slotOf = Dsatur.recommended().solve(problem).slotOf;
      const budget = problem.nLessons * perLesson;
      const started = performance.now();
      const result =
        algo === "tabu"
          ? new Tabu({ seed, evaluations: budget, candidates, tenure }).solve(problem, slotOf)
          : new Annealing({ seed, evaluations: budget }).solve(problem, slotOf);
      const seconds = (performance.now() - started) / 1000;
      const table = Timetable.from(problem, result.slotOf);
      const softStats = table.soft();
      const row = {
        group,
        lessons: problem.nLessons,
        seconds,
        hard: table.hard,
        soft: (100 * (table.softCost)) / problem.nLessons,
        dsaturHard: Timetable.from(problem, slotOf).hard,
      };
      rows.push(row);
      appendFileSync(
        rawPath,
        JSON.stringify({
          id,
          set,
          algo,
          perLesson,
          candidates: algo === "tabu" ? candidates : "",
          tenure: algo === "tabu" ? tenure : "",
          group,
          schoolSeed,
          classes: instance.classes.length,
          teachers: instance.teachers.length,
          lessons: problem.nLessons,
          maxLoadShare: Number(meta.maxLoadShare.toFixed(2)),
          seconds: Number(seconds.toFixed(2)),
          dsaturHard: row.dsaturHard,
          hard: row.hard,
          softPer100: Number(row.soft.toFixed(1)),
          soft: softStats,
        }) + "\n",
      );
    }

    const sorted = rows.map((row) => row.soft).sort((a, b) => a - b);
    const median = (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2;
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const summary: Record<string, string | number> = {
      id,
      set,
      algo,
      perLesson,
      candidates: algo === "tabu" ? candidates : "",
      tenure: algo === "tabu" ? tenure : "",
      seed,
      schools: rows.length,
      solvedDsatur: rows.filter((row) => row.dsaturHard === 0).length,
      solved: rows.filter((row) => row.hard === 0).length,
      hardMean: Number((rows.reduce((a, row) => a + row.hard, 0) / rows.length).toFixed(2)),
      softMean: Number(mean.toFixed(1)),
      softMedian: Number(median.toFixed(1)),
      seconds: Number(rows.reduce((a, row) => a + row.seconds, 0).toFixed(1)),
      note,
    };
    for (const group of groups) {
      const items = rows.filter((row) => row.group === group.name);
      summary[`${group.name}:solved`] = items.filter((row) => row.hard === 0).length;
      summary[`${group.name}:soft`] = Number((items.reduce((a, row) => a + row.soft, 0) / Math.max(1, items.length)).toFixed(1));
    }
    const summaryPath = Workspace.path(`experiments/compare-${set}.csv`);
    Csv.append(summaryPath, summary);
    console.log(
      `${id.padEnd(26)} ${set} | без нарушений ${summary.solved} из ${summary.schools} (DSATUR ${summary.solvedDsatur}) | жёстких в среднем ${summary.hardMean}` +
        ` | мягкая цена: среднее ${summary.softMean}, медиана ${summary.softMedian} | ${summary.seconds} с`,
    );
  }
}

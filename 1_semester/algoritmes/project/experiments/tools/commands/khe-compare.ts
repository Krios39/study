import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Annealing } from "../../../src/solvers/annealing.ts";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { Problem } from "../../../src/core/problem.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { XhsttEvaluator } from "../../../src/io/xhstt-evaluator.ts";
import { XHSTT_EXPORT_WEIGHTS, XhsttWriter } from "../../../src/io/xhstt-writer.ts";
import { XhsttReader } from "../../../src/io/xhstt-reader.ts";
import { Xml } from "../../../src/io/xml.ts";
import { BASE_SCHOOLS, Workspace } from "../workspace.ts";
import type { Args } from "../args.ts";
import { Command } from "../command.ts";

export class KheCompareCommand extends Command {
  readonly name = "khe-compare";
  readonly summary = "Prepare and check the comparison with the KHE solver";

  async run(args: Args) {
    const mode = args.positional[0];
    const dir = args.positional[1];
    const names = args.positional[2]?.split(",") ?? [...BASE_SCHOOLS, "large-100-1shift-1", "large-100-2shift-1"];
    const extra = args.positional[3] === "nowish" ? { teacherWish: 0 } : {};
    const searchWeights = { ...XHSTT_EXPORT_WEIGHTS, ...extra };
    if (!dir || (mode !== "export" && mode !== "compare")) throw new Error("usage: khe-compare.ts export|compare <folder> [schools]");

    if (mode === "export") {
      mkdirSync(dir, { recursive: true });
      const ours: Record<string, unknown> = {};
      for (const name of names) {
        const instance = Workspace.instance(name);
        const problem = Problem.from(instance);
        writeFileSync(join(dir, `${name}.xml`), XhsttWriter.archive(instance, [], extra, "courses"));
        const start = Dsatur.recommended().solve(problem).slotOf;
        const runs = [];
        for (const perLesson of [100, 1000, 4000]) {
          const started = performance.now();
          const result = new Annealing({ seed: 1, evaluations: problem.nLessons * perLesson, weights: searchWeights }).solve(problem, start);
          const seconds = (performance.now() - started) / 1000;
          const table = Timetable.from(problem, result.slotOf, searchWeights);
          const check = Xml.parse(XhsttWriter.archive(instance, [{ description: "annealing", slotOf: result.slotOf }], extra, "courses"));
          const spec = XhsttEvaluator.evaluate(
            XhsttReader.instanceNodes(check)[0],
            XhsttReader.solutionNodes(check)[0],
          );
          const objective = table.softCost;
          if (spec.objective !== objective || (spec.infeasibility === 0) !== (table.hard === 0)) {
            throw new Error(`${name}: course-style export disagrees (${spec.infeasibility}/${spec.objective} against ${table.hard}/${objective})`);
          }
          runs.push({ perLesson, seconds: Number(seconds.toFixed(2)), hard: table.hard, objective });
        }
        ours[name] = { lessons: problem.nLessons, classes: instance.classes.length, runs };
        console.log(`${name.padEnd(20)} уроков ${String(problem.nLessons).padStart(4)} | отжиг по выгружаемой цене: ${runs.map((r) => `${r.perLesson} ходов ${r.seconds} с → ${r.hard}/${r.objective}`).join(" ; ")}`);
      }
      writeFileSync(join(dir, "ours.json"), JSON.stringify(ours));
    } else {
      const ours = JSON.parse(readFileSync(join(dir, "ours.json"), "utf8")) as Record<
        string,
        { lessons: number; classes: number; runs: { perLesson: number; seconds: number; hard: number; objective: number }[] }
      >;
      const lines = ["school,classes,lessons,solver,setting,seconds,infeasibility,objective"];
      for (const name of names) {
        const mine = ours[name];
        if (!mine) continue;
        for (const run of mine.runs) lines.push([name, mine.classes, mine.lessons, "annealing", `${run.perLesson} moves per lesson`, run.seconds, run.hard, run.objective].join(","));
        const parts = [`${name.padEnd(20)} уроков ${String(mine.lessons).padStart(4)}`];
        parts.push(`отжиг: ${mine.runs.map((r) => `${r.seconds} с → ${r.hard}/${r.objective}`).join(" ; ")}`);
        for (const label of ["khe1", "khe214"]) {
          const out = join(dir, `${name}.${label}.xml`);
          const timePath = join(dir, `${name}.${label}.time`);
          if (!existsSync(out)) continue;
          const seconds = existsSync(timePath) ? Number(readFileSync(timePath, "utf8").trim()) : NaN;
          try {
            const document = Xml.parse(readFileSync(out, "utf8"));
            const groups = document.children[0].children.find((c) => c.name === "SolutionGroups");
            const solutions = groups?.children.flatMap((group) => group.children.filter((c) => c.name === "Solution")) ?? [];
            if (solutions.length === 0) throw new Error("no solution in the output");
            const costs = solutions.map((solution) => XhsttEvaluator.evaluate(XhsttReader.instanceNodes(document)[0], solution));
            const best = costs.reduce((a, b) => (b.infeasibility < a.infeasibility || (b.infeasibility === a.infeasibility && b.objective < a.objective) ? b : a));
            const own = existsSync(join(dir, `${name}.${label}.cost`)) ? readFileSync(join(dir, `${name}.${label}.cost`), "utf8").trim() : "?";
            parts.push(`${label}: ${seconds} с → ${best.infeasibility}/${best.objective} (сам KHE пишет ${own})`);
            lines.push([name, mine.classes, mine.lessons, "KHE", label === "khe1" ? "version 2.15, 1 thread" : "version 2.14, 1 thread", seconds, best.infeasibility, best.objective].join(","));
          } catch (error) {
            parts.push(`${label}: ошибка разбора (${(error as Error).message})`);
          }
        }
        console.log(parts.join(" | "));
      }
      writeFileSync(Workspace.path("experiments/khe.csv"), lines.join("\n") + "\n");
    }
  }
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Annealing } from "../../../src/solvers/annealing.ts";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { Problem } from "../../../src/core/problem.ts";
import { RandomGenerator, type RandomParams } from "../../../src/generators/random-generator.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { XhsttEvaluator } from "../../../src/io/xhstt-evaluator.ts";
import { XHSTT_EXPORT_WEIGHTS, XhsttWriter } from "../../../src/io/xhstt-writer.ts";
import { XhsttReader } from "../../../src/io/xhstt-reader.ts";
import { Xml } from "../../../src/io/xml.ts";
import { Workspace } from "../workspace.ts";
import type { Args } from "../args.ts";
import { Command } from "../command.ts";

export class HsevalRandomCommand extends Command {
  readonly name = "hseval-random";
  readonly summary = "Prepare and check random schools for the HSEval validator";

  async run(args: Args) {
    const mode = args.positional[0] ?? "generate";
    const exportDir = "instances/xhstt-export/random";
    const responseDir = "experiments/hseval/random";
    const manifestPath = Workspace.path("experiments/hseval-random-ours.csv");

    if (mode === "generate") {
      const groups: { name: string; count: number; params: (seed: number) => RandomParams }[] = [
        { name: "small", count: 15, params: (seed) => ({ seed, size: "small" }) },
        { name: "medium", count: 15, params: (seed) => ({ seed, size: "medium" }) },
        { name: "medium-heavy", count: 10, params: (seed) => ({ seed, size: "medium", shifts: 1, loadRange: [28, 28], unavailableShare: 0 }) },
        { name: "large", count: 10, params: (seed) => ({ seed, size: "large" }) },
      ];
      const { subjects, curriculum } = Workspace.dictionaries();
      mkdirSync(Workspace.path(exportDir), { recursive: true });
      const lines = ["school,group,classes,teachers,shifts,lessons,solution,ourHard,specInfeasibility,ourSoft,specObjective,ourFullSoft"];
      for (const group of groups) {
        let taken = 0;
        for (let seed = 101; taken < group.count; seed++) {
          const name = `${group.name}-${seed}`;
          const { instance, meta } = new RandomGenerator(subjects, curriculum).generate({ ...group.params(seed), name });
          if (meta.provablyInfeasible.length > 0) continue;
          taken++;
          const problem = Problem.from(instance);
          const start = Dsatur.recommended().solve(problem).slotOf;
          const solutions = [
            { description: "DSATUR", slotOf: start },
            { description: "annealing", slotOf: new Annealing({ seed: 1 }).solve(problem, start).slotOf },
          ];
          const xml = XhsttWriter.archive(instance, solutions);
          writeFileSync(Workspace.path(`${exportDir}/${name}.xml`), xml);
          const document = Xml.parse(xml);
          const node = XhsttReader.instanceNodes(document)[0];
          const solutionNodes = document.children[0].children.find((c) => c.name === "SolutionGroups")!.children[0].children;
          solutions.forEach((solution, index) => {
            const exported = Timetable.from(problem, solution.slotOf, XHSTT_EXPORT_WEIGHTS);
            const full = Timetable.from(problem, solution.slotOf);
            const spec = XhsttEvaluator.evaluate(node, solutionNodes.filter((c) => c.name === "Solution")[index]);
            lines.push(
              [
                name,
                group.name,
                instance.classes.length,
                instance.teachers.length,
                meta.shifts,
                problem.nLessons,
                solution.description,
                exported.hard,
                spec.infeasibility,
                exported.softCost,
                spec.objective,
                (full.softCost).toFixed(1),
              ].join(","),
            );
          });
          console.log(`${name.padEnd(18)} классов ${String(instance.classes.length).padStart(2)}, смен ${meta.shifts}, уроков ${String(problem.nLessons).padStart(4)}, файл ${(xml.length / 1024).toFixed(0)} КБ`);
        }
      }
      writeFileSync(manifestPath, lines.join("\n") + "\n");
    } else {
      const rows = readFileSync(manifestPath, "utf8").trim().split("\n").slice(1).map((line) => line.split(","));
      const out = ["school,group,classes,shifts,lessons,solution,ourHard,specInfeasibility,hsevalInfeasibility,ourSoft,specObjective,hsevalObjective,softMatch,infeasibilityMatch,ourHardMatch"];
      const bySchool = new Map<string, string[][]>();
      for (const row of rows) bySchool.set(row[0], [...(bySchool.get(row[0]) ?? []), row]);
      let total = 0;
      let soft = 0;
      let spec = 0;
      let own = 0;
      const missing: string[] = [];
      const mismatches: string[] = [];
      for (const [school, list] of bySchool) {
        const path = Workspace.path(`${responseDir}/${school}.xml`);
        const text = existsSync(path) ? readFileSync(path, "utf8") : "";
        const reported = text.length > 0 ? XhsttReader.reportedCosts(Xml.parse(text)) : [];
        const infeasibility = reported.map((cost) => cost.infeasibility);
        const objective = reported.map((cost) => cost.objective);
        if (infeasibility.length !== list.length) {
          missing.push(school);
          continue;
        }
        list.forEach((row, index) => {
          total++;
          const softMatch = Number(row[9]) === objective[index];
          const specMatch = Number(row[8]) === infeasibility[index];
          const ownMatch = Number(row[7]) === infeasibility[index];
          if (softMatch) soft++;
          if (specMatch) spec++;
          if (ownMatch) own++;
          if (!softMatch || !specMatch) mismatches.push(`${school} ${row[6]}: мягкая ${row[9]} / ${objective[index]}, недопустимость ${row[8]} / ${infeasibility[index]}`);
          out.push([school, row[1], row[2], row[4], row[5], row[6], row[7], row[8], infeasibility[index], row[9], row[10], objective[index], softMatch ? "да" : "нет", specMatch ? "да" : "нет", ownMatch ? "да" : "нет"].join(","));
        });
      }
      writeFileSync(Workspace.path("experiments/hseval-random.csv"), out.join("\n") + "\n");
      console.log(`школ с ответом ${bySchool.size - missing.length} из ${bySchool.size}, расписаний ${total}`);
      console.log(`мягкая цена совпала с HSEval: ${soft} из ${total}`);
      console.log(`недопустимость: с подсчётом по спецификации совпала ${spec} из ${total}, с нашим определением ${own} из ${total}`);
      if (missing.length > 0) console.log(`нет ответа: ${missing.join(", ")}`);
      for (const line of mismatches) console.log(`расхождение: ${line}`);
    }
  }
}

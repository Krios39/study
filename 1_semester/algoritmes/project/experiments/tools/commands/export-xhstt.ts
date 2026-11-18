import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { Problem } from "../../../src/core/problem.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { XhsttEvaluator } from "../../../src/io/xhstt-evaluator.ts";
import { XHSTT_EXPORT_WEIGHTS, XhsttWriter, type XhsttSolution } from "../../../src/io/xhstt-writer.ts";
import { XhsttReader } from "../../../src/io/xhstt-reader.ts";
import { Xml } from "../../../src/io/xml.ts";
import { BASE_SCHOOLS, Workspace } from "../workspace.ts";
import type { Args } from "../args.ts";
import { Command } from "../command.ts";

export class ExportXhsttCommand extends Command {
  readonly name = "export-xhstt";
  readonly summary = "Export project schools and timetables to XHSTT";

  async run(args: Args) {
    const names = args.positional[0]?.split(",") ?? BASE_SCHOOLS;

    mkdirSync(Workspace.path("instances/xhstt-export"), { recursive: true });
    const lines = ["instance,solution,ourHard,xhsttInfeasibility,ourExportedSoft,xhsttObjective,match,ourFullSoft"];
    for (const name of names) {
      const instance = Workspace.instance(name);
      const problem = Problem.from(instance);
      const solutions: XhsttSolution[] = [
        { description: "DSATUR classic", slotOf: new Dsatur().solve(problem).slotOf },
        { description: "DSATUR", slotOf: Dsatur.recommended().solve(problem).slotOf },
      ];
      const annealed = Workspace.path(`instances/${name}.annealed.json`);
      if (existsSync(annealed)) {
        solutions.push({ description: "annealing", slotOf: Int32Array.from(JSON.parse(readFileSync(annealed, "utf8")).slotOf) });
      }
      const xml = XhsttWriter.archive(instance, solutions);
      writeFileSync(Workspace.path(`instances/xhstt-export/${name}.xml`), xml);

      const archive = Xml.parse(xml).children[0];
      const instanceNode = XhsttReader.instanceNodes(Xml.parse(xml))[0];
      const solutionNodes = archive.children.find((c) => c.name === "SolutionGroups")!.children[0].children.filter((c) => c.name === "Solution");
      solutions.forEach((solution, index) => {
        const exported = Timetable.from(problem, solution.slotOf, XHSTT_EXPORT_WEIGHTS);
        const full = Timetable.from(problem, solution.slotOf);
        const cost = XhsttEvaluator.evaluate(instanceNode, solutionNodes[index]);
        const ourSoft = exported.softCost;
        const fullSoft = full.softCost;
        const match = cost.objective === ourSoft && (exported.hard === 0) === (cost.infeasibility === 0);
        lines.push([name, solution.description, exported.hard, cost.infeasibility, ourSoft, cost.objective, match ? "да" : "нет", fullSoft.toFixed(1)].join(","));
        console.log(
          `${name.padEnd(10)} ${solution.description.padEnd(15)} жёсткие: наши ${String(exported.hard).padStart(3)}, XHSTT ${String(cost.infeasibility).padStart(3)}` +
            ` | мягкая (выгружаемая часть): наша ${String(ourSoft).padStart(6)}, XHSTT ${String(cost.objective).padStart(6)} ${match ? "совпало" : "РАСХОЖДЕНИЕ"}` +
            ` | полная мягкая ${fullSoft.toFixed(0)} | файл ${(xml.length / 1024).toFixed(0)} КБ`,
        );
      });
    }
    writeFileSync(Workspace.path("experiments/xhstt-export.csv"), lines.join("\n") + "\n");
  }
}

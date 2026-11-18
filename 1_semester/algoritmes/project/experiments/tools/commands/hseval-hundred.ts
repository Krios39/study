import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Annealing } from "../../../src/solvers/annealing.ts";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { PlantedGenerator } from "../../../src/generators/planted-generator.ts";
import { Problem } from "../../../src/core/problem.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { XHSTT_EXPORT_WEIGHTS, XhsttWriter } from "../../../src/io/xhstt-writer.ts";
import { Workspace } from "../workspace.ts";
import type { Args } from "../args.ts";
import { Command } from "../command.ts";
import { XhsttReader } from "../../../src/io/xhstt-reader.ts";
import { Xml } from "../../../src/io/xml.ts";

export class HsevalHundredCommand extends Command {
  readonly name = "hseval-hundred";
  readonly summary = "Prepare and check 100-class schools for the HSEval validator";

  async run(args: Args) {
    const mode = args.positional[0];
    const dir = args.positional[1];
    if (!dir || (mode !== "generate" && mode !== "compare")) throw new Error("usage: hseval-hundred.ts generate|compare <folder for xml files>");
    const manifest = join(dir, "ours.json");

    if (mode === "generate") {
      const { subjects, curriculum } = Workspace.dictionaries();
      mkdirSync(dir, { recursive: true });
      const ours: Record<string, { solution: string; hard: number; soft: number }[]> = {};
      for (const shifts of [1, 2] as const) {
        for (const seed of [1, 2, 3]) {
          const name = `large-100-${shifts}shift-${seed}`;
          const { instance } = new PlantedGenerator(subjects, curriculum).generate({ name, seed: 1000 + seed, classes: 100, shifts, largeClassShare: 0.5, teacherMaxLoad: 24, unavailableShare: 0.3 });
          const problem = Problem.from(instance);
          const start = Dsatur.recommended().solve(problem).slotOf;
          const solutions = [
            { description: "DSATUR", slotOf: start },
            { description: "annealing", slotOf: new Annealing({ seed: 1 }).solve(problem, start).slotOf },
          ];
          const xml = XhsttWriter.archive(instance, solutions);
          writeFileSync(join(dir, `${name}.xml`), xml);
          ours[name] = solutions.map((solution) => {
            const table = Timetable.from(problem, solution.slotOf, XHSTT_EXPORT_WEIGHTS);
            return { solution: solution.description, hard: table.hard, soft: table.softCost };
          });
          console.log(`${name}: уроков ${problem.nLessons}, файл ${(xml.length / 1024 / 1024).toFixed(1)} МБ`);
        }
      }
      writeFileSync(manifest, JSON.stringify(ours));
    } else {
      const ours = JSON.parse(readFileSync(manifest, "utf8")) as Record<string, { solution: string; hard: number; soft: number }[]>;
      const lines = ["school,solution,ourHard,hsevalInfeasibility,ourSoft,hsevalObjective,match"];
      let total = 0;
      let matched = 0;
      for (const [name, list] of Object.entries(ours)) {
        const path = join(dir, `${name}.response.xml`);
        const text = existsSync(path) ? readFileSync(path, "utf8") : "";
        const reported = text.length > 0 ? XhsttReader.reportedCosts(Xml.parse(text)) : [];
        const infeasibility = reported.map((cost) => cost.infeasibility);
        const objective = reported.map((cost) => cost.objective);
        if (infeasibility.length !== list.length) {
          console.log(`${name}: ответ не получен или не разобран (${text.slice(0, 160).replace(/\s+/g, " ")})`);
          continue;
        }
        list.forEach((row, index) => {
          total++;
          const match = row.hard === infeasibility[index] && row.soft === objective[index];
          if (match) matched++;
          lines.push([name, row.solution, row.hard, infeasibility[index], row.soft, objective[index], match ? "да" : "нет"].join(","));
          console.log(
            `${name.padEnd(20)} ${row.solution.padEnd(10)} жёсткие: наши ${String(row.hard).padStart(3)}, HSEval ${String(infeasibility[index]).padStart(3)}` +
              ` | мягкая: наша ${String(row.soft).padStart(6)}, HSEval ${String(objective[index]).padStart(6)} ${match ? "совпало" : "РАСХОЖДЕНИЕ"}`,
          );
        });
      }
      writeFileSync(Workspace.path("experiments/hseval-hundred.csv"), lines.join("\n") + "\n");
      console.log(`совпало ${matched} из ${total}`);
    }
  }
}

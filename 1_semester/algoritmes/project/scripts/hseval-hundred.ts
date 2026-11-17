import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Annealing } from "../src/annealing.ts";
import { Dsatur } from "../src/dsatur.ts";
import { Generator } from "../src/generator.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { Timetable } from "../src/timetable.ts";
import { XHSTT_EXPORT_WEIGHTS, XhsttExport } from "../src/xhstt-export.ts";

const file = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const mode = process.argv[2];
const dir = process.argv[3];
if (!dir || (mode !== "generate" && mode !== "compare")) throw new Error("usage: hseval-hundred.ts generate|compare <folder for xml files>");
const manifest = join(dir, "ours.json");

if (mode === "generate") {
  const subjects = Loader.subjects(file("instances/subjects.json"));
  const curriculum = Loader.curriculum(file("instances/curriculum.json"), subjects);
  mkdirSync(dir, { recursive: true });
  const ours: Record<string, { solution: string; hard: number; soft: number }[]> = {};
  for (const shifts of [1, 2] as const) {
    for (const seed of [1, 2, 3]) {
      const name = `large-100-${shifts}shift-${seed}`;
      const { instance } = Generator.generate(
        { name, seed: 1000 + seed, classes: 100, shifts, largeClassShare: 0.5, teacherMaxLoad: 24, unavailableShare: 0.3 },
        subjects,
        curriculum,
      );
      const problem = Problem.from(instance);
      const start = Dsatur.solve(problem, { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" }).slotOf;
      const solutions = [
        { description: "DSATUR", slotOf: start },
        { description: "annealing", slotOf: Annealing.run(problem, start, { seed: 1 }).slotOf },
      ];
      const xml = XhsttExport.archive(instance, solutions);
      writeFileSync(join(dir, `${name}.xml`), xml);
      ours[name] = solutions.map((solution) => {
        const table = Timetable.from(problem, solution.slotOf, XHSTT_EXPORT_WEIGHTS);
        return { solution: solution.description, hard: table.hard, soft: table.cost - table.weights.hard * table.hard };
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
    const infeasibility = [...text.matchAll(/<InfeasibilityValue>([^<]*)<\/InfeasibilityValue>/g)].map((m) => Number(m[1]));
    const objective = [...text.matchAll(/<ObjectiveValue>([^<]*)<\/ObjectiveValue>/g)].map((m) => Number(m[1]));
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
  writeFileSync(file("experiments/hseval-hundred.csv"), lines.join("\n") + "\n");
  console.log(`совпало ${matched} из ${total}`);
}

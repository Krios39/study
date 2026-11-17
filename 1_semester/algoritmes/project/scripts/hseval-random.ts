import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Annealing } from "../src/annealing.ts";
import { Dsatur } from "../src/dsatur.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { RandomGenerator, type RandomParams } from "../src/random-generator.ts";
import { Timetable } from "../src/timetable.ts";
import { XhsttEvaluator } from "../src/xhstt-eval.ts";
import { XHSTT_EXPORT_WEIGHTS, XhsttExport } from "../src/xhstt-export.ts";
import { Xhstt } from "../src/xhstt.ts";

const file = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const mode = process.argv[2] ?? "generate";
const exportDir = "instances/xhstt-export/random";
const responseDir = "experiments/hseval/random";
const manifestPath = file("experiments/hseval-random-ours.csv");

if (mode === "generate") {
  const groups: { name: string; count: number; params: (seed: number) => RandomParams }[] = [
    { name: "small", count: 15, params: (seed) => ({ seed, size: "small" }) },
    { name: "medium", count: 15, params: (seed) => ({ seed, size: "medium" }) },
    { name: "medium-heavy", count: 10, params: (seed) => ({ seed, size: "medium", shifts: 1, loadRange: [28, 28], unavailableShare: 0 }) },
    { name: "large", count: 10, params: (seed) => ({ seed, size: "large" }) },
  ];
  const subjects = Loader.subjects(file("instances/subjects.json"));
  const curriculum = Loader.curriculum(file("instances/curriculum.json"), subjects);
  mkdirSync(file(exportDir), { recursive: true });
  const lines = ["school,group,classes,teachers,shifts,lessons,solution,ourHard,specInfeasibility,ourSoft,specObjective,ourFullSoft"];
  for (const group of groups) {
    let taken = 0;
    for (let seed = 101; taken < group.count; seed++) {
      const name = `${group.name}-${seed}`;
      const { instance, meta } = RandomGenerator.generate({ ...group.params(seed), name }, subjects, curriculum);
      if (meta.provablyInfeasible.length > 0) continue;
      taken++;
      const problem = Problem.from(instance);
      const start = Dsatur.solve(problem, { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" }).slotOf;
      const solutions = [
        { description: "DSATUR", slotOf: start },
        { description: "annealing", slotOf: Annealing.run(problem, start, { seed: 1 }).slotOf },
      ];
      const xml = XhsttExport.archive(instance, solutions);
      writeFileSync(file(`${exportDir}/${name}.xml`), xml);
      const document = Xhstt.parseXml(xml);
      const node = Xhstt.instanceNodes(document)[0];
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
            exported.cost - exported.weights.hard * exported.hard,
            spec.objective,
            (full.cost - full.weights.hard * full.hard).toFixed(1),
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
    const path = file(`${responseDir}/${school}.xml`);
    const text = existsSync(path) ? readFileSync(path, "utf8") : "";
    const infeasibility = [...text.matchAll(/<InfeasibilityValue>([^<]*)<\/InfeasibilityValue>/g)].map((m) => Number(m[1]));
    const objective = [...text.matchAll(/<ObjectiveValue>([^<]*)<\/ObjectiveValue>/g)].map((m) => Number(m[1]));
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
  writeFileSync(file("experiments/hseval-random.csv"), out.join("\n") + "\n");
  console.log(`школ с ответом ${bySchool.size - missing.length} из ${bySchool.size}, расписаний ${total}`);
  console.log(`мягкая цена совпала с HSEval: ${soft} из ${total}`);
  console.log(`недопустимость: с подсчётом по спецификации совпала ${spec} из ${total}, с нашим определением ${own} из ${total}`);
  if (missing.length > 0) console.log(`нет ответа: ${missing.join(", ")}`);
  for (const line of mismatches) console.log(`расхождение: ${line}`);
}

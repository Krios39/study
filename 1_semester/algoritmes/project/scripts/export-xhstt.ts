import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Dsatur } from "../src/dsatur.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { Timetable } from "../src/timetable.ts";
import { XhsttEvaluator } from "../src/xhstt-eval.ts";
import { XHSTT_EXPORT_WEIGHTS, XhsttExport, type XhsttSolution } from "../src/xhstt-export.ts";
import { Xhstt } from "../src/xhstt.ts";

const file = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const names = (process.argv[2] ?? "mini,small-7,small-10,medium-20,medium-30,large-60,heavy-1,heavy-2,heavy-4").split(",");

mkdirSync(file("instances/xhstt-export"), { recursive: true });
const lines = ["instance,solution,ourHard,xhsttInfeasibility,ourExportedSoft,xhsttObjective,match,ourFullSoft"];
for (const name of names) {
  const instance = Loader.instance(file(`instances/${name}.json`));
  const problem = Problem.from(instance);
  const solutions: XhsttSolution[] = [
    { description: "DSATUR classic", slotOf: Dsatur.solve(problem).slotOf },
    { description: "DSATUR", slotOf: Dsatur.solve(problem, { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" }).slotOf },
  ];
  const annealed = file(`instances/${name}.annealed.json`);
  if (existsSync(annealed)) {
    solutions.push({ description: "annealing", slotOf: Int32Array.from(JSON.parse(readFileSync(annealed, "utf8")).slotOf) });
  }
  const xml = XhsttExport.archive(instance, solutions);
  writeFileSync(file(`instances/xhstt-export/${name}.xml`), xml);

  const archive = Xhstt.parseXml(xml).children[0];
  const instanceNode = Xhstt.instanceNodes(Xhstt.parseXml(xml))[0];
  const solutionNodes = archive.children.find((c) => c.name === "SolutionGroups")!.children[0].children.filter((c) => c.name === "Solution");
  solutions.forEach((solution, index) => {
    const exported = Timetable.from(problem, solution.slotOf, XHSTT_EXPORT_WEIGHTS);
    const full = Timetable.from(problem, solution.slotOf);
    const cost = XhsttEvaluator.evaluate(instanceNode, solutionNodes[index]);
    const ourSoft = exported.cost - exported.weights.hard * exported.hard;
    const fullSoft = full.cost - full.weights.hard * full.hard;
    const match = cost.objective === ourSoft && (exported.hard === 0) === (cost.infeasibility === 0);
    lines.push([name, solution.description, exported.hard, cost.infeasibility, ourSoft, cost.objective, match ? "да" : "нет", fullSoft.toFixed(1)].join(","));
    console.log(
      `${name.padEnd(10)} ${solution.description.padEnd(15)} жёсткие: наши ${String(exported.hard).padStart(3)}, XHSTT ${String(cost.infeasibility).padStart(3)}` +
        ` | мягкая (выгружаемая часть): наша ${String(ourSoft).padStart(6)}, XHSTT ${String(cost.objective).padStart(6)} ${match ? "совпало" : "РАСХОЖДЕНИЕ"}` +
        ` | полная мягкая ${fullSoft.toFixed(0)} | файл ${(xml.length / 1024).toFixed(0)} КБ`,
    );
  });
}
writeFileSync(file("experiments/xhstt-export.csv"), lines.join("\n") + "\n");

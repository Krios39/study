import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Annealing } from "../src/annealing.ts";
import { Dsatur } from "../src/dsatur.ts";
import { Generator } from "../src/generator.ts";
import { hardViolations } from "../src/hard.ts";
import { Ilp } from "../src/ilp.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { Timetable } from "../src/timetable.ts";
import { XhsttEvaluator } from "../src/xhstt-eval.ts";
import { XHSTT_EXPORT_WEIGHTS, XhsttExport } from "../src/xhstt-export.ts";
import { Xhstt } from "../src/xhstt.ts";

const file = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const subjects = Loader.subjects(file("instances/subjects.json"));
const curriculum = Loader.curriculum(file("instances/curriculum.json"), subjects);
const budgets = [10, 30, 100, 300, 1000];
const lines = ["school,shifts,seed,classes,teachers,lessons,edges,meanLoad,exact,exactSeconds,dsaturHard,dsaturSeconds,movesPerLesson,annealingHard,annealingSeconds,softPer100,lessonsInViolationPct,specInfeasibility,specMatch"];

for (const shifts of [1, 2] as const) {
  for (const seed of [1, 2, 3]) {
    const name = `large-100-${shifts}shift-${seed}`;
    const { instance, hidden } = Generator.generate(
      { name, seed: 1000 + seed, classes: 100, shifts, largeClassShare: 0.5, teacherMaxLoad: 24, unavailableShare: 0.3 },
      subjects,
      curriculum,
    );
    Loader.validateInstance(instance);
    const problem = Problem.from(instance);
    if (hardViolations(problem, Int32Array.from(hidden)).total !== 0) throw new Error(`${name}: hidden timetable is not feasible`);
    if (seed === 1) writeFileSync(file(`instances/${name}.json`), JSON.stringify(instance) + "\n");

    const loads = new Map<string, number>();
    for (const r of instance.requirements) for (const t of r.teachers) loads.set(t, (loads.get(t) ?? 0) + r.hours);
    const meanLoad = [...loads.values()].reduce((a, b) => a + b, 0) / loads.size;

    const exact = await Ilp.solve(problem, { hardOnly: true, timeLimit: 60 });
    let started = performance.now();
    const start = Dsatur.solve(problem, { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" }).slotOf;
    const dsaturSeconds = (performance.now() - started) / 1000;
    const dsaturHard = Timetable.from(problem, start).hard;
    console.log(
      `\n${name}: классов ${instance.classes.length}, учителей ${instance.teachers.length}, уроков ${problem.nLessons}, рёбер ${problem.adjList.length / 2}, средняя нагрузка ${meanLoad.toFixed(1)}` +
        ` | решатель: ${exact.slotOf ? "расписание есть" : exact.status} за ${exact.seconds.toFixed(1)} с | DSATUR: жёстких ${dsaturHard} за ${dsaturSeconds.toFixed(2)} с`,
    );

    for (const perLesson of budgets) {
      started = performance.now();
      const result = Annealing.run(problem, start, { seed: 1, iterations: problem.nLessons * perLesson });
      const seconds = (performance.now() - started) / 1000;
      const table = Timetable.from(problem, result.slotOf);
      const soft = (100 * (table.cost - table.weights.hard * table.hard)) / problem.nLessons;
      const bad = (100 * Math.min(problem.nLessons, table.hard)) / problem.nLessons;

      const xml = XhsttExport.archive(instance, [{ description: "annealing", slotOf: result.slotOf }]);
      const document = Xhstt.parseXml(xml);
      const solution = document.children[0].children.find((c) => c.name === "SolutionGroups")!.children[0].children.find((c) => c.name === "Solution")!;
      const spec = XhsttEvaluator.evaluate(Xhstt.instanceNodes(document)[0], solution);
      const exported = Timetable.from(problem, result.slotOf, XHSTT_EXPORT_WEIGHTS);
      const match = spec.objective === exported.cost - exported.weights.hard * exported.hard && (spec.infeasibility === 0) === (table.hard === 0);

      console.log(
        `  ${String(perLesson).padStart(4)} ходов на урок: ${seconds.toFixed(1).padStart(6)} с | жёстких ${String(table.hard).padStart(3)} | мягкая цена на 100 уроков ${soft.toFixed(1).padStart(7)}` +
          ` | по спецификации XHSTT: недопустимость ${spec.infeasibility}, ${match ? "совпало" : "РАСХОЖДЕНИЕ"}`,
      );
      lines.push(
        [name, shifts, seed, instance.classes.length, instance.teachers.length, problem.nLessons, problem.adjList.length / 2, meanLoad.toFixed(1), exact.slotOf ? "есть" : exact.status, exact.seconds.toFixed(1), dsaturHard, dsaturSeconds.toFixed(2), perLesson, table.hard, seconds.toFixed(1), soft.toFixed(1), bad.toFixed(2), spec.infeasibility, match ? "да" : "нет"].join(","),
      );
    }
  }
}
writeFileSync(file("experiments/hundred.csv"), lines.join("\n") + "\n");

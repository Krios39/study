import { writeFileSync } from "node:fs";
import { Annealing } from "../../../src/solvers/annealing.ts";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { PlantedGenerator } from "../../../src/generators/planted-generator.ts";
import { Ilp } from "../../../src/solvers/exact.ts";
import { Loader } from "../../../src/io/loader.ts";
import { Problem } from "../../../src/core/problem.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { XhsttEvaluator } from "../../../src/io/xhstt-evaluator.ts";
import { XHSTT_EXPORT_WEIGHTS, XhsttWriter } from "../../../src/io/xhstt-writer.ts";
import { XhsttReader } from "../../../src/io/xhstt-reader.ts";
import { Xml } from "../../../src/io/xml.ts";
import { Workspace } from "../workspace.ts";
import { Command } from "../command.ts";

export class HundredCommand extends Command {
  readonly name = "hundred";
  readonly summary = "Test the solvers on schools with 100 classes";

  async run() {
    const { subjects, curriculum } = Workspace.dictionaries();
    const budgets = [10, 30, 100, 300, 1000];
    const lines = ["school,shifts,seed,classes,teachers,lessons,edges,meanLoad,exact,exactSeconds,dsaturHard,dsaturSeconds,movesPerLesson,annealingHard,annealingSeconds,softPer100,lessonsInViolationPct,specInfeasibility,specMatch"];

    for (const shifts of [1, 2] as const) {
      for (const seed of [1, 2, 3]) {
        const name = `large-100-${shifts}shift-${seed}`;
        const { instance, hidden } = new PlantedGenerator(subjects, curriculum).generate({ name, seed: 1000 + seed, classes: 100, shifts, largeClassShare: 0.5, teacherMaxLoad: 24, unavailableShare: 0.3 });
        Loader.validateInstance(instance);
        const problem = Problem.from(instance);
        if (Timetable.from(problem, Int32Array.from(hidden)).violations().total !== 0) throw new Error(`${name}: hidden timetable is not feasible`);
        if (seed === 1) writeFileSync(Workspace.path(`instances/${name}.json`), JSON.stringify(instance) + "\n");

        const loads = new Map<string, number>();
        for (const r of instance.requirements) for (const t of r.teachers) loads.set(t, (loads.get(t) ?? 0) + r.hours);
        const meanLoad = [...loads.values()].reduce((a, b) => a + b, 0) / loads.size;

        const exact = await Ilp.solve(problem, { hardOnly: true, timeLimit: 60 });
        let started = performance.now();
        const start = Dsatur.recommended().solve(problem).slotOf;
        const dsaturSeconds = (performance.now() - started) / 1000;
        const dsaturHard = Timetable.from(problem, start).hard;
        console.log(
          `\n${name}: классов ${instance.classes.length}, учителей ${instance.teachers.length}, уроков ${problem.nLessons}, рёбер ${problem.adjList.length / 2}, средняя нагрузка ${meanLoad.toFixed(1)}` +
            ` | решатель: ${exact.slotOf ? "расписание есть" : exact.status} за ${exact.seconds.toFixed(1)} с | DSATUR: жёстких ${dsaturHard} за ${dsaturSeconds.toFixed(2)} с`,
        );

        for (const perLesson of budgets) {
          started = performance.now();
          const result = new Annealing({ seed: 1, evaluations: problem.nLessons * perLesson }).solve(problem, start);
          const seconds = (performance.now() - started) / 1000;
          const table = Timetable.from(problem, result.slotOf);
          const soft = (100 * (table.softCost)) / problem.nLessons;
          const bad = (100 * Math.min(problem.nLessons, table.hard)) / problem.nLessons;

          const xml = XhsttWriter.archive(instance, [{ description: "annealing", slotOf: result.slotOf }]);
          const document = Xml.parse(xml);
          const solution = XhsttReader.solutionNodes(document)[0];
          const spec = XhsttEvaluator.evaluate(XhsttReader.instanceNodes(document)[0], solution);
          const exported = Timetable.from(problem, result.slotOf, XHSTT_EXPORT_WEIGHTS);
          const match = spec.objective === exported.softCost && (spec.infeasibility === 0) === (table.hard === 0);

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
    writeFileSync(Workspace.path("experiments/hundred.csv"), lines.join("\n") + "\n");
  }
}

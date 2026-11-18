import type { Evaluation } from "../../../src/core/cost.ts";
import { Loader } from "../../../src/io/loader.ts";
import { Annealing } from "../../../src/solvers/annealing.ts";
import { Tabu } from "../../../src/solvers/tabu.ts";
import { Timetabler } from "../../../src/timetabler.ts";
import type { Args } from "../args.ts";
import { Command } from "../command.ts";
import { Workspace } from "../workspace.ts";

export class SolveCommand extends Command {
  readonly name = "solve";
  readonly summary = "Build a timetable for one school: DSATUR, then local search";

  run(args: Args) {
    const source = args.positional[0];
    if (!source) throw new Error("usage: solve <school name or path to json> [--improver annealing|tabu|none] [--seed 1] [--per-lesson 1000] [--out file.json|file.xml]");
    const instance = source.endsWith(".json") ? Loader.instance(source) : Workspace.instance(source);
    const lessons = instance.requirements.reduce((sum, r) => sum + r.hours, 0);
    const search = { seed: args.number("seed", 1), evaluations: lessons * args.number("per-lesson", 1000) };
    const kind = args.text("improver", "annealing");
    const improver = kind === "none" ? null : kind === "tabu" ? new Tabu({ ...search, candidates: 100, tenure: 2 }) : new Annealing(search);
    const schedule = new Timetabler({ improver }).run(instance);

    const show = (label: string, evaluation: Evaluation, seconds: number) => {
      console.log(`${label.padEnd(20)} ${seconds.toFixed(2).padStart(7)} с | жёстких ${evaluation.hard.total} | мягкая цена ${evaluation.softCost.toFixed(1)}`);
    };
    console.log(`${instance.name}: классов ${instance.classes.length}, учителей ${instance.teachers.length}, уроков ${lessons}`);
    show("DSATUR", schedule.startEvaluation, schedule.constructiveSeconds);
    if (improver) show(improver.name, schedule.evaluation, schedule.improvementSeconds);
    console.log(JSON.stringify({ hard: schedule.evaluation.hard, soft: schedule.evaluation.soft }));

    const out = args.get("out");
    if (out) {
      schedule.save(out);
      console.log(`расписание сохранено: ${out}`);
    }
  }
}

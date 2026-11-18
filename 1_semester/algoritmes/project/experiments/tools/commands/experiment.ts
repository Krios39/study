import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { Annealing } from "../../../src/solvers/annealing.ts";
import type { KempeStats } from "../../../src/solvers/moves.ts";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { Workspace } from "../workspace.ts";
import type { Args } from "../args.ts";
import { Csv } from "../report.ts";
import { SchoolSets } from "../schools.ts";
import { Command } from "../command.ts";

export class ExperimentCommand extends Command {
  readonly name = "experiment";
  readonly summary = "Run annealing on the stress set with given parameters";

  async run(args: Args) {
    const id = args.get("id");
    if (!id) throw new Error("--id is required");
    const config = {
      startTemperature: Number(args.get("t0") ?? 20),
      endTemperature: Number(args.get("t1") ?? 1),
      movesPerLesson: Number(args.get("per-lesson") ?? 1000),
      swapShare: Number(args.get("swap") ?? 0.5),
      kempeShare: Number(args.get("kempe") ?? 0.5),
      kempeMaxLength: Number(args.get("kempe-max") ?? 0),
    };
    const out = args.get("out") ?? "summary.csv";
    const searchWeights: Record<string, number> = {};
    for (const pair of (args.get("weights") ?? "").split(",").filter((p) => p.length > 0)) {
      const [key, value] = pair.split("=");
      searchWeights[key] = Number(value);
    }
    const note = args.get("note") ?? "";

    const GROUPS = SchoolSets.stress;

    const describe = (timetable: Timetable) => {
      const soft = timetable.soft();
      const hard = timetable.hard;
      return {
        hard,
        cost: timetable.cost,
        softCost: timetable.cost - timetable.weights.hard * hard,
        difficultySpread: soft.difficultySpread,
        sameSubjectInDay: soft.sameSubjectInDay,
        teacherGaps: soft.teacherGaps,
        worstTeacherGaps: soft.worstTeacherGaps,
        shiftBreaks: soft.shiftBreaks,
        shiftIdle: soft.shiftIdle,
        misplaced: soft.misplaced,
        wishesBroken: soft.wishesBroken,
        dayImbalance: soft.dayImbalance,
      };
    };

    mkdirSync(Workspace.path("experiments/raw"), { recursive: true });
    const rawPath = Workspace.path(`experiments/raw/${id}.jsonl`);
    writeFileSync(rawPath, "");

    type Row = { group: string; lessons: number; seconds: number; kempe: KempeStats; dsatur: ReturnType<typeof describe>; annealed: ReturnType<typeof describe> };
    const rows: Row[] = [];
    for await (const { group, seed, instance, meta, problem } of SchoolSets.schools(GROUPS)) {
        const slotOf = Dsatur.recommended().solve(problem).slotOf;
      const started = performance.now();
      const result = new Annealing({
        seed: Number(args.get("sa-seed") ?? 1),
        evaluations: problem.nLessons * config.movesPerLesson,
        startTemperature: config.startTemperature,
        endTemperature: config.endTemperature,
        swapShare: config.swapShare,
        kempeShare: config.kempeShare,
        kempeMaxLength: config.kempeMaxLength > 0 ? config.kempeMaxLength : undefined,
        weights: searchWeights,
      }).solve(problem, slotOf);
      const seconds = (performance.now() - started) / 1000;
      const row: Row = {
        group,
        lessons: problem.nLessons,
        seconds,
        kempe: result.kempe,
        dsatur: describe(Timetable.from(problem, slotOf)),
        annealed: describe(Timetable.from(problem, result.slotOf)),
      };
      rows.push(row);
      appendFileSync(
        rawPath,
        JSON.stringify({
          id,
          ...config,
          group,
          seed,
          classes: instance.classes.length,
          teachers: instance.teachers.length,
          shifts: meta.shifts,
          lessons: problem.nLessons,
          evaluations: result.evaluations,
          accepted: result.accepted,
          worsening: result.worsening,
          seconds: Number(seconds.toFixed(2)),
          kempe: result.kempe,
          dsatur: row.dsatur,
          annealed: row.annealed,
        }) + "\n",
      );
    }

    const mean = (items: Row[], pick: (row: Row) => number) =>
      items.length ? items.reduce((sum, row) => sum + pick(row), 0) / items.length : 0;
    const share = (items: Row[], test: (row: Row) => boolean) =>
      items.length ? Math.round((100 * items.filter(test).length) / items.length) : 0;
    const per100 = (items: Row[], pick: (row: Row) => number) => mean(items, (row) => (100 * pick(row)) / row.lessons);

    const summary: Record<string, string | number> = {
      id,
      t0: config.startTemperature,
      t1: config.endTemperature,
      movesPerLesson: config.movesPerLesson,
      swapShare: config.swapShare,
      schools: rows.length,
      solvedDsaturPct: share(rows, (row) => row.dsatur.hard === 0),
      solvedPct: share(rows, (row) => row.annealed.hard === 0),
      hardMean: Number(mean(rows, (row) => row.annealed.hard).toFixed(2)),
      softPer100: Number(per100(rows, (row) => row.annealed.softCost).toFixed(1)),
    };
    for (const group of GROUPS) {
      const items = rows.filter((row) => row.group === group.name);
      summary[`${group.name}:solvedPct`] = share(items, (row) => row.annealed.hard === 0);
      summary[`${group.name}:softPer100`] = Number(per100(items, (row) => row.annealed.softCost).toFixed(1));
    }
    const parts: [string, (row: Row) => number][] = [
      ["difficultyPer100", (row) => row.annealed.difficultySpread],
      ["repeatsPer100", (row) => row.annealed.sameSubjectInDay],
      ["teacherGapsPer100", (row) => row.annealed.teacherGaps],
      ["shiftBreaksPer100", (row) => row.annealed.shiftBreaks],
      ["shiftIdlePer100", (row) => row.annealed.shiftIdle],
      ["misplacedPer100", (row) => row.annealed.misplaced],
      ["wishesBrokenPer100", (row) => row.annealed.wishesBroken],
      ["dayImbalancePer100", (row) => row.annealed.dayImbalance],
    ];
    for (const [name, pick] of parts) summary[name] = Number(per100(rows, pick).toFixed(2));
    summary.worstTeacherGapsMax = Math.max(...rows.map((row) => row.annealed.worstTeacherGaps));
    if (out !== "summary.csv") {
      const total = (pick: (stats: KempeStats) => number) => rows.reduce((sum, row) => sum + pick(row.kempe), 0);
      const tried = total((k) => k.tried);
      const accepted = total((k) => k.accepted);
      summary.kempeShare = config.kempeShare;
      summary.kempeMaxLength = config.kempeMaxLength;
      summary.chainMean = tried ? Number((total((k) => k.lengthSum) / tried).toFixed(2)) : 0;
      summary.chainLongest = Math.max(...rows.map((row) => row.kempe.longest));
      summary.chainAcceptedMean = accepted ? Number((total((k) => k.acceptedLengthSum) / accepted).toFixed(2)) : 0;
      summary.kempeAcceptPct = tried ? Number(((100 * accepted) / tried).toFixed(1)) : 0;
      summary.kempeTooLongPct = tried ? Number(((100 * total((k) => k.tooLong)) / tried).toFixed(1)) : 0;
    }
    summary.seconds = Number(rows.reduce((sum, row) => sum + row.seconds, 0).toFixed(1));
    summary.note = note;

    const summaryPath = Workspace.path(`experiments/${out}`);
    Csv.append(summaryPath, summary);

    console.log(
      [
        id.padEnd(22),
        `решено ${summary.solvedPct}% (DSATUR ${summary.solvedDsaturPct}%)`,
        `жёстких ${summary.hardMean}`,
        `мягкая цена на 100 уроков ${summary.softPer100}`,
        GROUPS.map((g) => `${g.name} ${summary[`${g.name}:softPer100`]}`).join(", "),
        `${summary.seconds} с`,
      ].join(" | "),
    );
  }
}

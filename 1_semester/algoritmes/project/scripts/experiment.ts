import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Annealing, type KempeSlots, type KempeStats } from "../src/annealing.ts";
import { Dsatur } from "../src/dsatur.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { RandomGenerator, type RandomParams } from "../src/random-generator.ts";
import { Timetable } from "../src/timetable.ts";

const file = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, "");
  const value = process.argv[i + 1];
  if (value === undefined || value.startsWith("--")) args.set(key, "true");
  else args.set(key, process.argv[++i]);
}
const id = args.get("id");
if (!id) throw new Error("--id is required");
const config = {
  startTemperature: Number(args.get("t0") ?? 20),
  endTemperature: Number(args.get("t1") ?? 1),
  movesPerLesson: Number(args.get("per-lesson") ?? 1000),
  swapShare: Number(args.get("swap") ?? 0.5),
  kempeShare: Number(args.get("kempe") ?? 0.5),
  kempeSlots: (args.get("kempe-slots") ?? "any") as KempeSlots,
  kempeMaxLength: Number(args.get("kempe-max") ?? 0),
};
const out = args.get("out") ?? "summary.csv";
const searchWeights: Record<string, number> = {};
for (const pair of (args.get("weights") ?? "").split(",").filter((p) => p.length > 0)) {
  const [key, value] = pair.split("=");
  searchWeights[key] = Number(value);
}
const note = args.get("note") ?? "";

const GROUPS: { name: string; count: number; params: (seed: number) => RandomParams }[] = [
  { name: "small", count: 8, params: (seed) => ({ seed, size: "small" }) },
  { name: "medium", count: 8, params: (seed) => ({ seed, size: "medium" }) },
  {
    name: "medium-heavy",
    count: 8,
    params: (seed) => ({ seed, size: "medium", shifts: 1, loadRange: [24, 24], unavailableShare: 0 }),
  },
  { name: "large", count: 6, params: (seed) => ({ seed, size: "large" }) },
];

const subjects = Loader.subjects(file("instances/subjects.json"));
const curriculum = Loader.curriculum(file("instances/curriculum.json"), subjects);
const start = { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" } as const;

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

mkdirSync(file("experiments/raw"), { recursive: true });
const rawPath = file(`experiments/raw/${id}.jsonl`);
writeFileSync(rawPath, "");

type Row = { group: string; lessons: number; seconds: number; kempe: KempeStats; dsatur: ReturnType<typeof describe>; annealed: ReturnType<typeof describe> };
const rows: Row[] = [];
for (const group of GROUPS) {
  let taken = 0;
  for (let seed = 1; taken < group.count; seed++) {
    const { instance, meta } = RandomGenerator.generate(group.params(seed), subjects, curriculum);
    if (meta.provablyInfeasible.length > 0) continue;
    taken++;
    const problem = Problem.from(instance);
    const slotOf = Dsatur.solve(problem, start).slotOf;
    const started = performance.now();
    const result = Annealing.run(problem, slotOf, {
      seed: Number(args.get("sa-seed") ?? 1),
      iterations: problem.nLessons * config.movesPerLesson,
      startTemperature: config.startTemperature,
      endTemperature: config.endTemperature,
      swapShare: config.swapShare,
      kempeShare: config.kempeShare,
      kempeSlots: config.kempeSlots,
      kempeMaxLength: config.kempeMaxLength > 0 ? config.kempeMaxLength : undefined,
      weights: searchWeights,
      focusShare: Number(args.get("focus") ?? 0),
      focusSize: Number(args.get("focus-size") ?? 2),
    });
    const seconds = (performance.now() - started) / 1000;
    const row: Row = {
      group: group.name,
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
        group: group.name,
        seed,
        classes: instance.classes.length,
        teachers: instance.teachers.length,
        shifts: meta.shifts,
        lessons: problem.nLessons,
        iterations: result.iterations,
        accepted: result.accepted,
        worsening: result.worsening,
        seconds: Number(seconds.toFixed(2)),
        kempe: result.kempe,
        dsatur: row.dsatur,
        annealed: row.annealed,
      }) + "\n",
    );
  }
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
  summary.kempeSlots = config.kempeSlots;
  summary.kempeMaxLength = config.kempeMaxLength;
  summary.chainMean = tried ? Number((total((k) => k.lengthSum) / tried).toFixed(2)) : 0;
  summary.chainLongest = Math.max(...rows.map((row) => row.kempe.longest));
  summary.chainAcceptedMean = accepted ? Number((total((k) => k.acceptedLengthSum) / accepted).toFixed(2)) : 0;
  summary.kempeAcceptPct = tried ? Number(((100 * accepted) / tried).toFixed(1)) : 0;
  summary.kempeTooLongPct = tried ? Number(((100 * total((k) => k.tooLong)) / tried).toFixed(1)) : 0;
}
summary.seconds = Number(rows.reduce((sum, row) => sum + row.seconds, 0).toFixed(1));
summary.note = note;

const summaryPath = file(`experiments/${out}`);
const csv = (values: (string | number)[]) =>
  values.map((v) => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v))).join(",");
if (!existsSync(summaryPath)) writeFileSync(summaryPath, csv(Object.keys(summary)) + "\n");
else if (readFileSync(summaryPath, "utf8").split(/\r?\n/)[0] !== csv(Object.keys(summary)))
  throw new Error(`${out} has different columns, pass another --out`);
appendFileSync(summaryPath, csv(Object.values(summary)) + "\n");

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

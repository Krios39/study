import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Annealing } from "../src/annealing.ts";
import { Dsatur } from "../src/dsatur.ts";
import { Ilp } from "../src/ilp.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { RandomGenerator, type RandomParams } from "../src/random-generator.ts";
import { Tabu } from "../src/tabu.ts";
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
const set = args.get("set") ?? "stress";
const algo = args.get("algo") ?? "annealing";
const perLesson = Number(args.get("per-lesson") ?? 1000);
const candidates = Number(args.get("candidates") ?? 20);
const tenure = Number(args.get("tenure") ?? 10);
const seed = Number(args.get("seed") ?? 1);
const note = args.get("note") ?? "";

const subjects = Loader.subjects(file("instances/subjects.json"));
const curriculum = Loader.curriculum(file("instances/curriculum.json"), subjects);
const startOptions = { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" } as const;

type Group = { name: string; count: number; params: (seed: number) => RandomParams; confirm?: boolean };
const heavy = (load: number): Group => ({
  name: `нагрузка ${load}`,
  count: 8,
  params: (s) => ({ seed: s, size: "medium", shifts: 1, loadRange: [load, load], unavailableShare: 0 }),
  confirm: true,
});
const SETS: Record<string, Group[]> = {
  stress: [
    { name: "small", count: 8, params: (s) => ({ seed: s, size: "small" }) },
    { name: "medium", count: 8, params: (s) => ({ seed: s, size: "medium" }) },
    { name: "medium-heavy", count: 8, params: (s) => ({ seed: s, size: "medium", shifts: 1, loadRange: [24, 24], unavailableShare: 0 }) },
    { name: "large", count: 6, params: (s) => ({ seed: s, size: "large" }) },
  ],
  hard: [26, 28, 30, 32, 34, 36, 38, 40].map(heavy),
};
const groups = SETS[set];
if (!groups) throw new Error(`unknown set "${set}"`);

mkdirSync(file("experiments/raw"), { recursive: true });
const rawPath = file(`experiments/raw/${id}.jsonl`);
writeFileSync(rawPath, "");

const rows: { group: string; lessons: number; seconds: number; hard: number; soft: number; dsaturHard: number }[] = [];
for (const group of groups) {
  let taken = 0;
  for (let s = 1; taken < group.count && s < 500; s++) {
    const { instance, meta } = RandomGenerator.generate(group.params(s), subjects, curriculum);
    if (meta.provablyInfeasible.length > 0) continue;
    const problem = Problem.from(instance);
    if (group.confirm && !(await Ilp.solve(problem, { hardOnly: true, timeLimit: 20 })).slotOf) continue;
    taken++;
    const slotOf = Dsatur.solve(problem, startOptions).slotOf;
    const budget = problem.nLessons * perLesson;
    const started = performance.now();
    const result =
      algo === "tabu"
        ? Tabu.run(problem, slotOf, { seed, evaluations: budget, candidates, tenure })
        : Annealing.run(problem, slotOf, { seed, iterations: budget });
    const seconds = (performance.now() - started) / 1000;
    const table = Timetable.from(problem, result.slotOf);
    const softStats = table.soft();
    const row = {
      group: group.name,
      lessons: problem.nLessons,
      seconds,
      hard: table.hard,
      soft: (100 * (table.cost - table.weights.hard * table.hard)) / problem.nLessons,
      dsaturHard: Timetable.from(problem, slotOf).hard,
    };
    rows.push(row);
    appendFileSync(
      rawPath,
      JSON.stringify({
        id,
        set,
        algo,
        perLesson,
        candidates: algo === "tabu" ? candidates : "",
        tenure: algo === "tabu" ? tenure : "",
        group: group.name,
        schoolSeed: s,
        classes: instance.classes.length,
        teachers: instance.teachers.length,
        lessons: problem.nLessons,
        maxLoadShare: Number(meta.maxLoadShare.toFixed(2)),
        seconds: Number(seconds.toFixed(2)),
        dsaturHard: row.dsaturHard,
        hard: row.hard,
        softPer100: Number(row.soft.toFixed(1)),
        soft: softStats,
      }) + "\n",
    );
  }
}

const sorted = rows.map((row) => row.soft).sort((a, b) => a - b);
const median = (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2;
const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
const summary: Record<string, string | number> = {
  id,
  set,
  algo,
  perLesson,
  candidates: algo === "tabu" ? candidates : "",
  tenure: algo === "tabu" ? tenure : "",
  seed,
  schools: rows.length,
  solvedDsatur: rows.filter((row) => row.dsaturHard === 0).length,
  solved: rows.filter((row) => row.hard === 0).length,
  hardMean: Number((rows.reduce((a, row) => a + row.hard, 0) / rows.length).toFixed(2)),
  softMean: Number(mean.toFixed(1)),
  softMedian: Number(median.toFixed(1)),
  seconds: Number(rows.reduce((a, row) => a + row.seconds, 0).toFixed(1)),
  note,
};
for (const group of groups) {
  const items = rows.filter((row) => row.group === group.name);
  summary[`${group.name}:solved`] = items.filter((row) => row.hard === 0).length;
  summary[`${group.name}:soft`] = Number((items.reduce((a, row) => a + row.soft, 0) / Math.max(1, items.length)).toFixed(1));
}
const summaryPath = file(`experiments/compare-${set}.csv`);
const csv = (values: (string | number)[]) =>
  values.map((v) => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v))).join(",");
if (!existsSync(summaryPath)) writeFileSync(summaryPath, csv(Object.keys(summary)) + "\n");
appendFileSync(summaryPath, csv(Object.values(summary)) + "\n");
console.log(
  `${id.padEnd(26)} ${set} | без нарушений ${summary.solved} из ${summary.schools} (DSATUR ${summary.solvedDsatur}) | жёстких в среднем ${summary.hardMean}` +
    ` | мягкая цена: среднее ${summary.softMean}, медиана ${summary.softMedian} | ${summary.seconds} с`,
);

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Annealing } from "../src/annealing.ts";
import { Ilp } from "../src/ilp.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { RandomGenerator } from "../src/random-generator.ts";
import { DEFAULT_COST_WEIGHTS, Timetable, type CostWeights } from "../src/timetable.ts";

const file = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, "");
  const value = process.argv[i + 1];
  if (value === undefined || value.startsWith("--")) args.set(key, "true");
  else args.set(key, process.argv[++i]);
}

const zero: Partial<CostWeights> = {
  difficulty: 0,
  sameSubjectInDay: 0,
  teacherGap: 0,
  shiftBreak: 0,
  shiftIdle: 0,
  dayImbalance: 0,
  misplaced: 0,
  teacherWish: 0,
};
const keep = (...keys: (keyof CostWeights)[]): Partial<CostWeights> => {
  const weights: Partial<CostWeights> = { ...zero };
  for (const key of keys) weights[key] = DEFAULT_COST_WEIGHTS[key];
  return weights;
};
const PARTS: [string, Partial<CostWeights>][] = [
  ["сложность по дням", keep("difficulty")],
  ["повторы", keep("sameSubjectInDay")],
  ["перекос дней", keep("dayImbalance")],
  ["половины дня", keep("misplaced")],
  ["окна и смены учителей", keep("teacherGap", "shiftBreak", "shiftIdle")],
  ["пожелания", keep("teacherWish")],
];
const COLUMNS = [
  "school",
  "classes",
  "lessons",
  "part",
  "status",
  "exact",
  "bound",
  "annealingAloneMean",
  "annealingAloneBest",
  "inFullCostMean",
  "seconds",
];

mkdirSync(file("experiments/raw"), { recursive: true });

if (args.has("merge")) {
  const rows = readdirSync(file("experiments/raw"))
    .filter((name) => name.startsWith("parts-") && name.endsWith(".jsonl"))
    .sort()
    .flatMap((name) => readFileSync(file(`experiments/raw/${name}`), "utf8").trim().split("\n"))
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, string | number>);
  writeFileSync(file("experiments/parts.csv"), [COLUMNS.join(","), ...rows.map((row) => COLUMNS.map((c) => row[c]).join(","))].join("\n") + "\n");
  console.log(`experiments/parts.csv: ${rows.length} строк`);
} else {
  const limit = Number(args.get("limit") ?? 60);
  const seeds = Number(args.get("seeds") ?? 3);
  let school = args.get("instance");
  let problem: Problem;
  if (school) {
    problem = Problem.from(Loader.instance(file(`instances/${school}.json`)));
  } else {
    const seed = Number(args.get("random") ?? 1);
    const subjects = Loader.subjects(file("instances/subjects.json"));
    const curriculum = Loader.curriculum(file("instances/curriculum.json"), subjects);
    school = `random-small-${seed}`;
    problem = Problem.from(RandomGenerator.generate({ seed, size: "small", name: school }, subjects, curriculum).instance);
  }

  const hard = await Ilp.solve(problem, { hardOnly: true, timeLimit: limit });
  if (!hard.slotOf) throw new Error(`${school}: no feasible timetable (${hard.status})`);
  const start = hard.slotOf;
  const full = Array.from({ length: seeds }, (_, i) => Annealing.run(problem, start, { seed: i + 1 }).slotOf);

  const lines: string[] = [];
  for (const [part, weights] of PARTS) {
    const alone = Array.from({ length: seeds }, (_, i) => Annealing.run(problem, start, { seed: i + 1, weights }));
    const best = alone.reduce((a, b) => (b.cost < a.cost ? b : a));
    const result = await Ilp.solve(problem, { timeLimit: limit, start: best.slotOf, weights });
    const inFull = full.map((slotOf) => Timetable.from(problem, slotOf, weights).cost);
    const mean = (values: number[]) => Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
    const row = {
      school,
      classes: problem.nClasses,
      lessons: problem.nLessons,
      part,
      status: result.status,
      exact: Number(result.objective.toFixed(2)),
      bound: Number(result.bound.toFixed(2)),
      annealingAloneMean: mean(alone.map((run) => run.cost)),
      annealingAloneBest: Number(best.cost.toFixed(2)),
      inFullCostMean: mean(inFull),
      seconds: Number(result.seconds.toFixed(1)),
    };
    lines.push(JSON.stringify(row));
    console.log(
      `${school.padEnd(15)} ${part.padEnd(22)} ${result.status.padEnd(9)} эталон ${String(row.exact).padStart(6)} граница ${String(row.bound).padStart(6)}` +
        ` | отжиг по этой части ${String(row.annealingAloneMean).padStart(7)} | в полной цене ${String(row.inFullCostMean).padStart(7)} | ${row.seconds} с`,
    );
  }
  writeFileSync(file(`experiments/raw/parts-${school}.jsonl`), lines.join("\n") + "\n");
}

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Annealing } from "../src/annealing.ts";
import { Dsatur } from "../src/dsatur.ts";
import { Ilp } from "../src/ilp.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { DEFAULT_COST_WEIGHTS, Timetable, type CostWeights } from "../src/timetable.ts";

const file = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, "");
  const value = process.argv[i + 1];
  if (value === undefined || value.startsWith("--")) args.set(key, "true");
  else args.set(key, process.argv[++i]);
}
const names = (args.get("instances") ?? "mini").split(",");
const limit = Number(args.get("limit") ?? 60);
const fullLimit = Number(args.get("full-limit") ?? limit);
const hardOnly = args.has("hard-only");

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

mkdirSync(file("experiments/raw"), { recursive: true });
const summaryPath = file("experiments/reference.csv");
const header = [
  "instance",
  "lessons",
  "hardStatus",
  "hardSeconds",
  "part",
  "limitSeconds",
  "status",
  "seconds",
  "annealing",
  "model",
  "bound",
  "checked",
  "columns",
  "rows",
];
if (!existsSync(summaryPath)) writeFileSync(summaryPath, header.join(",") + "\n");
const record = (values: (string | number)[]) => appendFileSync(summaryPath, values.join(",") + "\n");
const round = (value: number) => (Number.isFinite(value) ? Number(value.toFixed(2)) : "");

for (const name of names) {
  const problem = Problem.from(Loader.instance(file(`instances/${name}.json`)));
  const dsatur = Dsatur.solve(problem, { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" }).slotOf;
  const hard = await Ilp.solve(problem, { hardOnly: true, timeLimit: limit });
  const hardChecked = hard.slotOf ? Timetable.from(problem, hard.slotOf).hard : "";
  console.log(
    `\n${name}: уроков ${problem.nLessons} | только жёсткие: ${hard.status} за ${hard.seconds.toFixed(1)} с` +
      ` (DSATUR оставил ${Timetable.from(problem, dsatur).hard}, проверка решения модели: ${hardChecked})`,
  );
  record([name, problem.nLessons, hard.status, round(hard.seconds), "только жёсткие", limit, hard.status, round(hard.seconds), "", "", "", hardChecked, hard.columns, hard.rows]);
  if (hardOnly || hard.status === "infeasible") continue;

  const start = hard.slotOf ?? dsatur;
  let boundSum = 0;
  let allOptimal = true;
  for (const [label, weights] of [...PARTS, ["полная цена", {}] as [string, Partial<CostWeights>]]) {
    const whole = label === "полная цена";
    const annealed = Annealing.run(problem, start, { seed: 1, weights });
    const table = Timetable.from(problem, annealed.slotOf, weights);
    const seconds = whole ? fullLimit : limit;
    const result = await Ilp.solve(problem, { timeLimit: seconds, start: table.hard === 0 ? annealed.slotOf : undefined, weights });
    const checked = result.slotOf ? Timetable.from(problem, result.slotOf, weights) : undefined;
    if (!whole) {
      boundSum += result.bound;
      if (result.status !== "optimal") allOptimal = false;
    }
    console.log(
      `  ${label.padEnd(24)} ${result.status.padEnd(9)} ${result.seconds.toFixed(1).padStart(6)} с | отжиг ${table.cost.toFixed(1)}` +
        ` | модель ${result.objective.toFixed(1)} | граница ${result.bound.toFixed(1)}` +
        ` | проверка ${checked ? checked.cost.toFixed(1) : "-"}${checked && checked.hard > 0 ? ` (жёстких ${checked.hard})` : ""}`,
    );
    record([name, problem.nLessons, hard.status, round(hard.seconds), label, seconds, result.status, round(result.seconds), round(table.cost), round(result.objective), round(result.bound), checked ? round(checked.cost) : "", result.columns, result.rows]);
    if (whole) {
      const best = Math.max(result.bound, boundSum);
      const upper = Math.min(table.cost, result.objective);
      console.log(
        `  нижняя граница полной цены: ${best.toFixed(1)} (сумма по частям ${boundSum.toFixed(1)}${allOptimal ? ", все части доказаны" : ""}, решатель ${result.bound.toFixed(1)})` +
          ` | лучшее найденное ${upper.toFixed(1)} | отжиг выше границы на ${best > 0 ? ((100 * (table.cost - best)) / best).toFixed(0) : "-"} %`,
      );
      record([name, problem.nLessons, hard.status, round(hard.seconds), "граница полной цены", seconds, allOptimal ? "части доказаны" : "части не все доказаны", "", round(table.cost), round(upper), round(best), "", "", ""]);
    }
  }
}

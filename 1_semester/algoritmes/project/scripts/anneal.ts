import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Annealing, type MoveSet } from "../src/annealing.ts";
import { Dsatur } from "../src/dsatur.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { Timetable } from "../src/timetable.ts";

const file = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, "");
  const value = process.argv[i + 1];
  if (value === undefined || value.startsWith("--")) args.set(key, "true");
  else args.set(key, process.argv[++i]);
}
const seeds = Number(args.get("seeds") ?? 3);
const perLesson = Number(args.get("per-lesson") ?? 1000);
const startTemperature = Number(args.get("t0") ?? 20);
const endTemperature = Number(args.get("t1") ?? 1);

const NAMES = ["mini", "small-7", "small-10", "medium-20", "medium-30", "large-60", "heavy-1", "heavy-2", "heavy-4"];
const start = { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" } as const;

const describe = (timetable: Timetable) => {
  const soft = timetable.soft();
  return {
    жёсткие: timetable.hard,
    сложность: soft.difficultySpread,
    повторы: soft.sameSubjectInDay,
    "окна учителей": soft.teacherGaps,
    "макс. окон у учителя": soft.worstTeacherGaps,
    "переходы между сменами": soft.shiftBreaks,
    "простой между сменами": soft.shiftIdle,
    перекос: soft.dayImbalance,
    "не в своей половине": soft.misplaced,
    "против пожеланий": soft.wishesBroken,
    цена: timetable.cost,
  };
};

for (const name of NAMES) {
  const problem = Problem.from(Loader.instance(file(`instances/${name}.json`)));
  const slotOf = Dsatur.solve(problem, start).slotOf;
  const rows: Record<string, string | number>[] = [{ вариант: "DSATUR", ...describe(Timetable.from(problem, slotOf)) }];
  let bestCost = Infinity;
  let bestSlots = slotOf;
  for (const moves of ["move", "swap", "both"] as MoveSet[]) {
    const sum: Record<string, number> = {};
    let solved = 0;
    let seconds = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const started = performance.now();
      const result = Annealing.run(problem, slotOf, {
        moves,
        seed,
        iterations: problem.nLessons * perLesson,
        startTemperature,
        endTemperature,
      });
      seconds += (performance.now() - started) / 1000;
      const stats = describe(Timetable.from(problem, result.slotOf));
      if (stats.жёсткие === 0) solved++;
      if (moves === "both" && result.cost < bestCost) {
        bestCost = result.cost;
        bestSlots = result.slotOf;
      }
      for (const [key, value] of Object.entries(stats)) sum[key] = (sum[key] ?? 0) + value;
    }
    const row: Record<string, string | number> = { вариант: moves };
    for (const [key, value] of Object.entries(sum)) row[key] = Number((value / seeds).toFixed(1));
    row["без жёстких"] = `${solved}/${seeds}`;
    row["сек"] = Number((seconds / seeds).toFixed(1));
    rows.push(row);
  }
  writeFileSync(
    file(`instances/${name}.annealed.json`),
    JSON.stringify({ instance: name, moves: "both", cost: bestCost, slotOf: Array.from(bestSlots) }) + "\n",
  );
  console.log(`\n${name}: уроков ${problem.nLessons}, ходов ${problem.nLessons * perLesson}`);
  console.table(rows);
}

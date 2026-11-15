import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Annealing } from "../src/annealing.ts";
import { Dsatur } from "../src/dsatur.ts";
import { Ilp } from "../src/ilp.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { RandomGenerator } from "../src/random-generator.ts";
import { Timetable } from "../src/timetable.ts";

const file = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, "");
  const value = process.argv[i + 1];
  if (value === undefined || value.startsWith("--")) args.set(key, "true");
  else args.set(key, process.argv[++i]);
}
const load = Number(args.get("load") ?? 28);
const wanted = Number(args.get("schools") ?? 8);
const maxSeeds = Number(args.get("max-seeds") ?? 60);
const limit = Number(args.get("limit") ?? 20);

const subjects = Loader.subjects(file("instances/subjects.json"));
const curriculum = Loader.curriculum(file("instances/curriculum.json"), subjects);
const start = { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" } as const;

mkdirSync(file("experiments/raw"), { recursive: true });
const lines: string[] = [];
const counts = { obvious: 0, infeasible: 0, unknown: 0, feasible: 0 };
const solved = { dsatur: 0, annealing: 0, kempe: 0 };
const soft = { annealing: 0, kempe: 0 };
for (let seed = 1; seed <= maxSeeds && counts.feasible < wanted; seed++) {
  const { instance, meta } = RandomGenerator.generate(
    { seed, size: "medium", shifts: 1, loadRange: [load, load], unavailableShare: 0 },
    subjects,
    curriculum,
  );
  if (meta.provablyInfeasible.length > 0) {
    counts.obvious++;
    continue;
  }
  const problem = Problem.from(instance);
  const exact = await Ilp.solve(problem, { hardOnly: true, timeLimit: limit });
  if (exact.status === "infeasible") {
    counts.infeasible++;
    continue;
  }
  if (!exact.slotOf) {
    counts.unknown++;
    continue;
  }
  counts.feasible++;
  const slotOf = Dsatur.solve(problem, start).slotOf;
  const dsatur = Timetable.from(problem, slotOf);
  const plain = Timetable.from(problem, Annealing.run(problem, slotOf, { seed: 1, kempeShare: 0 }).slotOf);
  const kempe = Timetable.from(problem, Annealing.run(problem, slotOf, { seed: 1, kempeShare: 0.5 }).slotOf);
  if (dsatur.hard === 0) solved.dsatur++;
  if (plain.hard === 0) solved.annealing++;
  if (kempe.hard === 0) solved.kempe++;
  const per100 = (table: Timetable) => (100 * (table.cost - 1000 * table.hard)) / problem.nLessons;
  soft.annealing += per100(plain);
  soft.kempe += per100(kempe);
  lines.push(
    JSON.stringify({
      load,
      seed,
      classes: instance.classes.length,
      teachers: instance.teachers.length,
      lessons: problem.nLessons,
      maxLoadShare: Number(meta.maxLoadShare.toFixed(2)),
      exactSeconds: Number(exact.seconds.toFixed(2)),
      dsaturHard: dsatur.hard,
      annealingHard: plain.hard,
      kempeHard: kempe.hard,
      annealingSoftPer100: Number(per100(plain).toFixed(1)),
      kempeSoftPer100: Number(per100(kempe).toFixed(1)),
    }),
  );
}
writeFileSync(file(`experiments/raw/hardset-load${load}.jsonl`), lines.join("\n") + "\n");
const n = Math.max(1, counts.feasible);
console.log(
  `нагрузка ${load}: очевидно нерешаемых ${counts.obvious}, нерешаемых по решателю ${counts.infeasible}, не успел ${counts.unknown}, с расписанием ${counts.feasible}` +
    ` | без нарушений: DSATUR ${solved.dsatur}, отжиг ${solved.annealing}, отжиг с цепочками ${solved.kempe}` +
    ` | мягкая цена: отжиг ${(soft.annealing / n).toFixed(1)}, с цепочками ${(soft.kempe / n).toFixed(1)}`,
);

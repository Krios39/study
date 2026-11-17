import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Annealing } from "../src/annealing.ts";
import { Dsatur } from "../src/dsatur.ts";
import { Ilp } from "../src/ilp.ts";
import { Loader } from "../src/loader.ts";
import { Problem } from "../src/problem.ts";
import { Timetable } from "../src/timetable.ts";
import { Xhstt } from "../src/xhstt.ts";

const file = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, "");
  const value = process.argv[i + 1];
  if (value === undefined || value.startsWith("--")) args.set(key, "true");
  else args.set(key, process.argv[++i]);
}
const archive = args.get("archive") ?? "instances/xhstt/XHSTT-2014.xml";
const only = args.get("only")?.split(",");
const solve = !args.has("no-solve");
const limit = Number(args.get("limit") ?? 30);

const nodes = Xhstt.instanceNodes(Xhstt.parseXml(readFileSync(file(archive), "utf8")));
mkdirSync(file("experiments"), { recursive: true });
const columns = [
  "id",
  "country",
  "times",
  "days",
  "periodsPerDay",
  "classes",
  "teachers",
  "otherResources",
  "events",
  "eventsUsed",
  "lessons",
  "lessonsSkipped",
  "unassignedRoles",
  "fits",
  "exact",
  "exactSeconds",
  "dsaturHard",
  "annealingHard",
  "annealingSeconds",
  "softPer100",
  "constraintsIgnored",
  "notes",
];
const lines = [columns.join(",")];
const quote = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

for (const node of nodes) {
  if (only && !only.includes(node.attributes.Id)) continue;
  const { instance, report } = Xhstt.convert(node);
  const row: Record<string, unknown> = {
    ...report,
    otherResources: Object.entries(report.otherResources).map(([k, v]) => `${k}:${v}`).join(" "),
    constraintsIgnored: Object.entries(report.constraintsIgnored).map(([k, v]) => `${k}:${v}`).join(" "),
    notes: report.notes.join("; "),
    fits: "",
  };
  const skipped = Object.entries(report.eventsSkipped).map(([k, v]) => `${k} ${v}`).join(", ");
  let status = "не подходит";
  if (instance) {
    try {
      Loader.validateInstance(instance);
      row.fits = report.lessonsSkipped === 0 ? "полностью" : "частично";
      status = String(row.fits);
      writeFileSync(file(`instances/xhstt/${report.id}.json`), JSON.stringify(instance) + "\n");
      if (solve) {
        const problem = Problem.from(instance);
        const exact = await Ilp.solve(problem, { hardOnly: true, timeLimit: limit });
        row.exact = exact.status === "infeasible" ? "нет расписания" : exact.slotOf ? "есть" : "не успел";
        row.exactSeconds = exact.seconds.toFixed(1);
        const start = Dsatur.solve(problem, { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" }).slotOf;
        row.dsaturHard = Timetable.from(problem, start).hard;
        const started = performance.now();
        const table = Timetable.from(problem, Annealing.run(problem, start, { seed: 1 }).slotOf);
        row.annealingSeconds = ((performance.now() - started) / 1000).toFixed(1);
        row.annealingHard = table.hard;
        row.softPer100 = ((100 * (table.cost - table.weights.hard * table.hard)) / problem.nLessons).toFixed(1);
      }
    } catch (error) {
      row.fits = "ошибка проверки";
      status = "ошибка проверки";
      row.notes = `${row.notes}; ${(error as Error).message.split("\n").slice(0, 2).join(" ").trim()}`;
    }
  }
  lines.push(columns.map((column) => quote(row[column])).join(","));
  console.log(
    `${report.id.padEnd(9)} ${status.padEnd(16)} дней ${report.days}×${report.periodsPerDay} | классов ${report.classes}, учителей ${report.teachers}` +
      ` | уроков взято ${report.lessons}, пропущено ${report.lessonsSkipped}${skipped ? ` (${skipped})` : ""}, ролей без назначения ${report.unassignedRoles}` +
      (row.exact !== undefined ? ` | решатель: ${row.exact} | жёстких: DSATUR ${row.dsaturHard}, отжиг ${row.annealingHard} (${row.annealingSeconds} с)` : ""),
  );
}
writeFileSync(file("experiments/xhstt.csv"), lines.join("\n") + "\n");

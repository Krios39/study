import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Annealing } from "../../../src/solvers/annealing.ts";
import { Dsatur } from "../../../src/solvers/dsatur.ts";
import { Ilp } from "../../../src/solvers/exact.ts";
import { Loader } from "../../../src/io/loader.ts";
import { Problem } from "../../../src/core/problem.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import { XhsttReader } from "../../../src/io/xhstt-reader.ts";
import { Xml } from "../../../src/io/xml.ts";
import { Workspace } from "../workspace.ts";
import type { Args } from "../args.ts";
import { Command } from "../command.ts";
import { Csv } from "../report.ts";

export class XhsttCommand extends Command {
  readonly name = "xhstt";
  readonly summary = "Convert the public XHSTT archive and solve the schools that fit";

  async run(args: Args) {
    const archive = args.get("archive") ?? "instances/xhstt/XHSTT-2014.xml";
    const only = args.get("only")?.split(",");
    const solve = !args.has("no-solve");
    const limit = Number(args.get("limit") ?? 30);

    const nodes = XhsttReader.instanceNodes(Xml.parse(readFileSync(Workspace.path(archive), "utf8")));
    mkdirSync(Workspace.path("experiments"), { recursive: true });
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

    for (const node of nodes) {
      if (only && !only.includes(node.attributes.Id)) continue;
      const { instance, report } = XhsttReader.convert(node);
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
          writeFileSync(Workspace.path(`instances/xhstt/${report.id}.json`), JSON.stringify(instance) + "\n");
          if (solve) {
            const problem = Problem.from(instance);
            const exact = await Ilp.solve(problem, { hardOnly: true, timeLimit: limit });
            row.exact = exact.status === "infeasible" ? "нет расписания" : exact.slotOf ? "есть" : "не успел";
            row.exactSeconds = exact.seconds.toFixed(1);
            const start = Dsatur.recommended().solve(problem).slotOf;
            row.dsaturHard = Timetable.from(problem, start).hard;
            const started = performance.now();
            const table = Timetable.from(problem, new Annealing({ seed: 1 }).solve(problem, start).slotOf);
            row.annealingSeconds = ((performance.now() - started) / 1000).toFixed(1);
            row.annealingHard = table.hard;
            row.softPer100 = ((100 * (table.softCost)) / problem.nLessons).toFixed(1);
          }
        } catch (error) {
          row.fits = "ошибка проверки";
          status = "ошибка проверки";
          row.notes = `${row.notes}; ${(error as Error).message.split("\n").slice(0, 2).join(" ").trim()}`;
        }
      }
      lines.push(Csv.line(columns.map((column) => String(row[column] ?? ""))));
      console.log(
        `${report.id.padEnd(9)} ${status.padEnd(16)} дней ${report.days}×${report.periodsPerDay} | классов ${report.classes}, учителей ${report.teachers}` +
          ` | уроков взято ${report.lessons}, пропущено ${report.lessonsSkipped}${skipped ? ` (${skipped})` : ""}, ролей без назначения ${report.unassignedRoles}` +
          (row.exact !== undefined ? ` | решатель: ${row.exact} | жёстких: DSATUR ${row.dsaturHard}, отжиг ${row.annealingHard} (${row.annealingSeconds} с)` : ""),
      );
    }
    writeFileSync(Workspace.path("experiments/xhstt.csv"), lines.join("\n") + "\n");
  }
}

import { mkdirSync, writeFileSync } from "node:fs";
import { Dsatur, type DsaturOptions } from "../../../src/solvers/dsatur.ts";
import { Loader } from "../../../src/io/loader.ts";
import { Problem } from "../../../src/core/problem.ts";
import { RandomGenerator, type RandomParams } from "../../../src/generators/random-generator.ts";
import { Rng } from "../../../src/core/rng.ts";
import { Workspace } from "../workspace.ts";
import { Timetable } from "../../../src/core/timetable.ts";
import type { Args } from "../args.ts";
import { Command } from "../command.ts";

export class StressCommand extends Command {
  readonly name = "stress";
  readonly summary = "Stress DSATUR on random schools under varying conditions";

  async run(args: Args) {
    const runs = Number(args.get("n") ?? 100);
    const firstSeed = Number(args.get("seed") ?? 1);
    const series = args.get("series") ?? "all";
    const save = args.has("save");

    const { subjects, curriculum } = Workspace.dictionaries();

    const ALGORITHMS: [string, DsaturOptions][] = [
      ["классика", { respectAllowed: true }],
      ["слоты+штраф", { respectAllowed: true, lessonRule: "freeSlots", slotRule: "leastPenalty" }],
    ];

    type Row = Record<string, string | number>;

    function cell(label: string, make: (seed: number) => RandomParams): Row {
      let infeasible = 0;
      let checked = 0;
      let classes = 0;
      let meanLoad = 0;
      let maxLoadShare = 0;
      const solved = ALGORITHMS.map(() => 0);
      const violations = ALGORITHMS.map(() => 0);
      let saved = 0;

      for (let k = 0; k < runs; k++) {
        const params = make(firstSeed + k);
        const { instance, meta } = new RandomGenerator(subjects, curriculum).generate(params);
        if (meta.provablyInfeasible.length > 0) {
          infeasible++;
          continue;
        }
        Loader.validateInstance(instance);
        const problem = Problem.from(instance);
        checked++;
        classes += instance.classes.length;
        meanLoad += meta.meanLoad;
        maxLoadShare += meta.maxLoadShare;
        ALGORITHMS.forEach(([, options], a) => {
          const total = Timetable.from(problem, new Dsatur(options).solve(problem).slotOf).hard;
          if (total === 0) solved[a]++;
          violations[a] += total;
          if (save && a === ALGORITHMS.length - 1 && total > 0 && saved < 3) {
            mkdirSync(Workspace.path("instances/stress"), { recursive: true });
            const name = `${label.replace(/[^a-z0-9а-яё]+/gi, "-")}-seed${params.seed}`;
            writeFileSync(Workspace.path(`instances/stress/${name}.json`), JSON.stringify({ ...instance, name }) + "\n");
            saved++;
          }
        });
      }

      const row: Row = {
        серия: label,
        "заведомо нерешаемых": infeasible,
        проверено: checked,
        "классов (ср.)": checked ? Math.round(classes / checked) : 0,
        "нагрузка (ср.)": checked ? Number((meanLoad / checked).toFixed(1)) : 0,
        "макс. доля занятости": checked ? Number((maxLoadShare / checked).toFixed(2)) : 0,
      };
      ALGORITHMS.forEach(([name], a) => {
        row[`${name}: решено %`] = checked ? Math.round((100 * solved[a]) / checked) : 0;
        row[`${name}: нарушений (ср.)`] = checked ? Number((violations[a] / checked).toFixed(1)) : 0;
      });
      return row;
    }

    function table(title: string, rows: Row[]) {
      console.log(`\n${title}`);
      console.table(rows);
    }

    const want = (name: string) => series === "all" || series === name;

    if (want("baseline")) {
      table(
        "Полностью случайные школы (нагрузка 12–24, 20% учителей с одним выходным)",
        (["small", "medium", "large"] as const).map((size) => cell(size, (seed) => ({ seed, size }))),
      );
    }

    if (want("load")) {
      for (const shifts of [1, 2] as const) {
        table(
          `Нагрузка учителей, средние школы, смен: ${shifts}, без недоступности`,
          [12, 16, 20, 24, 28, 30, 32, 34, 36, 38, 40].map((load) =>
            cell(`нагрузка ${load}`, (seed) => ({
              seed,
              size: "medium",
              shifts,
              loadRange: [load, load],
              unavailableShare: 0,
            })),
          ),
        );
      }
    }

    if (want("off")) {
      for (const daysOff of [1, 2]) {
        table(
          `Недоступность: ${daysOff} дн. у доли учителей, средние школы, нагрузка 16–20`,
          [0, 0.25, 0.5, 0.75, 1].map((share) =>
            cell(`доля ${share}`, (seed) => ({
              seed,
              size: "medium",
              loadRange: [16, 20],
              unavailableShare: share,
              daysOff,
            })),
          ),
        );
      }
    }

    if (want("slack")) {
      table(
        "Запас уроков в дне у класса, средние школы, нагрузка 16–20, без недоступности",
        [0, 1, 2].map((daySlack) =>
          cell(`запас ${daySlack}`, (seed) => ({
            seed,
            size: "medium",
            loadRange: [16, 20],
            unavailableShare: 0,
            daySlack,
          })),
        ),
      );
    }

    if (want("size")) {
      table(
        "Размер школы при нагрузке 20–24 и 20% учителей с выходным",
        (["small", "medium", "large"] as const).flatMap((size) =>
          ([1, 2] as const).map((shifts) =>
            cell(`${size}, смен ${shifts}`, (seed) => ({ seed, size, shifts, loadRange: [20, 24] })),
          ),
        ),
      );
    }

    if (want("share")) {
      const edges = [0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0001];
      const best = ALGORITHMS[ALGORITHMS.length - 1][1];
      const bins = edges.slice(1).map(() => ({ count: 0, solved: 0, unassigned: 0, gaps: 0, other: 0 }));
      let infeasible = 0;
      for (let k = 0; k < runs * 10; k++) {
        const seed = firstSeed + k;
        const pick = new Rng(seed ^ 0x9e3779b9);
        const { instance, meta } = new RandomGenerator(subjects, curriculum).generate({
            seed,
            loadRange: [pick.int(10, 20), pick.int(20, 40)],
            unavailableShare: pick.next(),
            daysOff: pick.int(1, 2),
            daySlack: pick.int(0, 2),
          });
        if (meta.provablyInfeasible.length > 0) {
          infeasible++;
          continue;
        }
        const problem = Problem.from(instance);
        const v = Timetable.from(problem, new Dsatur(best).solve(problem).slotOf).violations();
        const bin = bins[edges.findIndex((e) => meta.maxLoadShare < e) - 1];
        bin.count++;
        if (v.total === 0) bin.solved++;
        bin.unassigned += v.unassigned;
        bin.gaps += v.classGap;
        bin.other += v.total - v.unassigned - v.classGap;
      }
      table(
        `Случайные школы со случайными настройками по занятости самого загруженного учителя (заведомо нерешаемых: ${infeasible})`,
        bins.map((b, i) => ({
          "макс. доля занятости": `${edges[i].toFixed(1)}–${Math.min(1, edges[i + 1]).toFixed(1)}`,
          школ: b.count,
          "решено %": b.count ? Math.round((100 * b.solved) / b.count) : 0,
          "не поместилось (ср.)": b.count ? Number((b.unassigned / b.count).toFixed(2)) : 0,
          "окна (ср.)": b.count ? Number((b.gaps / b.count).toFixed(2)) : 0,
          "прочее (ср.)": b.count ? Number((b.other / b.count).toFixed(2)) : 0,
        })),
      );
    }
  }
}

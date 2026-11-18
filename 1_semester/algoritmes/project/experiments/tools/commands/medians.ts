import { readFileSync } from "node:fs";
import { Workspace } from "../workspace.ts";
import type { Args } from "../args.ts";
import { Command } from "../command.ts";

export class MediansCommand extends Command {
  readonly name = "medians";
  readonly summary = "Print medians of recorded experiment runs";

  async run(args: Args) {
    const ids = args.positional;
    if (ids.length === 0) throw new Error("pass run ids, e.g. k00-baseline k08-any-0.5");

    const quantile = (sorted: number[], q: number) => {
      if (sorted.length === 0) return 0;
      const position = (sorted.length - 1) * q;
      const low = Math.floor(position);
      const high = Math.ceil(position);
      return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
    };
    const fromCounts = (counts: number[], q: number) => {
      const total = counts.reduce((a, b) => a + b, 0);
      if (total === 0) return 0;
      let seen = 0;
      for (let length = 0; length < counts.length; length++) {
        seen += counts[length];
        if (seen >= total * q) return length;
      }
      return counts.length - 1;
    };

    const rows = [];
    for (const id of ids) {
      const schools = readFileSync(Workspace.path(`experiments/raw/${id}.jsonl`), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      const soft = schools.map((s) => (100 * s.annealed.softCost) / s.lessons).sort((a, b) => a - b);
      const tried = new Array<number>(129).fill(0);
      const accepted = new Array<number>(129).fill(0);
      for (const s of schools) {
        (s.kempe?.triedByLength ?? []).forEach((count: number, length: number) => (tried[length] += count));
        (s.kempe?.acceptedByLength ?? []).forEach((count: number, length: number) => (accepted[length] += count));
      }
      const totalTried = tried.reduce((a, b) => a + b, 0);
      const share = (limit: number) =>
        totalTried ? Number(((100 * tried.slice(0, limit + 1).reduce((a, b) => a + b, 0)) / totalTried).toFixed(1)) : 0;
      rows.push({
        запуск: id,
        "цена: среднее": Number((soft.reduce((a, b) => a + b, 0) / soft.length).toFixed(1)),
        "цена: медиана": Number(quantile(soft, 0.5).toFixed(1)),
        "цена: мин–макс": `${soft[0].toFixed(0)}–${soft[soft.length - 1].toFixed(0)}`,
        "длина: медиана": fromCounts(tried, 0.5),
        "длина: 90 %": fromCounts(tried, 0.9),
        "длина: 99 %": fromCounts(tried, 0.99),
        "принятые: медиана": fromCounts(accepted, 0.5),
        "принятые: 90 %": fromCounts(accepted, 0.9),
        "одиночных %": share(1),
        "до 4 %": share(4),
        "до 16 %": share(16),
      });
    }
    console.table(rows);
  }
}

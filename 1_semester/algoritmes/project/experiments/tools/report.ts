import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Timetable } from "../../src/core/timetable.ts";

export type Cell = string | number;

export class Csv {
  static line(values: Cell[]): string {
    return values.map((v) => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v))).join(",");
  }

  static write(path: string, header: string[], rows: Cell[][]) {
    writeFileSync(path, [Csv.line(header), ...rows.map(Csv.line)].join("\n") + "\n");
  }

  static append(path: string, row: Record<string, Cell>) {
    const header = Csv.line(Object.keys(row));
    if (!existsSync(path)) writeFileSync(path, header + "\n");
    else if (readFileSync(path, "utf8").split(/\r?\n/)[0] !== header) throw new Error(`${path} has different columns`);
    appendFileSync(path, Csv.line(Object.values(row)) + "\n");
  }
}

export class Stats {
  static mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
  }

  static median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2;
  }

  static softPer100(timetable: Timetable): number {
    return (100 * timetable.softCost) / timetable.problem.nLessons;
  }
}

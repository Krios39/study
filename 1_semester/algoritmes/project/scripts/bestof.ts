import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file = (relative: string) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const ids = process.argv.slice(2);
if (ids.length === 0) throw new Error("pass run ids that differ only by the annealing seed");

const runs = ids.map((id) =>
  readFileSync(file(`experiments/raw/${id}.jsonl`), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { lessons: number; seconds: number; annealed: { softCost: number; hard: number } }),
);
const schools = runs[0].length;
const rows = [];
for (let k = 1; k <= runs.length; k *= 2) {
  let sum = 0;
  let solved = 0;
  let wall = 0;
  const values: number[] = [];
  for (let s = 0; s < schools; s++) {
    let best = Infinity;
    let hard = Infinity;
    let slowest = 0;
    for (let r = 0; r < k; r++) {
      const school = runs[r][s];
      const cost = school.annealed.hard * 1000 + school.annealed.softCost;
      if (cost < best) {
        best = cost;
        hard = school.annealed.hard;
      }
      slowest = Math.max(slowest, school.seconds);
    }
    const per100 = (100 * (best - hard * 1000)) / runs[0][s].lessons;
    sum += per100;
    values.push(per100);
    if (hard === 0) solved++;
    wall += slowest;
  }
  values.sort((a, b) => a - b);
  rows.push({
    запусков: k,
    "решено %": Math.round((100 * solved) / schools),
    "цена: среднее": Number((sum / schools).toFixed(1)),
    "цена: медиана": Number(((values[Math.floor((schools - 1) / 2)] + values[Math.ceil((schools - 1) / 2)]) / 2).toFixed(1)),
  });
}
console.table(rows);

import highsModule from "highs";
import { UNASSIGNED, type Solution } from "./model.ts";
import type { Problem } from "./problem.ts";
import { EASY_UP_TO, HEAVY_FROM } from "./soft.ts";
import { DEFAULT_COST_WEIGHTS, type CostWeights } from "./timetable.ts";

export interface IlpOptions {
  timeLimit?: number;
  weights?: Partial<CostWeights>;
  hardOnly?: boolean;
  start?: Solution;
  log?: boolean;
}

export type IlpStatus = "optimal" | "feasible" | "infeasible" | "unknown";

export interface IlpResult {
  status: IlpStatus;
  objective: number;
  bound: number;
  slotOf: Solution | undefined;
  seconds: number;
  columns: number;
  rows: number;
}

type Terms = Map<string, number>;

const loadHighs = highsModule as unknown as typeof import("highs").default;

const GAP_TANGENTS = 20;
const MODEL_OPTIMAL = 7;
const MODEL_INFEASIBLE = 8;

export class Ilp {
  private readonly problem: Problem;
  private readonly weights: CostWeights;
  private readonly objective: Terms = new Map();
  private readonly rows: string[] = [];
  private readonly binaries: string[] = [];
  private readonly unitBounds: string[] = [];
  private readonly reqLessons: number[][];
  private readonly reqsOfClass: number[][];
  private readonly reqsOfTeacher: number[][];
  private readonly yNames: Set<string> = new Set();

  private constructor(problem: Problem, weights: CostWeights) {
    this.problem = problem;
    this.weights = weights;
    const nReqs = problem.instance.requirements.length;
    this.reqLessons = Array.from({ length: nReqs }, () => []);
    this.reqsOfClass = Array.from({ length: problem.nClasses }, () => []);
    this.reqsOfTeacher = Array.from({ length: problem.nTeachers }, () => []);
    for (let l = 0; l < problem.nLessons; l++) this.reqLessons[problem.lessonReq[l]].push(l);
    this.reqLessons.forEach((lessons, r) => {
      this.reqsOfClass[problem.lessonClass[lessons[0]]].push(r);
      for (const t of problem.teachersOf(lessons[0])) this.reqsOfTeacher[t].push(r);
    });
  }

  static async solve(problem: Problem, options: IlpOptions = {}): Promise<IlpResult> {
    const ilp = new Ilp(problem, { ...DEFAULT_COST_WEIGHTS, ...options.weights });
    ilp.addAssignment();
    ilp.addClasses(!options.hardOnly);
    ilp.addTeachers(!options.hardOnly);
    if (!options.hardOnly) ilp.addWishes();

    const highs = await loadHighs();
    const model = highs.createModel({ format: "lp", data: ilp.text() });
    model.options.set("output_flag", options.log ?? false);
    if (options.timeLimit !== undefined) model.options.set("time_limit", options.timeLimit);
    if (options.start) model.setSolution(ilp.startOf(model, options.start));

    const started = performance.now();
    const run = model.run();
    const seconds = (performance.now() - started) / 1000;
    const dimensions = model.getDimensions() as unknown as Record<string, number>;
    const columns = dimensions.numCol ?? dimensions.numCols ?? dimensions.cols ?? 0;
    const rows = dimensions.numRow ?? dimensions.numRows ?? dimensions.rows ?? 0;
    const hasSolution = Number(model.info.get("primal_solution_status")) === 2;
    const objective = hasSolution ? Number(model.info.get("objective_function_value")) : Infinity;
    const bound = options.hardOnly ? 0 : Number(model.info.get("mip_dual_bound"));
    const status: IlpStatus =
      run.modelStatus === MODEL_INFEASIBLE
        ? "infeasible"
        : run.modelStatus === MODEL_OPTIMAL
          ? "optimal"
          : hasSolution
            ? "feasible"
            : "unknown";
    const slotOf = hasSolution ? ilp.read(model) : undefined;
    model.dispose();
    return { status, objective, bound, slotOf, seconds, columns, rows };
  }

  private y(req: number, slot: number): string | undefined {
    return this.problem.isAllowed(this.reqLessons[req][0], slot) ? `y${req}_${slot}` : undefined;
  }

  private add(terms: Terms, name: string, coefficient: number) {
    terms.set(name, (terms.get(name) ?? 0) + coefficient);
  }

  private addAll(target: Terms, source: Terms, factor: number) {
    for (const [name, coefficient] of source) this.add(target, name, factor * coefficient);
  }

  private sum(reqs: number[], slot: number, weight: (req: number) => number = () => 1): Terms {
    const terms: Terms = new Map();
    for (const r of reqs) {
      const name = this.y(r, slot);
      const w = weight(r);
      if (name && w !== 0) this.add(terms, name, w);
    }
    return terms;
  }

  private row(terms: Terms, sense: ">=" | "<=" | "=", rhs: number) {
    const parts: string[] = [];
    for (const [name, coefficient] of terms) {
      if (coefficient === 0) continue;
      parts.push(`${coefficient < 0 ? "-" : "+"} ${Math.abs(coefficient)} ${name}`);
    }
    if (parts.length === 0) {
      const holds = sense === ">=" ? 0 >= rhs : sense === "<=" ? 0 <= rhs : rhs === 0;
      if (!holds) this.rows.push(` c${this.rows.length}: 0 ${this.binaries[0]} >= 1`);
      return;
    }
    this.rows.push(` c${this.rows.length}: ${Ilp.wrap(parts)} ${sense} ${rhs}`);
  }

  private unit(name: string): string {
    this.unitBounds.push(name);
    return name;
  }

  private addAssignment() {
    const { problem } = this;
    this.reqLessons.forEach((lessons, r) => {
      const terms: Terms = new Map();
      for (let s = 0; s < problem.nSlots; s++) {
        const name = this.y(r, s);
        if (!name) continue;
        terms.set(name, 1);
        this.binaries.push(name);
        this.yNames.add(name);
      }
      this.row(terms, "=", lessons.length);
    });
  }

  private addClasses(soft: boolean) {
    const { problem, weights } = this;
    const { days, periods } = problem;
    const scoreOf = (r: number) => problem.instance.subjects[problem.lessonSubject[this.reqLessons[r][0]]].difficulty;

    problem.instance.classes.forEach((cls, c) => {
      const reqs = this.reqsOfClass[c];
      const total = reqs.reduce((sum, r) => sum + scoreOf(r) * this.reqLessons[r].length, 0);
      const most = `mx${c}`;
      const least = `mn${c}`;
      if (soft) {
        this.add(this.objective, most, weights.dayImbalance);
        this.add(this.objective, least, -weights.dayImbalance);
      }

      for (let d = 0; d < days; d++) {
        const occupied: Terms[] = [];
        for (let i = 0; i < cls.maxPerDay; i++) {
          const terms = this.sum(reqs, d * periods + cls.firstPeriod + i);
          this.row(terms, "<=", 1);
          occupied.push(terms);
        }
        occupied.push(new Map());
        for (let i = 0; i + 1 < cls.maxPerDay; i++) {
          const order: Terms = new Map(occupied[i]);
          this.addAll(order, occupied[i + 1], -1);
          this.row(order, ">=", 0);
        }
        if (!soft) continue;

        const load: Terms = new Map();
        const score: Terms = new Map();
        for (let i = 0; i < cls.maxPerDay; i++) {
          const slot = d * periods + cls.firstPeriod + i;
          this.addAll(load, occupied[i], 1);
          this.addAll(score, this.sum(reqs, slot, scoreOf), 1);
        }
        const upper: Terms = new Map(load);
        this.add(upper, most, -1);
        this.row(upper, "<=", 0);
        const lower: Terms = new Map(load);
        this.add(lower, least, -1);
        this.row(lower, ">=", 0);

        const deviation = `dv${c}_${d}`;
        this.add(this.objective, deviation, weights.difficulty / days);
        const above: Terms = new Map([[deviation, 1]]);
        this.addAll(above, score, -days);
        this.row(above, ">=", -total);
        const below: Terms = new Map([[deviation, 1]]);
        this.addAll(below, score, days);
        this.row(below, ">=", total);

        for (const r of reqs) {
          if (this.reqLessons[r].length < 2) continue;
          const repeat = `rp${r}_${d}`;
          this.add(this.objective, repeat, weights.sameSubjectInDay);
          const terms: Terms = new Map([[repeat, 1]]);
          for (let i = 0; i < cls.maxPerDay; i++) {
            const name = this.y(r, d * periods + cls.firstPeriod + i);
            if (name) this.add(terms, name, -1);
          }
          this.row(terms, ">=", -1);
        }

        const heavy = (r: number) => (scoreOf(r) >= HEAVY_FROM ? 1 : 0);
        const easy = (r: number) => (scoreOf(r) <= EASY_UP_TO ? 1 : 0);
        const misplaced = `ms${c}_${d}`;
        this.add(this.objective, misplaced, weights.misplaced);
        for (let k = 2; k <= cls.maxPerDay; k++) {
          const terms: Terms = new Map([[misplaced, 1]]);
          let big = 0;
          for (let i = 0; i < k; i++) {
            const slot = d * periods + cls.firstPeriod + i;
            const counted = i < Math.floor(k / 2) ? easy : i >= Math.ceil(k / 2) ? heavy : undefined;
            if (!counted) continue;
            this.addAll(terms, this.sum(reqs, slot, counted), -1);
            big++;
          }
          this.addAll(terms, occupied[k - 1], -big);
          this.addAll(terms, occupied[k], big);
          this.row(terms, ">=", -big);
        }
      }
    });
  }

  private addTeachers(soft: boolean) {
    const { problem, weights } = this;
    const { days, periods, nSlots } = problem;
    const shiftCount = Math.max(...problem.periodShift) + 1;
    const shiftPeriods: number[][] = Array.from({ length: shiftCount }, () => []);
    for (let p = 0; p < periods; p++) shiftPeriods[problem.periodShift[p]].push(p);

    for (let t = 0; t < problem.nTeachers; t++) {
      const reqs = this.reqsOfTeacher[t];
      if (reqs.length === 0) continue;
      const busy: Terms[] = [];
      for (let s = 0; s < nSlots; s++) {
        const terms = this.sum(reqs, s);
        if (terms.size > 1) this.row(terms, "<=", 1);
        busy.push(terms);
      }
      if (!soft) continue;

      const load = reqs.reduce((sum, r) => sum + this.reqLessons[r].length, 0);
      const span: Terms = new Map();
      for (let d = 0; d < days; d++) {
        const used: string[] = [];
        const edges: { shift: number; before: string[]; after: string[]; list: number[] }[] = [];
        for (let k = 0; k < shiftCount; k++) {
          const list = shiftPeriods[k].filter((p) => busy[d * periods + p].size > 0);
          if (list.length === 0) continue;
          const before = list.map((p) => this.unit(`u${t}_${d}_${p}`));
          const after = list.map((p) => this.unit(`v${t}_${d}_${p}`));
          list.forEach((p, i) => {
            const here = busy[d * periods + p];
            for (const [side, step, names] of [
              ["before", -1, before],
              ["after", 1, after],
            ] as const) {
              const reach: Terms = new Map([[names[i], 1]]);
              this.addAll(reach, here, -1);
              this.row(reach, ">=", 0);
              const neighbour = names[i + step];
              if (neighbour !== undefined) this.row(new Map([[names[i], 1], [neighbour, -1]]), ">=", 0);
              const cap: Terms = new Map([[names[i], 1]]);
              list.forEach((q, j) => {
                if (side === "before" ? j <= i : j >= i) this.addAll(cap, busy[d * periods + q], -1);
              });
              this.row(cap, "<=", 0);
            }
            this.add(span, before[i], 1);
            this.add(span, after[i], 1);
          });
          const flag = before[list.length - 1];
          this.add(span, flag, -list.length);
          used.push(flag);
          edges.push({ shift: k, before, after, list });
        }
        if (used.length < 2) continue;
        if (used.length > 2) throw new Error("more than two shifts are not supported");

        const split = `bk${t}_${d}`;
        this.add(this.objective, split, weights.shiftBreak);
        this.row(new Map([[split, 1], [used[0], -1], [used[1], -1]]), ">=", -1);
        const [early, late] = edges;
        const lastEarly = shiftPeriods[early.shift][shiftPeriods[early.shift].length - 1];
        const firstLate = shiftPeriods[late.shift][0];
        const idle = (period: number, covered: string | undefined) => {
          const name = `id${t}_${d}_${period}`;
          this.add(this.objective, name, weights.shiftIdle);
          const terms: Terms = new Map([[name, 1], [split, -1]]);
          if (covered) this.add(terms, covered, 1);
          this.row(terms, ">=", 0);
        };
        for (let p = early.list[0] + 1; p <= lastEarly; p++) {
          const next = early.list.findIndex((q) => q >= p);
          idle(p, next < 0 ? undefined : early.after[next]);
        }
        for (let p = firstLate; p < late.list[late.list.length - 1]; p++) {
          let previous = -1;
          late.list.forEach((q, j) => {
            if (q <= p) previous = j;
          });
          idle(p, previous < 0 ? undefined : late.before[previous]);
        }
      }

      const squares = `z${t}`;
      this.add(this.objective, squares, weights.teacherGap);
      for (let j = 0; j < GAP_TANGENTS; j++) {
        const terms: Terms = new Map([[squares, 1]]);
        this.addAll(terms, span, -(2 * j + 1));
        this.row(terms, ">=", -(2 * j + 1) * load - j * (j + 1));
      }
    }
  }

  private addWishes() {
    const { problem, weights } = this;
    this.reqLessons.forEach((lessons, r) => {
      for (let s = 0; s < problem.nSlots; s++) {
        const name = this.y(r, s);
        if (!name) continue;
        let broken = 0;
        for (const t of problem.teachersOf(lessons[0])) broken += problem.teacherWished[t * problem.periods + problem.periodOf(s)];
        if (broken > 0) this.add(this.objective, name, weights.teacherWish * broken);
      }
    });
  }

  private text(): string {
    const objective: string[] = [];
    for (const [name, coefficient] of this.objective) {
      if (coefficient !== 0) objective.push(`${coefficient < 0 ? "-" : "+"} ${Math.abs(coefficient)} ${name}`);
    }
    if (objective.length === 0) objective.push(`+ 0 ${this.binaries[0]}`);
    return [
      "Minimize",
      ` obj: ${Ilp.wrap(objective)}`,
      "Subject To",
      ...this.rows,
      "Bounds",
      ...this.unitBounds.map((name) => ` 0 <= ${name} <= 1`),
      "Binary",
      Ilp.wrap(this.binaries.map((name) => ` ${name}`)),
      "End",
      "",
    ].join("\n");
  }

  private startOf(model: { getColByName(name: string): number }, slotOf: Solution): { indices: number[]; values: number[] } {
    const chosen = new Set<string>();
    this.reqLessons.forEach((lessons, r) => {
      for (const l of lessons) if (slotOf[l] !== UNASSIGNED) chosen.add(`y${r}_${slotOf[l]}`);
    });
    const indices: number[] = [];
    const values: number[] = [];
    for (const name of this.yNames) {
      indices.push(model.getColByName(name));
      values.push(chosen.has(name) ? 1 : 0);
    }
    return { indices, values };
  }

  private read(model: { getColByName(name: string): number; getSolution(): { colValue: Float64Array } }): Solution {
    const { problem } = this;
    const values = model.getSolution().colValue;
    const slotOf = new Int32Array(problem.nLessons).fill(UNASSIGNED);
    this.reqLessons.forEach((lessons, r) => {
      let next = 0;
      for (let s = 0; s < problem.nSlots && next < lessons.length; s++) {
        const name = this.y(r, s);
        if (name && values[model.getColByName(name)] > 0.5) slotOf[lessons[next++]] = s;
      }
    });
    return slotOf;
  }

  private static wrap(parts: string[]): string {
    const lines: string[] = [];
    for (let i = 0; i < parts.length; i += 8) lines.push(parts.slice(i, i + 8).join(" "));
    return lines.join("\n  ");
  }
}

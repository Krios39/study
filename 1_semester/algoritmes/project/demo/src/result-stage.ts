import type { Problem } from "../../src/core/problem.ts";
import { Timetable } from "../../src/core/timetable.ts";
import { UNASSIGNED } from "../../src/model.ts";
import { Annealing, type AnnealingRun } from "../../src/solvers/annealing.ts";
import { Dsatur } from "../../src/solvers/dsatur.ts";
import { DEFAULT_EVALUATIONS_PER_LESSON } from "../../src/solvers/local-search.ts";
import { MAX_EVALUATIONS } from "./annealing-stage.ts";
import { Picture } from "./board.ts";
import { Stage, type Scene } from "./stage.ts";
import { Lang } from "./text.ts";

const SLICE_MS = 40;
const CHECK_EVERY = 256;

export class ResultStage extends Stage {
  private readonly run: AnnealingRun;
  private readonly start: Int32Array;
  private final: Timetable | undefined;
  private spent: number;

  constructor(problem: Problem) {
    super(problem);
    const began = performance.now();
    this.start = Dsatur.recommended().solve(problem).slotOf;
    const evaluations = Math.min(problem.nLessons * DEFAULT_EVALUATIONS_PER_LESSON, MAX_EVALUATIONS);
    this.run = new Annealing({ evaluations }).start(problem, this.start);
    this.spent = performance.now() - began;
  }

  get finished(): boolean {
    return this.run.finished;
  }

  get done(): number {
    return this.run.evaluations;
  }

  get total(): number {
    return this.run.budget;
  }

  get pool(): number[] {
    return Array.from(this.start.keys()).filter((lesson) => this.start[lesson] === UNASSIGNED);
  }

  get score(): number | undefined {
    return this.finished ? this.run.cost : undefined;
  }

  plan() {}

  tick() {
    const { run } = this;
    if (!run.finished) {
      const began = performance.now();
      let now = began;
      while (!run.finished && now - began < SLICE_MS) {
        for (let i = 0; i < CHECK_EVERY && !run.finished; i++) run.advance();
        now = performance.now();
      }
      this.spent += now - began;
    }
    this.caption = this.narrate();
  }

  picture(): Picture {
    return new Picture(this.start);
  }

  refresh() {}

  protected open(): Scene | undefined {
    return undefined;
  }

  protected follow(scene: Scene): Scene {
    return scene;
  }

  protected burst() {}

  protected narrate(): string {
    if (!this.finished) return `<div class="loader"><i></i><b>${Lang.t("result.running")}</b></div>`;
    const broken = this.shown.evaluation().hard.total > 0;
    return (
      `<div class="ready"><span class="${broken ? "bad" : ""}">${Lang.t(broken ? "result.broken" : "result.ready")}</span><b>${this.time}</b>` +
      `<button class="primary" data-watch="1">${Lang.t("result.watch")}</button></div>`
    );
  }

  private get time(): string {
    const seconds = this.spent / 1000;
    return Lang.t("result.seconds", { value: seconds.toFixed(seconds < 10 ? 2 : 1) });
  }

  private get shown(): Timetable {
    this.final ??= Timetable.from(this.problem, this.run.result().slotOf);
    return this.final;
  }
}

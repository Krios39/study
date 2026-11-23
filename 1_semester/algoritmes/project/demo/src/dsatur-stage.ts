import type { Evaluation } from "../../src/core/cost.ts";
import type { Problem } from "../../src/core/problem.ts";
import { Timetable } from "../../src/core/timetable.ts";
import { UNASSIGNED } from "../../src/model.ts";
import { DEFAULT_SLOT_WEIGHTS, Dsatur, type DsaturRun } from "../../src/solvers/dsatur.ts";
import { Picture, type Mark } from "./board.ts";
import { Format } from "./format.ts";
import type { Pace } from "./pace.ts";
import { SETTLE, Stage, type Scene } from "./stage.ts";
import { Lang } from "./text.ts";
import { Trouble } from "./trouble.ts";

type Phase = "pick" | "judge" | "move";

interface Candidate {
  mark: Mark;
  penalty: number;
}

interface PlacementScene extends Scene {
  phase: Phase;
  whole: number;
  lesson: number;
  slot: number;
  closed: Mark[];
  free: Candidate[];
  affected: number;
}

const SHARE: Record<Phase, number> = { pick: 0.35, judge: 0.35, move: 0.3 };
const LANDING = 0.6;
const AUTO_SECONDS = 25;
const AUTO_START_RATE = 1;
const scoring = () => Lang.t("dsatur.scoring", { gap: DEFAULT_SLOT_WEIGHTS.gap, same: DEFAULT_SLOT_WEIGHTS.sameSubjectInDay, load: DEFAULT_SLOT_WEIGHTS.dayLoad });

export class DsaturStage extends Stage<PlacementScene> {
  private readonly run: DsaturRun;
  private readonly classBusy: Uint8Array;
  private readonly rowCounts: Int32Array;
  private readonly rowLessons: Int32Array;
  private countedAt = -1;
  private placed = 0;
  private unplaced = 0;
  private outcome: Evaluation | undefined;
  private flags: Uint8Array | undefined;

  constructor(problem: Problem) {
    super(problem);
    this.run = Dsatur.recommended().start(problem);
    this.classBusy = new Uint8Array(problem.nClasses * problem.nSlots);
    this.rowCounts = new Int32Array(problem.nClasses);
    this.rowLessons = new Int32Array(problem.nClasses);
  }

  get finished(): boolean {
    return this.run.finished;
  }

  get done(): number {
    return this.placed + this.unplaced;
  }

  get total(): number {
    return this.problem.nLessons;
  }

  get pool(): number[] {
    return Array.from({ length: this.problem.nLessons }, (_, lesson) => lesson);
  }

  flag(lesson: number): number {
    return this.finished ? this.trouble()[lesson] : 0;
  }

  plan(pace: Pace) {
    pace.plan(this.total, AUTO_SECONDS, AUTO_START_RATE);
  }

  picture(): Picture {
    const { run, scene, problem, hovered } = this;
    const picture = new Picture(run.current);
    picture.counts = this.counts();
    picture.gaps = this.finished;
    if (this.finished && !scene) picture.trouble = this.trouble();
    if (this.unplaced > 0) picture.crossed = this.pool.filter((lesson) => run.isPlaced(lesson) && run.current[lesson] === UNASSIGNED);
    if (hovered >= 0 && !run.isPlaced(hovered)) {
      const { closed, free } = this.scan(hovered);
      const row = problem.lessonClass[hovered];
      if (this.rowLessons[row] === hovered) picture.countRow = row;
      picture.marks = [...closed, ...free.map((candidate) => ({ ...candidate.mark, text: undefined }))];
      picture.flights = [{ lesson: hovered, from: UNASSIGNED, to: UNASSIGNED, progress: 0, tone: "plain" }];
      return picture;
    }
    if (!scene) return picture;
    const { lesson, slot } = scene;
    const waiting = { lesson, from: UNASSIGNED, to: UNASSIGNED, progress: 0, tone: "plain" as const };
    if (scene.phase === "pick") {
      picture.countRow = problem.lessonClass[lesson];
      picture.marks = [...scene.closed, ...scene.free.map((candidate) => ({ ...candidate.mark, text: undefined }))];
      picture.flights = [waiting];
    } else if (scene.phase === "judge") {
      const seen = Math.max(1, Math.ceil(Math.min(1, scene.progress / SETTLE) * scene.free.length));
      const leader = scene.free.slice(0, seen).reduce((best, candidate) => (candidate.penalty < best.penalty ? candidate : best));
      picture.marks = scene.free.map((candidate, index) =>
        index < seen ? { ...candidate.mark, ring: candidate === leader, tag: candidate === leader } : { ...candidate.mark, text: undefined },
      );
      picture.flights = [waiting];
    } else if (slot !== UNASSIGNED) {
      picture.flights = [{ ...waiting, to: slot, progress: Math.min(1, scene.progress / LANDING) }];
    }
    return picture;
  }

  refresh() {
    const cost = this.finished ? `<div class="tile warn"><span>${Lang.t("tile.penalty")}</span><b>${Format.count(this.evaluation().cost)}</b></div>` : "";
    this.panel.innerHTML =
      `<div class="tiles"><div class="tile plain"><span>${Lang.t("tile.placed")}</span><b>${this.placed} / ${this.total}</b></div>` +
      `<div class="tile bad"><span>${Lang.t("tile.unplaced")}</span><b class="${this.unplaced > 0 ? "bad" : ""}">${this.unplaced}</b></div>${cost}</div>`;
  }

  get hoverable(): boolean {
    return true;
  }

  get score(): number | undefined {
    return this.finished ? this.evaluation().cost : undefined;
  }

  tightest(row: number): number {
    return this.counts()[row] < 0 ? -1 : this.rowLessons[row];
  }

  note(lesson: number): string {
    const { run, names } = this;
    if (run.isPlaced(lesson)) return "";
    this.counts();
    const free = run.freeSlotsOf(lesson);
    const places = Lang.t("dsatur.note.places", { n: free });
    if (lesson === run.peek()) return Lang.t("dsatur.note.next", { places });
    if (lesson === this.rowLessons[this.problem.lessonClass[lesson]]) return Lang.t("dsatur.note.class", { places, class: names.className(lesson) });
    return places;
  }

  protected open(duration: number): PlacementScene | undefined {
    const lesson = this.run.peek();
    if (lesson === undefined) return undefined;
    return { progress: 0, duration: duration * SHARE.pick, whole: duration, more: true, phase: "pick", lesson, ...this.scan(lesson), affected: 0 };
  }

  private scan(lesson: number): { slot: number; closed: Mark[]; free: Candidate[] } {
    const { problem, run } = this;
    const row = problem.lessonClass[lesson];
    const base = row * problem.nSlots;
    const closed: Mark[] = [];
    const free: Candidate[] = [];
    let slot = UNASSIGNED;
    let least = Infinity;
    for (let s = 0; s < problem.nSlots; s++) {
      if (!problem.classAllowed[base + s] || this.classBusy[base + s]) continue;
      if (!run.isFree(lesson, s)) {
        closed.push({ row, slot: s, open: false });
        continue;
      }
      const penalty = run.penalty(lesson, s);
      free.push({ mark: { row, slot: s, open: true, text: String(penalty) }, penalty });
      if (penalty < least) {
        least = penalty;
        slot = s;
      }
    }
    return { slot, closed, free };
  }

  protected follow(scene: PlacementScene): PlacementScene {
    if (scene.phase === "pick" && scene.slot !== UNASSIGNED) return { ...scene, progress: 0, phase: "judge", duration: scene.whole * SHARE.judge };
    return { ...scene, progress: 0, phase: "move", more: false, duration: scene.whole * SHARE.move, affected: this.place() };
  }

  protected burst(count: number) {
    for (let i = 0; i < count && !this.finished; i++) this.place();
  }

  protected narrate(scene: PlacementScene | undefined): string {
    const { names } = this;
    if (scene) {
      const lesson = `<b>${names.lesson(scene.lesson)}</b>`;
      if (scene.phase === "pick") {
        const closed = scene.closed.length > 0 ? Lang.t("dsatur.pick.closed") : "";
        return this.say(1, 3, Lang.t("dsatur.pick.title"), Lang.t("dsatur.pick.text", { lesson, n: scene.free.length, closed }));
      }
      if (scene.phase === "judge") {
        return this.say(2, 3, Lang.t("dsatur.judge.title"), Lang.t("dsatur.judge.text", { scoring: scoring(), slot: names.slot(scene.slot) }));
      }
      if (scene.slot === UNASSIGNED) return this.say(3, 3, Lang.t("dsatur.none.title"), Lang.t("dsatur.none.text", { lesson }));
      const lost = scene.affected > 0 ? Lang.t("dsatur.place.lost", { n: scene.affected }) : "";
      return this.say(3, 3, Lang.t("dsatur.place.title"), Lang.t("dsatur.place.text", { lesson, slot: names.slot(scene.slot), lost }));
    }
    if (!this.finished) return Lang.t("dsatur.running", { placed: this.placed, total: this.total });
    const { cost, hard } = this.evaluation();
    const placed = this.unplaced === 0 ? Lang.t("dsatur.done.all", { total: this.total }) : Lang.t("dsatur.done.some", { placed: this.placed, total: this.total });
    const unplaced = this.unplaced > 0 ? Lang.t("dsatur.done.unplaced", { n: this.unplaced }) : "";
    const rules = hard.total === 0 ? Lang.t("dsatur.done.clean") : Lang.t("dsatur.done.broken", { n: hard.total, unplaced });
    return Lang.t("dsatur.done.text", { placed, rules, n: Trouble.count(this.trouble()), cost });
  }

  private counts(): Int32Array {
    if (this.countedAt === this.done) return this.rowCounts;
    const { run, problem, rowCounts, rowLessons } = this;
    rowCounts.fill(-1);
    for (let lesson = 0; lesson < problem.nLessons; lesson++) {
      if (run.isPlaced(lesson)) continue;
      const row = problem.lessonClass[lesson];
      const free = run.freeSlotsOf(lesson);
      const best = rowLessons[row];
      if (rowCounts[row] >= 0 && (free > rowCounts[row] || (free === rowCounts[row] && run.openDegreeOf(lesson) <= run.openDegreeOf(best)))) continue;
      rowCounts[row] = free;
      rowLessons[row] = lesson;
    }
    this.countedAt = this.done;
    return rowCounts;
  }

  private place(): number {
    const { run, problem } = this;
    const lesson = run.peek()!;
    const waiting = Array.from(problem.neighbours(lesson)).filter((other) => !run.isPlaced(other));
    const before = waiting.map((other) => run.freeSlotsOf(other));
    const step = run.step()!;
    if (step.slot === UNASSIGNED) {
      this.unplaced++;
      return 0;
    }
    this.placed++;
    this.classBusy[problem.lessonClass[lesson] * problem.nSlots + step.slot] = 1;
    return waiting.filter((other, index) => run.freeSlotsOf(other) < before[index]).length;
  }

  private trouble(): Uint8Array {
    this.flags ??= Trouble.of(this.problem, this.run.current);
    return this.flags;
  }

  private evaluation(): Evaluation {
    this.outcome ??= Timetable.from(this.problem, this.run.current).evaluation();
    return this.outcome;
  }
}

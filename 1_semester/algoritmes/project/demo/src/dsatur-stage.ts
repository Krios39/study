import type { Evaluation } from "../../src/core/cost.ts";
import type { Problem } from "../../src/core/problem.ts";
import { Timetable } from "../../src/core/timetable.ts";
import { UNASSIGNED } from "../../src/model.ts";
import { DEFAULT_SLOT_WEIGHTS, Dsatur, type DsaturRun } from "../../src/solvers/dsatur.ts";
import { Picture, type Mark } from "./board.ts";
import { Format } from "./format.ts";
import type { Pace } from "./pace.ts";
import { SETTLE, Stage, type Scene } from "./stage.ts";

type Phase = "pick" | "judge" | "move";

interface Candidate {
  mark: Mark;
  penalty: number;
}

interface PlacementScene extends Scene {
  phase: Phase;
  lesson: number;
  slot: number;
  blocked: Mark[];
  candidates: Candidate[];
  rival: number;
  rivalMarks: Mark[];
  affected: number[];
}

const PHASES: Phase[] = ["pick", "judge", "move"];
const PHASE_LABELS = ["Count the places left", "Score every free slot", "Move and close the slot"];
const PICK_KEYS =
  '<div class="keys"><i class="swatch good"></i>can go here<span class="side teachers">Teacher</span><i class="swatch bad"></i>busy or away</div>';
const SCORE_KEYS =
  `<div class="keys"><i class="swatch good"></i>penalty points<span class="side students">Students</span>+${DEFAULT_SLOT_WEIGHTS.gap} per free period it leaves · ` +
  `+${DEFAULT_SLOT_WEIGHTS.sameSubjectInDay} same subject again that day · +${DEFAULT_SLOT_WEIGHTS.dayLoad} per lesson already that day` +
  '<span class="side teachers">Teacher</span><i class="swatch bad"></i>busy or away</div>';
const PHASE_SHARE: Record<Phase, number> = { pick: 0.45, judge: 0.3, move: 0.25 };
const COUNT_END = 0.5;
const RIVAL_START = 0.58;
const RIVAL_END = 0.88;
const LANDING = 0.6;
const AUTO_SECONDS = 25;
const AUTO_START_RATE = 1;
const SPARKS_PER_BURST = 60;

export class DsaturStage extends Stage<PlacementScene> {
  readonly about =
    "<p>Every waiting lesson has a week of places where it can still go. " +
    "Each placed lesson closes that slot for its class and its teacher, so the other lessons lose places.</p>" +
    "<p><b>DSATUR</b> always takes the lesson with the fewest places left, gives every free slot of its class penalty points and moves it to the slot with the fewest points.</p>" +
    '<p class="legend"><i class="swatch good"></i>can go here, the number is its penalty points. <i class="swatch bad"></i>cannot go here.</p>';
  private readonly run: DsaturRun;
  private readonly classBusy: Uint8Array;
  private placed = 0;
  private unplaced = 0;
  private outcome: Evaluation | undefined;

  constructor(problem: Problem) {
    super(problem);
    this.run = Dsatur.recommended().start(problem);
    this.classBusy = new Uint8Array(problem.nClasses * problem.nSlots);
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

  plan(pace: Pace) {
    pace.plan(this.total, AUTO_SECONDS, AUTO_START_RATE);
  }

  picture(): Picture {
    const { run, scene } = this;
    const picture = new Picture(run.current);
    picture.gaps = this.finished;
    picture.flashes = this.flashes();
    if (!scene) return picture;
    const { lesson, slot } = scene;
    if (scene.phase === "pick") {
      picture.dimPool = true;
      const counted = Math.ceil(Math.min(1, scene.progress / COUNT_END) * scene.candidates.length);
      picture.marks = [...scene.blocked, ...scene.candidates.slice(0, counted).map((candidate) => ({ ...candidate.mark, text: undefined }))];
      picture.badges = [{ row: this.problem.lessonClass[lesson], text: String(counted), strong: true }];
      if (scene.rival >= 0 && scene.progress > RIVAL_START) {
        const seen = Math.ceil(Math.min(1, (scene.progress - RIVAL_START) / (RIVAL_END - RIVAL_START)) * scene.rivalMarks.length);
        picture.marks.push(...scene.rivalMarks.slice(0, seen));
        picture.badges.push({ row: this.problem.lessonClass[scene.rival], text: String(seen), strong: false });
        picture.flashes.push({ lesson: scene.rival, tone: "plain", alpha: 1 });
      }
      picture.flights = [{ lesson, from: UNASSIGNED, to: UNASSIGNED, progress: 0, tone: "plain" }];
      return picture;
    }
    if (slot === UNASSIGNED) {
      picture.marks = scene.blocked;
      picture.flashes.push({ lesson, tone: "bad", alpha: 1 });
      return picture;
    }
    if (scene.phase === "judge") {
      const seen = Math.max(1, Math.ceil(Math.min(1, scene.progress / SETTLE) * scene.candidates.length));
      const revealed = scene.candidates.slice(0, seen);
      const leader = revealed.reduce((best, candidate) => (candidate.penalty < best.penalty ? candidate : best));
      picture.marks = [
        ...scene.blocked,
        ...scene.candidates.map((candidate, index) =>
          index < seen
            ? { ...candidate.mark, ring: candidate === leader, tag: candidate === leader || (scene.progress < SETTLE && index === seen - 1) }
            : { ...candidate.mark, text: undefined },
        ),
      ];
      const at = scene.progress >= SETTLE ? slot : revealed[revealed.length - 1].mark.slot;
      picture.flights = [{ lesson, from: at, to: at, progress: 0, tone: "plain" }];
      return picture;
    }
    if (scene.progress < LANDING) {
      picture.marks = scene.candidates.map((candidate) => ({ ...candidate.mark, ring: candidate.mark.slot === slot, tag: candidate.mark.slot === slot }));
      picture.flights = [{ lesson, from: UNASSIGNED, to: slot, progress: scene.progress / LANDING, tone: "plain" }];
    } else {
      picture.bands = [slot];
      picture.bandTone = "bad";
      for (const other of scene.affected) picture.flashes.push({ lesson: other, tone: "bad", alpha: 1 });
    }
    return picture;
  }

  refresh() {
    const tiles =
      `<div class="tiles"><div class="tile"><span>Placed</span><b>${this.placed} / ${this.total}</b></div>` +
      `<div class="tile"><span>Rules broken</span><b class="${this.broken > 0 ? "bad" : ""}">${this.broken}</b></div>` +
      `<div class="tile"><span>Cost</span><b>${this.finished ? Format.count(this.evaluation().cost) : "…"}</b></div></div>`;
    this.panel.innerHTML = tiles;
  }

  protected open(duration: number): PlacementScene | undefined {
    const lesson = this.run.peek();
    if (lesson === undefined) return undefined;
    const { problem, run } = this;
    const row = problem.lessonClass[lesson];
    const base = row * problem.nSlots;
    const blocked: Mark[] = [];
    const candidates: Candidate[] = [];
    let slot = UNASSIGNED;
    let least = Infinity;
    for (let s = 0; s < problem.nSlots; s++) {
      if (!problem.classAllowed[base + s]) continue;
      if (this.classBusy[base + s]) continue;
      if (!run.isFree(lesson, s)) {
        blocked.push({ row, slot: s, tone: "bad", level: 1, ring: false });
      } else {
        const penalty = run.penalty(lesson, s);
        candidates.push({ mark: { row, slot: s, tone: "good", level: 0, ring: false, text: String(penalty) }, penalty });
        if (penalty < least) {
          least = penalty;
          slot = s;
        }
      }
    }
    let rival = -1;
    for (let other = 0; other < problem.nLessons; other++) {
      if (run.isPlaced(other) || problem.lessonClass[other] === row) continue;
      const tighter = rival < 0 || run.freeSlotsOf(other) < run.freeSlotsOf(rival);
      if (tighter || (run.freeSlotsOf(other) === run.freeSlotsOf(rival) && run.openDegreeOf(other) > run.openDegreeOf(rival))) rival = other;
    }
    const rivalMarks: Mark[] = [];
    if (rival >= 0) {
      const rivalRow = problem.lessonClass[rival];
      for (let s = 0; s < problem.nSlots; s++) {
        const key = rivalRow * problem.nSlots + s;
        if (problem.classAllowed[key] && !this.classBusy[key] && run.isFree(rival, s)) rivalMarks.push({ row: rivalRow, slot: s, tone: "good", level: 0, ring: false });
      }
    }
    return { progress: 0, duration: duration * PHASE_SHARE.pick, more: true, phase: "pick", lesson, slot, blocked, candidates, rival, rivalMarks, affected: [] };
  }

  protected follow(scene: PlacementScene): PlacementScene {
    const whole = scene.duration / PHASE_SHARE[scene.phase];
    if (scene.phase === "pick") return { ...scene, progress: 0, phase: "judge", duration: whole * PHASE_SHARE.judge };
    return { ...scene, progress: 0, phase: "move", more: false, duration: whole * PHASE_SHARE.move, affected: this.place() };
  }

  protected burst(count: number) {
    for (let i = 0; i < count && !this.finished; i++) {
      const lesson = this.run.peek()!;
      this.place();
      if (count - i <= SPARKS_PER_BURST) this.spark(lesson, this.run.current[lesson] === UNASSIGNED ? "bad" : "plain");
    }
  }

  protected narrate(scene: PlacementScene | undefined): string {
    if (scene) return this.phases(PHASE_LABELS, PHASES.indexOf(scene.phase)) + this.strip(scene);
    if (!this.finished) return `Placing lessons, fewest places left first: ${this.placed} of ${this.total} placed.`;
    const { cost, hard } = this.evaluation();
    const placed = this.unplaced === 0 ? `all ${this.total} lessons are placed` : `${this.placed} lessons placed, ${this.unplaced} did not fit`;
    if (hard.total === 0) return `Done: ${placed} and no rule is broken. Cost of this timetable: <b>${Format.count(cost)}</b> — step 2 will lower it.`;
    const gaps = hard.classGap > 0 ? ` (red cells: ${hard.classGap} free periods inside a class day)` : "";
    return `Done: ${placed}, but <b class="bad">${hard.total} rules are broken</b>${gaps}. Cost: <b>${Format.count(cost)}</b> — step 2 will repair it.`;
  }

  private get broken(): number {
    return this.finished ? this.evaluation().hard.total : this.unplaced;
  }

  private strip(scene: PlacementScene): string {
    const { names } = this;
    const name = `<b>${names.lesson(scene.lesson)}</b>`;
    if (scene.phase === "pick") {
      const places = scene.candidates.length;
      const against = scene.rival < 0 ? "" : ` · tightest in another class: ${names.lesson(scene.rival)}, ${scene.rivalMarks.length}`;
      const tied = scene.rival >= 0 && scene.rivalMarks.length === places;
      const tie = tied && this.run.openDegreeOf(scene.lesson) > this.run.openDegreeOf(scene.rival) ? " · tie goes to the one that blocks more lessons" : "";
      return `<div class="line">${name}<small>fewest places left goes first: ${places}${against}${tie}</small></div>` + PICK_KEYS;
    }
    if (scene.slot === UNASSIGNED) return `<div class="line">${name}<small class="bad">no place left — does not fit, step 2 repairs it</small></div>`;
    if (scene.phase === "judge") return `<div class="line">${name}<small>fewest points wins → ${names.slot(scene.slot)}</small></div>` + SCORE_KEYS;
    const closed = scene.affected.length > 0 ? ` · ${scene.affected.length} waiting lessons lose this place` : "";
    return `<div class="line">${name}<small>→ ${names.slot(scene.slot)}${closed}</small></div>`;
  }

  private place(): number[] {
    const { run, problem } = this;
    const lesson = run.peek()!;
    const waiting = Array.from(problem.neighbours(lesson)).filter((other) => !run.isPlaced(other));
    const before = waiting.map((other) => run.freeSlotsOf(other));
    const step = run.step()!;
    if (step.slot === UNASSIGNED) {
      this.unplaced++;
      return [];
    }
    this.placed++;
    this.classBusy[problem.lessonClass[lesson] * problem.nSlots + step.slot] = 1;
    return waiting.filter((other, index) => run.freeSlotsOf(other) < before[index]);
  }

  private evaluation(): Evaluation {
    this.outcome ??= Timetable.from(this.problem, this.run.current).evaluation();
    return this.outcome;
  }
}

import { DEFAULT_COST_WEIGHTS, type CostBreakdown, type Evaluation } from "../../src/core/cost.ts";
import type { Problem } from "../../src/core/problem.ts";
import { Timetable } from "../../src/core/timetable.ts";
import { UNASSIGNED } from "../../src/model.ts";
import { Annealing, DEFAULT_END_TEMPERATURE, DEFAULT_START_TEMPERATURE, type AnnealingRun } from "../../src/solvers/annealing.ts";
import { Dsatur } from "../../src/solvers/dsatur.ts";
import { DEFAULT_EVALUATIONS_PER_LESSON } from "../../src/solvers/local-search.ts";
import type { MoveKind } from "../../src/solvers/moves.ts";
import { Picture, type Link } from "./board.ts";
import { CostChart, type Series } from "./chart.ts";
import { Dom } from "./dom.ts";
import { Format } from "./format.ts";
import type { Pace } from "./pace.ts";
import { SETTLE, Stage, type Scene } from "./stage.ts";
import { Theme, type Tone } from "./theme.ts";

type Phase = "propose" | "build" | "price" | "decide";

interface MoveScene extends Scene {
  kind: MoveKind;
  phase: Phase;
  whole: number;
  lessons: number[];
  from: number[];
  to: number[];
  delta: number;
  accepted: boolean;
  links: Link[];
  hops: string[];
  wish: string;
  proposal: string;
  price: string;
  verdict: string;
}

const PHASE_LABELS: Record<Phase, string> = {
  propose: "Propose a random change",
  build: "Build the chain",
  price: "Price the change",
  decide: "Decide: keep it or not",
};
const PLAIN_PHASES: Phase[] = ["propose", "price", "decide"];
const CHAIN_PHASES: Phase[] = ["propose", "build", "price", "decide"];
const SHARE: Record<Phase, number> = { propose: 0.2, build: 0.45, price: 0.25, decide: 0.3 };

type Side = "students" | "teachers" | "both";

interface Term {
  side: Side;
  label: string;
  read: (evaluation: Evaluation) => number;
  digits: number;
}

const AUTO_SECONDS = 40;
const MAX_EVALUATIONS = 1_000_000;
const AUTO_START_RATE = 0.8;
const CHAIN_PATIENCE = 300;
const FRAME_BUDGET_MS = 12;
const SPARKED_MOVES_PER_BURST = 30;
const REFERENCE_WORSENING = 10;

const TERMS: Term[] = [
  { side: "both", label: "Lessons not placed", read: (e) => e.hard.unassigned, digits: 0 },
  { side: "students", label: "Two lessons at once", read: (e) => e.hard.classClash, digits: 0 },
  { side: "students", label: "Free period inside the day", read: (e) => e.hard.classGap + e.hard.classSlot, digits: 0 },
  { side: "students", label: "Same subject twice in a day", read: (e) => e.soft.sameSubjectInDay, digits: 0 },
  { side: "students", label: "Uneven difficulty between days", read: (e) => e.soft.difficultySpread, digits: 1 },
  { side: "students", label: "Hard lesson late or easy lesson early", read: (e) => e.soft.misplaced, digits: 0 },
  { side: "students", label: "Uneven number of lessons per day", read: (e) => e.soft.dayImbalance, digits: 0 },
  { side: "teachers", label: "Two classes at once", read: (e) => e.hard.teacherClash, digits: 0 },
  { side: "teachers", label: "Lesson when the teacher is away", read: (e) => e.hard.teacherUnavailable, digits: 0 },
  { side: "teachers", label: "Free periods between lessons", read: (e) => e.soft.teacherGaps, digits: 0 },
  { side: "teachers", label: "Days split between two shifts", read: (e) => e.soft.shiftBreaks, digits: 0 },
  { side: "teachers", label: "Wishes ignored", read: (e) => e.soft.wishesBroken, digits: 0 },
];

const PARTS: { key: keyof CostBreakdown; side: Side; label: string }[] = [
  { key: "unassigned", side: "both", label: "lesson not placed" },
  { key: "classClash", side: "students", label: "two lessons at once" },
  { key: "classGap", side: "students", label: "free period inside the day" },
  { key: "sameSubjectInDay", side: "students", label: "same subject twice in a day" },
  { key: "difficulty", side: "students", label: "uneven difficulty between days" },
  { key: "misplaced", side: "students", label: "hard lesson late or easy lesson early" },
  { key: "dayImbalance", side: "students", label: "uneven number of lessons per day" },
  { key: "teacherClash", side: "teachers", label: "two classes at once" },
  { key: "teacherUnavailable", side: "teachers", label: "lesson when the teacher is away" },
  { key: "teacherGap", side: "teachers", label: "free periods between lessons" },
  { key: "shiftBreak", side: "teachers", label: "day split between two shifts" },
  { key: "teacherWish", side: "teachers", label: "wish ignored" },
];

const SIDES: { side: Side; title: string }[] = [
  { side: "both", title: "Everyone" },
  { side: "students", title: "Students" },
  { side: "teachers", title: "Teachers" },
];

export class AnnealingStage extends Stage<MoveScene> {
  readonly about: string;
  private readonly withKempe: boolean;
  private readonly start: Int32Array;
  private readonly startEvaluation: Evaluation;
  private readonly run: AnnealingRun;
  private readonly rival: AnnealingRun | undefined;
  private readonly chart: CostChart;
  private readonly fill: HTMLElement;
  private readonly heatText: HTMLElement;
  private readonly heatHint: HTMLElement;
  private readonly tiles: HTMLElement;
  private readonly terms: HTMLElement;
  private readonly counts: HTMLElement;
  private heat = DEFAULT_START_TEMPERATURE;
  private best: Int32Array | undefined;
  private final: Timetable | undefined;

  constructor(problem: Problem, withKempe: boolean) {
    super(problem);
    this.withKempe = withKempe;
    this.about = withKempe ? AnnealingStage.KEMPE_ABOUT : AnnealingStage.PLAIN_ABOUT;
    this.start = Dsatur.recommended().solve(problem).slotOf;
    this.startEvaluation = Timetable.from(problem, this.start).evaluation();
    const evaluations = Math.min(problem.nLessons * DEFAULT_EVALUATIONS_PER_LESSON, MAX_EVALUATIONS);
    this.run = new Annealing(withKempe ? { evaluations } : { evaluations, kempeShare: 0 }).start(problem, this.start);
    this.rival = withKempe ? new Annealing({ evaluations, kempeShare: 0 }).start(problem, this.start) : undefined;

    const series: Series[] = [{ label: withKempe ? "with Kempe chains" : "cost", tone: withKempe ? "kempe" : "plain" }];
    if (withKempe) series.push({ label: "without chains", tone: "warn" });
    const meter = Dom.make("div", "meter");
    const tube = Dom.make("div", "thermo");
    this.fill = Dom.make("i");
    tube.append(this.fill);
    const reading = Dom.make("div", "reading");
    this.heatText = Dom.make("b");
    this.heatHint = Dom.make("span");
    reading.append(this.heatText, this.heatHint);
    meter.append(tube, reading);
    this.tiles = Dom.make("div", "tiles");
    const canvas = Dom.make("canvas", "chart");
    this.chart = new CostChart(canvas, this.run.budget, series);
    const legend = Dom.make("p", "legend", series.map((line) => `<i class="swatch ${line.tone === "plain" ? "accent" : line.tone}"></i>${line.label}`).join(" "));
    this.terms = Dom.make("table", "terms");
    this.counts = Dom.make("p", "counts");
    this.panel.append(meter, this.tiles, canvas, legend, this.terms, this.counts);
    this.record();
  }

  private static readonly PLAIN_ABOUT =
    "<p>The DSATUR timetable is valid but clumsy. Its quality is a <b>cost</b>: 1000 points for every clash or unplaced lesson, " +
    "plus smaller penalties — repeated subjects, uneven days, free periods of teachers…</p>" +
    "<p><b>Annealing</b> tries random small changes: move one lesson, or swap two lessons of a class. " +
    "A change that lowers the cost is always kept. A change that raises it is kept <b>sometimes</b>: often while the temperature is high, almost never once it is low. " +
    "Early freedom lets the search leave dead ends, late strictness lets it settle.</p>" +
    '<p class="legend"><i class="swatch good"></i>kept, better <i class="swatch warn"></i>kept, worse <i class="swatch bad"></i>rejected or clash</p>';

  private static readonly KEMPE_ABOUT =
    "<p>A single move usually fails: the target slot is already taken by the same class or teacher, so it creates a clash.</p>" +
    "<p>A <b>Kempe chain</b> solves this. Take two time slots (the two shaded columns), start from one lesson and collect every lesson that blocks it on the other side, " +
    "then every lesson that blocks those, and so on. Swapping the whole group between the two slots can never create a clash.</p>" +
    "<p>Half of the attempts here are chains. The orange line is the same annealing <b>without</b> chains, given exactly the same number of attempts.</p>" +
    '<p class="legend"><i class="swatch accent"></i>link: same class <i class="swatch kempe dashed"></i>link: same teacher</p>';

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

  plan(pace: Pace) {
    pace.plan(this.total, AUTO_SECONDS, AUTO_START_RATE);
  }

  tick(seconds: number, rate: number) {
    super.tick(seconds, rate);
    this.record();
  }

  picture(): Picture {
    if (this.finished && !this.scene) {
      this.best ??= this.run.result().slotOf;
      return new Picture(this.best);
    }
    const { scene } = this;
    const current = this.run.timetable.slotOf;
    if (!scene) {
      const idle = new Picture(current);
      idle.flashes = this.flashes();
      return idle;
    }
    const decided = scene.phase === "decide";
    const shown = this.shown(scene);
    const slotOf = Int32Array.from(current);
    scene.lessons.forEach((lesson, index) => {
      if (index >= shown) slotOf[lesson] = scene.from[index];
    });
    const picture = new Picture(slotOf);
    picture.flashes = this.flashes();
    const after = decided ? Math.min(1, scene.progress) : 0;
    const proposalTone: Tone = scene.kind === "kempe" ? "kempe" : "plain";
    const verdictTone: Tone = !scene.accepted ? "bad" : scene.delta > 0 ? "warn" : "good";
    const tone = decided ? verdictTone : proposalTone;
    const lessons = scene.lessons.slice(0, shown);
    picture.bands = [...new Set([...scene.from, ...scene.to])];
    picture.links = decided && scene.accepted ? [] : scene.links.slice(0, Math.max(0, shown - 1));
    picture.arrows = lessons.map((lesson, index) => ({ lesson, from: scene.from[index], to: scene.to[index], tone, alpha: decided ? 1 - 0.8 * after : 1 }));
    if (scene.accepted) {
      picture.flights = lessons.map((lesson, index) => ({ lesson, from: scene.from[index], to: scene.to[index], progress: after, tone }));
    } else {
      for (const lesson of lessons) picture.flashes.push({ lesson, tone: decided ? "bad" : proposalTone, alpha: 1 });
    }
    return picture;
  }

  refresh() {
    const { run, rival } = this;
    const temperature = run.currentTemperature;
    const level = Math.log(temperature / DEFAULT_END_TEMPERATURE) / Math.log(DEFAULT_START_TEMPERATURE / DEFAULT_END_TEMPERATURE);
    this.fill.style.height = `${Math.round(8 + 92 * Math.max(0, Math.min(1, level)))}%`;
    this.fill.style.background = `hsl(${Math.round(215 - 210 * level)} 80% 52%)`;
    this.heatText.textContent = `T = ${temperature.toFixed(1)}`;
    this.heatHint.innerHTML = `a change that is ${REFERENCE_WORSENING} points worse is kept with chance <b>${Format.percent(Math.exp(-REFERENCE_WORSENING / temperature))}</b>`;

    const shown = this.finished ? (this.final ??= Timetable.from(this.problem, run.result().slotOf)) : run.timetable;
    const tiles = [
      `<div class="tile"><span>Start</span><b>${Format.count(run.startCost)}</b></div>`,
      `<div class="tile"><span>${rival ? "Best, with chains" : "Best so far"}</span><b class="${rival ? "kempe" : "accent"}">${Format.count(run.cost)}</b></div>`,
    ];
    if (rival) tiles.push(`<div class="tile"><span>Best, without</span><b class="warn">${Format.count(rival.cost)}</b></div>`);
    else tiles.push(`<div class="tile"><span>Now</span><b>${Format.count(shown.cost)}</b></div>`);
    this.tiles.innerHTML = tiles.join("");

    const now = shown.evaluation();
    this.terms.innerHTML = SIDES.map(({ side, title }) => {
      const rows = TERMS.filter((term) => term.side === side).map((term) => {
        const before = term.read(this.startEvaluation);
        const current = term.read(now);
        const tone = current < before ? "good" : current > before ? "bad" : "";
        return `<tr><td>${term.label}</td><td>${before.toFixed(term.digits)}</td><td class="${tone}">${current.toFixed(term.digits)}</td></tr>`;
      });
      return `<tr class="group ${side}"><th>${title}</th><th>start</th><th>now</th></tr>${rows.join("")}`;
    }).join("");

    const result = run.result();
    const share = result.evaluations > 0 ? result.accepted / result.evaluations : 0;
    let counts = `<b>${Format.count(result.evaluations)}</b> of ${Format.count(this.total)} attempts · kept ${Format.percent(share)} · kept although worse: ${Format.count(result.worsening)}`;
    if (this.withKempe) {
      const { kempe } = result;
      const average = kempe.accepted > 0 ? (kempe.acceptedLengthSum / kempe.accepted).toFixed(1) : "–";
      counts += `<br>chains tried: ${Format.count(kempe.tried)} · kept: ${Format.count(kempe.accepted)} · average kept chain: ${average} lessons · longest seen: ${kempe.longest}`;
    }
    this.counts.innerHTML = counts;
    this.chart.draw(Theme.read());
  }

  protected open(duration: number): MoveScene | undefined {
    const { run } = this;
    for (let tries = 0; !run.finished; tries++) {
      this.advance();
      if (!run.last.sampled) continue;
      const chain = run.sampler.kind === "kempe" && run.sampler.length > 1;
      if (!this.withKempe || chain || tries >= CHAIN_PATIENCE) return this.describe(duration);
      this.sparkLast();
    }
    return undefined;
  }

  protected follow(scene: MoveScene): MoveScene {
    const order = this.sequence(scene);
    const phase = order[order.indexOf(scene.phase) + 1];
    const stretch = phase === "build" ? Math.max(1, (scene.lessons.length - 1) / 2) : 1;
    return { ...scene, progress: 0, phase, more: phase !== "decide", duration: scene.whole * SHARE[phase] * stretch };
  }

  protected burst(count: number) {
    const { run } = this;
    const deadline = performance.now() + FRAME_BUDGET_MS;
    const sparkChance = SPARKED_MOVES_PER_BURST / count;
    for (let i = 0; i < count && !run.finished; i++) {
      if ((i & 255) === 255 && performance.now() > deadline) break;
      this.advance();
      if (Math.random() < sparkChance) this.sparkLast();
    }
  }

  protected narrate(scene: MoveScene | undefined): string {
    if (scene) {
      const order = this.sequence(scene);
      const head = order === CHAIN_PHASES && scene.phase === "propose" ? scene.wish : scene.proposal;
      let body = "";
      if (scene.phase === "build") body = this.trail(scene);
      else if (scene.phase === "price") body = scene.price;
      else if (scene.phase === "decide") body = scene.price + scene.verdict;
      return this.phases(order.map((phase) => PHASE_LABELS[phase]), order.indexOf(scene.phase)) + `<div class="line">${head}</div>` + body;
    }
    const { run, rival } = this;
    if (!this.finished) {
      return `Trying random changes: ${Format.count(run.evaluations)} of ${Format.count(this.total)} attempts, cost <b>${Format.count(run.timetable.cost)}</b>.`;
    }
    const summary = `Done: cost <b>${Format.count(run.startCost)} → ${Format.count(run.cost)}</b> after ${Format.count(this.total)} attempts.`;
    if (!rival) return `${summary} Step 3 adds Kempe chains to go lower.`;
    const gain = 1 - run.cost / rival.cost;
    const comparison =
      gain > 0.005
        ? `that is <b class="good">${Format.percent(gain)} lower</b>`
        : gain < -0.005
          ? `on this school the chains did not help (${Format.percent(-gain)} higher)`
          : "about the same on this school";
    return `${summary} Without chains the same number of attempts ends at ${Format.count(rival.cost)} — ${comparison}.`;
  }

  private advance() {
    this.heat = this.run.currentTemperature;
    this.run.advance();
    this.rival?.advance();
  }

  private record() {
    const values = [this.run.timetable.cost];
    if (this.rival) values.push(this.rival.timetable.cost);
    this.chart.add(this.run.evaluations, values);
  }

  private sparkLast() {
    const { last, sampler } = this.run;
    if (!last.sampled || !last.accepted) return;
    const tone: Tone = sampler.kind === "kempe" ? "kempe" : last.delta > 0 ? "warn" : "good";
    for (let i = 0; i < sampler.length; i++) this.spark(sampler.lessons[i], tone);
  }

  private sequence(scene: MoveScene): Phase[] {
    return scene.kind === "kempe" && scene.lessons.length > 1 ? CHAIN_PHASES : PLAIN_PHASES;
  }

  private shown(scene: MoveScene): number {
    const count = scene.lessons.length;
    if (this.sequence(scene) === PLAIN_PHASES) return count;
    if (scene.phase === "propose") return 1;
    if (scene.phase === "build") return 1 + Math.ceil(Math.min(1, scene.progress / SETTLE) * (count - 1));
    return count;
  }

  private trail(scene: MoveScene): string {
    const shown = this.shown(scene);
    const closed = shown === scene.lessons.length && scene.progress >= SETTLE ? '<span class="end">nobody else is in the way — the chain is closed</span>' : "";
    return `<div class="chain">${scene.hops.slice(0, shown).join("")}${closed}</div>`;
  }

  private describe(duration: number): MoveScene {
    const { names, problem } = this;
    const { sampler, last } = this.run;
    const lessons = Array.from(sampler.lessons.subarray(0, sampler.length));
    const from = Array.from(sampler.from.subarray(0, sampler.length));
    const to = Array.from(sampler.to.subarray(0, sampler.length));
    const chain = sampler.kind === "kempe" && lessons.length > 1;
    const links: Link[] = [];
    const hops: string[] = [];
    if (chain) {
      lessons.forEach((lesson, index) => {
        const parent = lessons.findIndex((other, at) => at < index && from[at] !== from[index] && problem.neighbours(other).includes(lesson));
        let why = "start";
        if (parent >= 0) {
          const sameClass = problem.lessonClass[lessons[parent]] === problem.lessonClass[lesson];
          links.push({ from: lessons[parent], fromSlot: from[parent], to: lesson, toSlot: from[index], sameClass });
          why = `in the way · ${sameClass ? "same class" : "same teacher"}`;
        }
        hops.push(`<span><em>${index + 1} · ${why}</em><b>${names.lesson(lesson)}</b><small>${names.slot(from[index])} → ${names.slot(to[index])}</small></span>`);
      });
    }
    const order = chain ? CHAIN_PHASES : PLAIN_PHASES;
    const whole = duration / order.reduce((sum, phase) => sum + SHARE[phase], 0);
    return {
      progress: 0,
      duration: whole * SHARE.propose,
      whole,
      more: true,
      phase: "propose",
      kind: sampler.kind,
      lessons,
      from,
      to,
      delta: last.delta,
      accepted: last.accepted,
      links,
      hops,
      wish: `<b>${names.lesson(lessons[0])}</b><small>wants ${names.slot(to[0])} instead of ${names.slot(from[0])}</small>`,
      proposal: this.proposal(sampler.kind, lessons, from, to),
      price: this.price(lessons, from, to, last.delta),
      verdict: this.verdict(last.delta, last.accepted, last.roll),
    };
  }

  private price(lessons: number[], from: number[], to: number[], delta: number): string {
    const now = this.run.timetable.slotOf;
    const before = Int32Array.from(now);
    lessons.forEach((lesson, index) => (before[lesson] = from[index]));
    const table = Timetable.from(this.problem, before);
    const cost = table.cost;
    const was = table.breakdown();
    lessons.forEach((lesson, index) => table.move(lesson, to[index]));
    const next = table.breakdown();
    const chips = PARTS.map(({ key, side, label }) => {
      const points = next[key] - was[key];
      if (Math.abs(points) < 0.05) return "";
      const pill = side === "both" ? "" : `<i class="side ${side}">${side === "students" ? "Students" : "Teachers"}</i>`;
      return `<span class="part ${points < 0 ? "good" : "bad"}${pill ? "" : " plain"}">${pill}${label}<b>${Format.signed(points)}</b></span>`;
    }).join("");
    const total = `<span class="sum ${delta < 0 ? "good" : delta > 0 ? "bad" : ""}">= ${delta === 0 ? "0" : Format.signed(delta)}</span>`;
    return `<div class="parts"><span>cost now <b>${Format.count(cost)}</b></span>${chips || "<span>no rule is affected</span>"}${total}</div>`;
  }

  private proposal(kind: MoveKind, lessons: number[], from: number[], to: number[]): string {
    const { names } = this;
    const first = `<b>${names.lesson(lessons[0])}</b>`;
    if (kind === "swap") return `${first} ⇄ <b>${names.subject(lessons[1])}</b><small>${names.slot(from[0])} ⇄ ${names.slot(from[1])}</small>`;
    if (kind === "kempe" && lessons.length > 1) {
      return `<b>Kempe chain of ${lessons.length} lessons</b><small>${names.slot(from[0])} ⇄ ${names.slot(to[0])}</small>`;
    }
    return `${first}<small>${from[0] === UNASSIGNED ? "pile" : names.slot(from[0])} → ${names.slot(to[0])}</small>`;
  }

  private verdict(delta: number, accepted: boolean, roll: number): string {
    const clash = delta >= DEFAULT_COST_WEIGHTS.hard / 2 ? " clash" : "";
    const change =
      delta === 0
        ? '<span class="delta">cost =</span>'
        : `<span class="delta ${delta < 0 ? "good" : "bad"}">${delta < 0 ? "▼" : "▲"} cost ${Format.signed(delta)}${clash}</span>`;
    if (delta <= 0) return `<div class="decide">${change}<div class="gauge"><i style="width:100%"></i></div><b class="good">kept</b></div>`;
    const chance = Math.exp(-delta / this.heat);
    const outcome = accepted ? '<b class="warn">kept anyway</b>' : '<b class="bad">rejected</b>';
    return (
      `<div class="decide">${change}<div class="gauge" title="green zone: chance to keep ${Format.percent(chance)}; the mark is the random draw">` +
      `<i style="width:${(100 * chance).toFixed(2)}%"></i><u style="left:${(100 * roll).toFixed(2)}%"></u></div>${outcome}</div>` +
      `<div class="keys">green zone = chance to keep at T ${this.heat.toFixed(1)}: ${Format.percent(chance)} · the pin is the random draw</div>`
    );
  }
}

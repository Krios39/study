import { DEFAULT_COST_WEIGHTS, type Evaluation } from "../../src/core/cost.ts";
import type { Problem } from "../../src/core/problem.ts";
import { Timetable } from "../../src/core/timetable.ts";
import { UNASSIGNED } from "../../src/model.ts";
import { Annealing, DEFAULT_END_TEMPERATURE, DEFAULT_START_TEMPERATURE, type AnnealingRun } from "../../src/solvers/annealing.ts";
import { Dsatur } from "../../src/solvers/dsatur.ts";
import type { MoveKind } from "../../src/solvers/moves.ts";
import { Picture, type Link } from "./board.ts";
import { CostChart, type Series } from "./chart.ts";
import { Dom } from "./dom.ts";
import { Format } from "./format.ts";
import type { Pace } from "./pace.ts";
import { Stage, type Scene } from "./stage.ts";
import { Theme, type Tone } from "./theme.ts";

interface MoveScene extends Scene {
  kind: MoveKind;
  decided: boolean;
  lessons: number[];
  from: number[];
  to: number[];
  delta: number;
  accepted: boolean;
  links: Link[];
  proposal: string;
  verdict: string;
}

const PHASE_LABELS = ["Propose a random change", "Decide: keep it or not"];

type Side = "students" | "teachers" | "both";

interface Term {
  side: Side;
  label: string;
  read: (evaluation: Evaluation) => number;
  digits: number;
}

const AUTO_SECONDS = 40;
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

  constructor(problem: Problem, withKempe: boolean) {
    super(problem);
    this.withKempe = withKempe;
    this.about = withKempe ? AnnealingStage.KEMPE_ABOUT : AnnealingStage.PLAIN_ABOUT;
    this.start = Dsatur.recommended().solve(problem).slotOf;
    this.startEvaluation = Timetable.from(problem, this.start).evaluation();
    this.run = new Annealing(withKempe ? {} : { kempeShare: 0 }).start(problem, this.start);
    this.rival = withKempe ? new Annealing({ kempeShare: 0 }).start(problem, this.start) : undefined;

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
    const picture = new Picture(this.run.timetable.slotOf);
    picture.flashes = this.flashes();
    const { scene } = this;
    if (!scene) return picture;
    const { decided } = scene;
    const after = decided ? Math.min(1, scene.progress) : 0;
    const proposalTone: Tone = scene.kind === "kempe" ? "kempe" : "plain";
    const verdictTone: Tone = !scene.accepted ? "bad" : scene.delta > 0 ? "warn" : "good";
    picture.bands = [...new Set([...scene.from, ...scene.to])];
    picture.links = decided && scene.accepted ? [] : scene.links;
    picture.arrows = scene.lessons.map((lesson, index) => ({
      lesson,
      from: scene.from[index],
      to: scene.to[index],
      tone: decided ? verdictTone : proposalTone,
      alpha: decided ? 1 - 0.8 * after : 1,
    }));
    if (scene.accepted) {
      picture.flights = scene.lessons.map((lesson, index) => ({
        lesson,
        from: scene.from[index],
        to: scene.to[index],
        progress: after,
        tone: decided ? verdictTone : proposalTone,
      }));
    } else {
      for (const lesson of scene.lessons) picture.flashes.push({ lesson, tone: decided ? "bad" : proposalTone, alpha: 1 });
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

    const tiles = [
      `<div class="tile"><span>Start</span><b>${Format.count(run.startCost)}</b></div>`,
      `<div class="tile"><span>${rival ? "Best, with chains" : "Best so far"}</span><b class="${rival ? "kempe" : "accent"}">${Format.count(run.cost)}</b></div>`,
    ];
    if (rival) tiles.push(`<div class="tile"><span>Best, without</span><b class="warn">${Format.count(rival.cost)}</b></div>`);
    else tiles.push(`<div class="tile"><span>Now</span><b>${Format.count(run.timetable.cost)}</b></div>`);
    this.tiles.innerHTML = tiles.join("");

    const now = run.timetable.evaluation();
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
    return { ...scene, progress: 0, more: false, decided: true };
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
      return this.phases(PHASE_LABELS, scene.decided ? 1 : 0) + `<div class="line">${scene.proposal}</div>` + (scene.decided ? scene.verdict : "");
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

  private describe(duration: number): MoveScene {
    const { sampler, last } = this.run;
    const lessons = Array.from(sampler.lessons.subarray(0, sampler.length));
    const from = Array.from(sampler.from.subarray(0, sampler.length));
    const to = Array.from(sampler.to.subarray(0, sampler.length));
    return {
      progress: 0,
      duration: duration / 2,
      more: true,
      decided: false,
      kind: sampler.kind,
      lessons,
      from,
      to,
      delta: last.delta,
      accepted: last.accepted,
      links: sampler.kind === "kempe" ? this.chainLinks(lessons, from) : [],
      proposal: this.proposal(sampler.kind, lessons, from, to),
      verdict: this.verdict(last.delta, last.accepted, last.roll),
    };
  }

  private chainLinks(lessons: number[], from: number[]): Link[] {
    const { problem } = this;
    const links: Link[] = [];
    for (let a = 0; a < lessons.length; a++) {
      for (let b = a + 1; b < lessons.length; b++) {
        if (from[a] === from[b] || !problem.neighbours(lessons[a]).includes(lessons[b])) continue;
        const sameClass = problem.lessonClass[lessons[a]] === problem.lessonClass[lessons[b]];
        links.push({ from: lessons[a], fromSlot: from[a], to: lessons[b], toSlot: from[b], sameClass });
      }
    }
    return links;
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

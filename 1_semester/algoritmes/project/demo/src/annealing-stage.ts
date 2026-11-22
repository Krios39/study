import type { CostBreakdown } from "../../src/core/cost.ts";
import type { Problem } from "../../src/core/problem.ts";
import { Timetable } from "../../src/core/timetable.ts";
import { UNASSIGNED } from "../../src/model.ts";
import { Annealing, DEFAULT_END_TEMPERATURE, DEFAULT_START_TEMPERATURE, type AnnealingRun } from "../../src/solvers/annealing.ts";
import { Dsatur } from "../../src/solvers/dsatur.ts";
import { DEFAULT_EVALUATIONS_PER_LESSON } from "../../src/solvers/local-search.ts";
import type { MoveKind } from "../../src/solvers/moves.ts";
import { Picture, type Flight, type Link } from "./board.ts";
import { CostChart } from "./chart.ts";
import { Dom } from "./dom.ts";
import { Flame } from "./flame.ts";
import { Format } from "./format.ts";
import type { Pace } from "./pace.ts";
import { SETTLE, Stage, type Scene } from "./stage.ts";
import { Theme, type Tone } from "./theme.ts";
import { Trouble } from "./trouble.ts";

type Phase = "propose" | "stuck" | "build" | "closed" | "price" | "decide";

interface Trail {
  lesson: number;
  from: number;
  to: number;
  born: number;
}

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
  blockers: number[];
  hops: string[];
  proposal: string;
  price: string;
  verdict: string;
}

const PLAIN_PHASES: Phase[] = ["propose", "price", "decide"];
const CHAIN_PHASES: Phase[] = ["stuck", "build", "closed", "price", "decide"];
const TITLES: Record<Phase, string> = {
  propose: "Try a random change",
  stuck: "A plain move gets stuck",
  build: "The blockers move the other way",
  closed: "The chain is closed",
  price: "Better or worse?",
  decide: "Keep it or undo it",
};
const SHARE: Record<Phase, number> = { propose: 0.25, stuck: 0.2, build: 0.3, closed: 0.2, price: 0.3, decide: 0.45 };
const TRAVEL = 0.6;
const TRAIL_SECONDS = 0.18;
const ARROWS_UP_TO = 30;
const TRAIL_LIMIT = 1500;
const AUTO_SECONDS = 40;
const AUTO_START_RATE = 0.8;
const MAX_EVALUATIONS = 1_000_000;
const CHAIN_PATIENCE = 300;
const FRAME_BUDGET_MS = 12;
const REFERENCE_WORSENING = 10;
const REASONS_SHOWN = 3;

const PARTS: { key: keyof CostBreakdown; label: string }[] = [
  { key: "unassigned", label: "lesson not placed" },
  { key: "classClash", label: "class has two lessons at once" },
  { key: "classGap", label: "gap in the class day" },
  { key: "teacherClash", label: "teacher in two classes at once" },
  { key: "teacherUnavailable", label: "teacher is away" },
  { key: "sameSubjectInDay", label: "same subject twice a day" },
  { key: "difficulty", label: "uneven hard days" },
  { key: "misplaced", label: "hard lesson late or easy one early" },
  { key: "dayImbalance", label: "uneven number of lessons per day" },
  { key: "teacherGap", label: "gaps for the teacher" },
  { key: "shiftBreak", label: "teacher split between shifts" },
  { key: "teacherWish", label: "teacher's wish ignored" },
];

export class AnnealingStage extends Stage<MoveScene> {
  private readonly withKempe: boolean;
  private readonly start: Int32Array;
  private readonly startTrouble: number;
  private readonly run: AnnealingRun;
  private readonly rival: AnnealingRun | undefined;
  private readonly chart: CostChart;
  private readonly flame = new Flame();
  private readonly meter: HTMLElement;
  private readonly formula: HTMLElement;
  private readonly heatText: HTMLElement;
  private readonly heatHint: HTMLElement;
  private readonly tiles: HTMLElement;
  private readonly counts: HTMLElement;
  private heat = DEFAULT_START_TEMPERATURE;
  private flags: Uint8Array;
  private final: Timetable | undefined;
  private trails: Trail[] = [];
  private clock = 0;

  constructor(problem: Problem, withKempe: boolean) {
    super(problem);
    this.withKempe = withKempe;
    this.start = Dsatur.recommended().solve(problem).slotOf;
    this.flags = Trouble.of(problem, this.start);
    this.startTrouble = Trouble.count(this.flags);
    const evaluations = Math.min(problem.nLessons * DEFAULT_EVALUATIONS_PER_LESSON, MAX_EVALUATIONS);
    this.run = new Annealing(withKempe ? { evaluations } : { evaluations, kempeShare: 0 }).start(problem, this.start);
    this.rival = withKempe ? new Annealing({ evaluations, kempeShare: 0 }).start(problem, this.start) : undefined;

    const meter = Dom.make("div", "meter");
    this.meter = meter;
    const reading = Dom.make("div", "reading");
    this.heatText = Dom.make("b");
    this.heatHint = Dom.make("span");
    reading.append(this.heatText, this.heatHint);
    this.formula = Dom.make("div", "formula");
    meter.tabIndex = 0;
    meter.append(this.flame.canvas, reading, this.formula);
    this.tiles = Dom.make("div", "tiles");
    const canvas = Dom.make("canvas", "chart");
    this.chart = new CostChart(canvas, this.run.budget, withKempe ? 2 : 1);
    this.counts = Dom.make("p", "counts");
    this.panel.append(this.tiles, meter, canvas);
    if (withKempe) this.panel.append(Dom.make("p", "legend", '<i class="stroke"></i>with chains <i class="stroke dashed"></i>without chains'));
    this.panel.append(this.counts);
    this.record();
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

  plan(pace: Pace) {
    pace.plan(this.total, AUTO_SECONDS, AUTO_START_RATE);
  }

  get moving(): boolean {
    return this.trails.length > 0;
  }

  get score(): number | undefined {
    return this.finished ? this.run.cost : undefined;
  }

  flag(lesson: number): number {
    return this.flags[lesson];
  }

  tick(seconds: number, rate: number) {
    this.clock += seconds;
    this.flame.step(seconds, this.warmth);
    this.trails = this.trails.filter((trail) => this.clock - trail.born < TRAIL_SECONDS);
    super.tick(seconds, rate);
    this.record();
  }

  picture(): Picture {
    const { scene } = this;
    const picture = new Picture(Int32Array.from(this.shown.slotOf));
    picture.trouble = this.flags;
    if (!scene) {
      for (const { lesson, from, to, born } of this.trails) {
        const age = (this.clock - born) / TRAIL_SECONDS;
        picture.flights.push({ lesson, from, to, progress: age, tone: "plain", light: true });
        if (this.trails.length <= ARROWS_UP_TO) picture.arrows.push({ lesson, from, to, alpha: 1 - age });
      }
      return picture;
    }
    const { phase, lessons, from, to } = scene;
    lessons.forEach((lesson, index) => (picture.slotOf[lesson] = from[index]));
    const count = this.revealed(scene);
    const flight = (index: number, start: number, end: number, progress: number, tone: Tone): Flight => ({ lesson: lessons[index], from: start, to: end, progress, tone });
    const seen = lessons.slice(0, count);
    if (phase === "price" || phase === "decide") {
      const back = phase === "decide" && !scene.accepted;
      const tone: Tone = phase === "price" ? "plain" : scene.accepted ? "good" : "bad";
      const progress = phase === "decide" && scene.accepted ? 1 : Math.min(1, scene.progress / TRAVEL);
      picture.flights = lessons.map((_, index) => (back ? flight(index, to[index], from[index], progress, tone) : flight(index, from[index], to[index], progress, tone)));
      const worse = scene.delta > 0;
      picture.flights[0].note = phase === "decide" ? (scene.accepted ? "kept" : "undone") : scene.delta === 0 ? "0" : Format.signed(scene.delta);
      if (phase === "price") picture.flights[0].tone = scene.delta === 0 ? "plain" : worse ? "bad" : "good";
      return picture;
    }
    picture.flights = seen.map((_, index) => flight(index, from[index], from[index], 0, "plain"));
    if (phase === "stuck") picture.crossed = scene.blockers;
    if (phase === "propose" || phase === "stuck") {
      picture.arrows = seen.map((lesson, index) => ({ lesson, from: from[index], to: to[index] }));
    } else {
      picture.links = scene.links.slice(0, Math.max(0, count - 1));
      picture.bands = [from[0], to[0]];
    }
    return picture;
  }

  refresh() {
    const { run, rival } = this;
    const temperature = run.currentTemperature;
    this.meter.style.setProperty("--heat", this.warmth.toFixed(3));
    const chances = [10, 100, 1000].map((worse) => `<tr><td>worse by ${Format.count(worse)}</td><td>${Format.percent(Math.exp(-worse / temperature))}</td></tr>`).join("");
    this.formula.innerHTML =
      `<b>chance to keep a worse change = e<sup>−Δ / T</sup></b><span>Δ is how many penalty points worse the change is, T is the temperature.</span>` +
      `<b>T = ${DEFAULT_START_TEMPERATURE} × (${DEFAULT_END_TEMPERATURE} / ${DEFAULT_START_TEMPERATURE})<sup>done / all attempts</sup> = ${temperature.toFixed(1)}</b>` +
      `<span>It cools from ${DEFAULT_START_TEMPERATURE} to ${DEFAULT_END_TEMPERATURE} over the run. Right now:</span><table>${chances}</table>`;
    this.heatText.textContent = `Temperature ${temperature.toFixed(1)}`;
    this.heatHint.innerHTML = `a change ${REFERENCE_WORSENING} points worse is kept with chance <b>${Format.percent(Math.exp(-REFERENCE_WORSENING / temperature))}</b>`;

    const { shown } = this;
    this.flags = Trouble.of(this.problem, shown.slotOf);
    const tiles = [
      `<div class="tile bad"><span>Start penalty</span><b>${Format.count(run.startCost)}</b></div>`,
      `<div class="tile good"><span>Penalty now</span><b>${Format.count(shown.cost)}</b></div>`,
    ];
    if (rival) tiles.push(`<div class="tile warn"><span>Without chains</span><b>${Format.count(this.finished ? rival.cost : rival.timetable.cost)}</b></div>`);
    else tiles.push(`<div class="tile warn"><span>Poor places</span><b>${Trouble.count(this.flags)}</b></div>`);
    this.tiles.innerHTML = tiles.join("");
    this.counts.innerHTML = `<b>${Format.count(run.evaluations)}</b> of ${Format.count(this.total)} attempts`;
    this.chart.draw(Theme.read());
  }

  protected open(duration: number): MoveScene | undefined {
    const { run } = this;
    for (let tries = 0; !run.finished; tries++) {
      this.advance();
      if (!run.last.sampled) continue;
      const chain = run.sampler.kind === "kempe" && run.sampler.length > 1;
      if (!this.withKempe || chain || tries >= CHAIN_PATIENCE) return this.describe(duration);
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
    for (let i = 0; i < count && !run.finished; i++) {
      if ((i & 255) === 255 && performance.now() > deadline) break;
      this.advance();
      if (run.last.sampled && run.last.accepted) this.trail();
    }
  }

  protected narrate(scene: MoveScene | undefined): string {
    if (scene) {
      const order = this.sequence(scene);
      const texts: Record<Phase, string> = {
        propose: scene.proposal,
        stuck: scene.proposal,
        build: `${scene.hops[this.revealed(scene) - 1]} Chain so far: <b>${this.revealed(scene)}</b> lessons.`,
        closed: scene.hops[0],
        price: scene.price,
        decide: scene.verdict,
      };
      return this.say(order.indexOf(scene.phase) + 1, order.length, TITLES[scene.phase], texts[scene.phase]);
    }
    const { run, rival } = this;
    if (!this.finished) {
      return `<p>Trying random changes: <b>${Format.count(run.evaluations)}</b> of ${Format.count(this.total)}. Penalty now <b>${Format.count(run.timetable.cost)}</b>. The cooler it gets, the fewer worse changes are kept.</p>`;
    }
    const poor = `Lessons in a poor place (dark corner): ${this.startTrouble} → <b>${Trouble.count(this.flags)}</b>.`;
    const broken = this.shown.evaluation().hard.total;
    if (broken > 0) {
      return `<p><b class="bad">No valid timetable was found: ${broken} ${broken === 1 ? "rule is" : "rules are"} still broken</b> (red crosses). The school may be impossible as it is set up, or this search did not find the way. Penalty ${Format.count(run.startCost)} → ${Format.count(run.cost)}.</p>`;
    }
    const summary = `Done: penalty <b>${Format.count(run.startCost)} → ${Format.count(run.cost)}</b>. ${poor}`;
    if (!rival) return `<p>${summary} Step 3 adds Kempe chains to go lower.</p>`;
    const gain = 1 - run.cost / rival.cost;
    const comparison =
      gain > 0.005
        ? `the chains end <b class="good">${Format.percent(gain)} lower</b>`
        : gain < -0.005
          ? `on this school the chains did not help (${Format.percent(-gain)} higher)`
          : "about the same on this school";
    return `<p>${summary} Without chains the same number of attempts ends at ${Format.count(rival.cost)}: ${comparison}.</p>`;
  }

  private get warmth(): number {
    const level = Math.log(this.run.currentTemperature / DEFAULT_END_TEMPERATURE) / Math.log(DEFAULT_START_TEMPERATURE / DEFAULT_END_TEMPERATURE);
    return Math.max(0, Math.min(1, level));
  }

  private get shown(): Timetable {
    if (!this.finished || this.scene) return this.run.timetable;
    this.final ??= Timetable.from(this.problem, this.run.result().slotOf);
    return this.final;
  }

  private trail() {
    const { sampler } = this.run;
    for (let i = 0; i < sampler.length; i++) this.trails.push({ lesson: sampler.lessons[i], from: sampler.from[i], to: sampler.to[i], born: this.clock });
    if (this.trails.length > TRAIL_LIMIT) this.trails.splice(0, this.trails.length - TRAIL_LIMIT);
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

  private sequence(scene: MoveScene): Phase[] {
    return scene.kind === "kempe" && scene.lessons.length > 1 ? CHAIN_PHASES : PLAIN_PHASES;
  }

  private revealed(scene: MoveScene): number {
    const count = scene.lessons.length;
    if (this.sequence(scene) === PLAIN_PHASES) return count;
    if (scene.phase === "stuck") return 1;
    if (scene.phase === "build") return Math.min(count, 2 + Math.floor(Math.min(1, scene.progress / SETTLE) * (count - 2)));
    return count;
  }

  private describe(duration: number): MoveScene {
    const { names, problem } = this;
    const { sampler, last } = this.run;
    const lessons = Array.from(sampler.lessons.subarray(0, sampler.length));
    const from = Array.from(sampler.from.subarray(0, sampler.length));
    const to = Array.from(sampler.to.subarray(0, sampler.length));
    const chain = sampler.kind === "kempe" && lessons.length > 1;
    const first = `<b>${names.lesson(lessons[0])}</b>`;
    const links: Link[] = [];
    const blockers: number[] = [];
    const hops: string[] = [];
    let proposal = `Move ${first} from ${names.slot(from[0])} to <b>${names.slot(to[0])}</b>.`;
    if (sampler.kind === "swap") proposal = `Swap ${first} (${names.slot(from[0])}) with <b>${names.subject(lessons[1])}</b> (${names.slot(from[1])}).`;
    if (chain) {
      lessons.forEach((lesson, index) => {
        const parent = lessons.findIndex((other, at) => at < index && from[at] !== from[index] && problem.neighbours(other).includes(lesson));
        if (parent < 0) return hops.push("");
        const sameClass = problem.lessonClass[lessons[parent]] === problem.lessonClass[lesson];
        links.push({ from: lessons[parent], fromSlot: from[parent], to: lesson, toSlot: from[index] });
        if (parent === 0) blockers.push(lesson);
        const why = sameClass ? "the same class" : "the same teacher";
        hops.push(
          parent === 0
            ? `<b>${names.lesson(lesson)}</b> is in the way, so it moves the other way, to ${names.slot(to[index])}.`
            : `There it bumps into <b>${names.lesson(lesson)}</b> (${why}), which has to move too.`,
        );
      });
      const blocker = blockers[0];
      const clash = problem.lessonClass[blocker] === problem.lessonClass[lessons[0]] ? `its class already has ${names.subject(blocker)} then` : `its teacher already teaches ${names.lesson(blocker)} then`;
      proposal = `${first} wants to move to <b>${names.slot(to[0])}</b>. But ${clash}: a plain move would be a clash (red cross).`;
      hops[0] = `Nobody else is in the way. All <b>${lessons.length}</b> lessons swap between ${names.slot(from[0])} and ${names.slot(to[0])} at once, so no clash appears.`;
    }
    const order = chain ? CHAIN_PHASES : PLAIN_PHASES;
    const whole = duration / order.reduce((sum, phase) => sum + SHARE[phase], 0);
    return {
      progress: 0,
      duration: whole * SHARE[order[0]],
      whole,
      more: true,
      phase: order[0],
      kind: sampler.kind,
      lessons,
      from,
      to,
      delta: last.delta,
      accepted: last.accepted,
      links,
      blockers,
      hops,
      proposal,
      price: this.price(lessons, from, to, last.delta),
      verdict: this.verdict(last.delta, last.accepted, last.roll),
    };
  }

  private price(lessons: number[], from: number[], to: number[], delta: number): string {
    const before = Int32Array.from(this.run.timetable.slotOf);
    lessons.forEach((lesson, index) => (before[lesson] = from[index]));
    const table = Timetable.from(this.problem, before);
    const old = table.cost;
    const was = table.breakdown();
    lessons.forEach((lesson, index) => table.move(lesson, to[index]));
    const next = table.breakdown();
    const reasons = PARTS.map(({ key, label }) => ({ label, points: next[key] - was[key] }))
      .filter((part) => Math.abs(part.points) >= 0.5)
      .sort((x, y) => Math.abs(y.points) - Math.abs(x.points));
    const listed = reasons.slice(0, REASONS_SHOWN).map((part) => `${part.label} <b>${Format.signed(part.points)}</b>`);
    if (reasons.length > REASONS_SHOWN) listed.push("…");
    const why = listed.length > 0 ? ` Why: ${listed.join(", ")}.` : "";
    const change = Math.abs(delta) < 0.5 ? "<b>no change</b>" : `<b class="${delta < 0 ? "good" : "bad"}">${Format.signed(delta)}</b>`;
    return `The penalty of the whole timetable would go from <b>${Format.count(old)}</b> to <b>${Format.count(old + delta)}</b>: ${change}.${why}`;
  }

  private verdict(delta: number, accepted: boolean, roll: number): string {
    if (delta <= 0) {
      const how = delta < 0 ? `Better by ${Format.count(-delta)} points` : "No worse than before";
      return `${how}. Rule: a change that is not worse is <b class="good">always kept</b>.`;
    }
    const chance = Math.exp(-delta / this.heat);
    const outcome = accepted ? '<b class="good">kept</b>' : '<b class="bad">undone</b>';
    const text =
      `Worse by <b>${Format.count(delta)}</b> points. Rule: a worse change is kept only by chance, and the chance shrinks when the change is worse and when the temperature is lower. ` +
      `Here, at temperature ${this.heat.toFixed(1)}, the chance is <b>${Format.percent(chance)}</b>.`;
    const gauge =
      `<div class="dice"><div class="gauge" role="img" aria-label="chance ${Format.percent(chance)}"><i style="width:${(100 * chance).toFixed(2)}%"></i>` +
      `<u style="left:${(100 * roll).toFixed(2)}%"></u></div><span>the random draw (black mark) fell in the ${accepted ? "green" : "red"} part: ${outcome}</span>` +
      `<div class="ends"><b class="good">keep ${Format.percent(chance)}</b><b class="bad">undo ${Format.percent(1 - chance)}</b></div></div>`;
    return text + "</p>" + gauge + "<p>";
  }
}

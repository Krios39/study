import { Problem } from "../../src/core/problem.ts";
import type { Instance } from "../../src/model.ts";
import { AnnealingStage } from "./annealing-stage.ts";
import { Board } from "./board.ts";
import { Dom } from "./dom.ts";
import { DsaturStage } from "./dsatur-stage.ts";
import { Format } from "./format.ts";
import { Pace } from "./pace.ts";
import { Palette, type ColourMode } from "./palette.ts";
import type { Stage } from "./stage.ts";

interface School {
  language: string;
  instance: Instance;
}

interface Step {
  label: string;
  short: string;
  create: (problem: Problem) => Stage;
}

const STEPS: Step[] = [
  { label: "DSATUR", short: "DSATUR", create: (problem) => new DsaturStage(problem) },
  { label: "Simulated annealing", short: "Annealing", create: (problem) => new AnnealingStage(problem, false) },
  { label: "Annealing + Kempe chains", short: "+ Kempe", create: (problem) => new AnnealingStage(problem, true) },
];

const DEFAULT_SCHOOL = "small-7";
const START_HINT = "Press <b>Play</b> to watch the whole step, or <b>One step</b> to go move by move.";
const NARROW_WIDTH = 860;
const REFRESH_MS = 125;
const SLIDER_STEPS = 1000;
const TIP_MS = 2500;

class App {
  private readonly schools: School[];
  private readonly problems = new Map<number, Problem>();
  private readonly pace = new Pace();
  private readonly canvas = Dom.find<HTMLCanvasElement>("board");
  private readonly wrap = Dom.find("wrap");
  private readonly caption = Dom.find("caption");
  private readonly about = Dom.find("about");
  private readonly panel = Dom.find("panel");
  private readonly progress = Dom.find("progress");
  private readonly tip = Dom.find("tip");
  private readonly play = Dom.find<HTMLButtonElement>("play");
  private readonly auto = Dom.find<HTMLButtonElement>("auto");
  private readonly speed = Dom.find<HTMLInputElement>("speed");
  private readonly rate = Dom.find("rate");
  private readonly school = Dom.find<HTMLSelectElement>("school");
  private readonly colours = Dom.find<HTMLSelectElement>("colours");
  private readonly tabs: HTMLButtonElement[];
  private stage!: Stage;
  private board!: Board;
  private stepIndex = 0;
  private playing = true;
  private lastFrame = 0;
  private lastRefresh = 0;
  private shownCaption = "";
  private tipTimer = 0;

  constructor() {
    this.schools = JSON.parse(Dom.find("schools").textContent ?? "[]") as School[];
    this.schools.forEach(({ instance, language }, index) => {
      const lessons = instance.requirements.reduce((sum, requirement) => sum + requirement.hours, 0);
      const shifts = new Set(instance.classes.map((cls) => cls.firstPeriod)).size;
      const option = Dom.make("option");
      option.value = String(index);
      option.textContent = `${instance.name} — ${language}-language, ${instance.classes.length} classes, ${lessons} lessons${shifts > 1 ? ", 2 shifts" : ""}`;
      option.selected = instance.name === DEFAULT_SCHOOL;
      this.school.append(option);
    });
    this.tabs = STEPS.map((step, index) => {
      const tab = Dom.make("button", "tab", `<em>${index + 1}</em><span class="long">${step.label}</span><span class="short">${step.short}</span>`);
      tab.addEventListener("click", () => this.open(index));
      Dom.find("tabs").append(tab);
      return tab;
    });
    this.speed.max = String(SLIDER_STEPS);
    this.listen();
    this.open(0);
    requestAnimationFrame((now) => this.frame(now));
  }

  private get problem(): Problem {
    const index = Number(this.school.value);
    let problem = this.problems.get(index);
    if (!problem) {
      problem = Problem.from(this.schools[index].instance);
      this.problems.set(index, problem);
    }
    return problem;
  }

  private get waiting(): boolean {
    return !this.playing && this.stage.done === 0 && !this.stage.animating;
  }

  private get palette(): Palette {
    return new Palette(this.problem, this.colours.value as ColourMode);
  }

  private listen() {
    this.school.addEventListener("change", () => this.open(this.stepIndex));
    this.colours.addEventListener("change", () => (this.board.palette = this.palette));
    this.play.addEventListener("click", () => {
      if (this.stage.finished) this.open(this.stepIndex);
      else this.playing = !this.playing;
    });
    Dom.find("step").addEventListener("click", () => {
      this.playing = false;
      this.stage.stepOnce();
    });
    Dom.find("restart").addEventListener("click", () => this.open(this.stepIndex));
    this.speed.addEventListener("input", () => this.pace.choose(Pace.at(Number(this.speed.value) / SLIDER_STEPS)));
    this.auto.addEventListener("click", () => (this.pace.auto = !this.pace.auto));
    window.addEventListener("resize", () => this.layout());
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => this.board.restyle());
    this.canvas.addEventListener("pointermove", (event) => this.showTip(event));
    this.canvas.addEventListener("pointerdown", (event) => this.showTip(event));
    this.canvas.addEventListener("pointerleave", () => (this.tip.hidden = true));
  }

  private open(stepIndex: number) {
    this.stepIndex = stepIndex;
    this.stage = STEPS[stepIndex].create(this.problem);
    this.board = new Board(this.canvas, this.problem, this.stage.names, this.palette, this.stage.pool);
    this.pace.auto = true;
    this.stage.plan(this.pace);
    this.playing = false;
    this.about.innerHTML = this.stage.about;
    this.panel.replaceChildren(this.stage.panel);
    this.tabs.forEach((tab, index) => {
      tab.classList.toggle("active", index === stepIndex);
      tab.classList.remove("next");
    });
    this.tip.hidden = true;
    this.lastRefresh = 0;
    this.layout();
  }

  private layout() {
    const narrow = window.innerWidth < NARROW_WIDTH;
    const top = this.wrap.getBoundingClientRect().top + window.scrollY;
    const room = narrow ? window.innerHeight * 0.5 : window.innerHeight - top - 44;
    this.board.resize(this.wrap.clientWidth, Math.max(160, room));
  }

  private frame(now: number) {
    const seconds = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (this.playing) this.pace.spend(seconds);
    this.stage.tick(seconds, this.playing ? this.pace.rate : 0);
    this.board.draw(this.stage.picture());
    const caption = this.waiting ? START_HINT : this.stage.caption;
    if (caption !== this.shownCaption) {
      this.shownCaption = caption;
      this.caption.innerHTML = this.shownCaption;
    }
    if (now - this.lastRefresh >= REFRESH_MS) {
      this.lastRefresh = now;
      this.refresh();
    }
    requestAnimationFrame((next) => this.frame(next));
  }

  private refresh() {
    const { stage, pace } = this;
    stage.refresh();
    this.progress.style.width = `${(100 * stage.done) / Math.max(1, stage.total)}%`;
    this.play.textContent = stage.finished ? "Replay" : this.playing ? "Pause" : "Play";
    this.auto.classList.toggle("on", pace.auto);
    this.rate.textContent = Format.rate(pace.rate);
    if (pace.auto) this.speed.value = String(Math.round(pace.position * SLIDER_STEPS));
    const next = this.tabs[this.stepIndex + 1];
    if (next) next.classList.toggle("next", stage.finished);
  }

  private showTip(event: PointerEvent) {
    const bounds = this.canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const slotOf = this.stage.picture().slotOf;
    const lesson = this.board.lessonAt(x, y, slotOf);
    this.tip.hidden = lesson < 0;
    if (lesson < 0) return;
    const { names } = this.stage;
    this.tip.textContent = `${names.lesson(lesson)} · ${names.teachers(lesson)} · ${names.slot(slotOf[lesson])}`;
    this.tip.style.left = `${Math.min(x + 12, bounds.width - 180)}px`;
    this.tip.style.top = `${y + 16}px`;
    window.clearTimeout(this.tipTimer);
    if (event.pointerType === "touch") this.tipTimer = window.setTimeout(() => (this.tip.hidden = true), TIP_MS);
  }
}

new App();

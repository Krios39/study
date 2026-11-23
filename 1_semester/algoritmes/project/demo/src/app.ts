import type { Problem } from "../../src/core/problem.ts";
import { AnnealingStage } from "./annealing-stage.ts";
import { Board } from "./board.ts";
import { Dom } from "./dom.ts";
import { DsaturStage } from "./dsatur-stage.ts";
import { Format } from "./format.ts";
import { Pace } from "./pace.ts";
import { ResultStage } from "./result-stage.ts";
import { SCENE_RATE, type Stage } from "./stage.ts";
import { Lang } from "./text.ts";
import { Trouble } from "./trouble.ts";

interface Step {
  key: string;
  create: (problem: Problem) => Stage;
}

const STEPS: Step[] = [
  { key: "result", create: (problem) => new ResultStage(problem) },
  { key: "dsatur", create: (problem) => new DsaturStage(problem) },
  { key: "annealing", create: (problem) => new AnnealingStage(problem, false) },
  { key: "kempe", create: (problem) => new AnnealingStage(problem, true) },
];

const NARROW_WIDTH = 860;
const MIN_BOARD_ROOM = 380;
const REFRESH_MS = 125;
const SLIDER_STEPS = 1000;
const TIP_MS = 2500;

export class App {
  private readonly source: () => Problem;
  private readonly guided: boolean;
  private built = false;
  private stages: (Stage | undefined)[] = [];
  private readonly pace = new Pace();
  private readonly canvas = Dom.find<HTMLCanvasElement>("board");
  private readonly wrap = Dom.find("wrap");
  private readonly caption = Dom.find("caption");
  private readonly panel = Dom.find("panel");
  private readonly progress = Dom.find("progress");
  private readonly tip = Dom.find("tip");
  private readonly play = Dom.find<HTMLButtonElement>("play");
  private readonly auto = Dom.find<HTMLButtonElement>("auto");
  private readonly speed = Dom.find<HTMLInputElement>("speed");
  private readonly rate = Dom.find("rate");
  private readonly tabs: HTMLButtonElement[];
  private stage!: Stage;
  private board!: Board;
  private stepIndex = 0;
  private playing = false;
  private lastFrame = 0;
  private lastRefresh = 0;
  private shownCaption = "";
  private tipTimer = 0;
  private dirty = true;
  private drawnDone = -1;
  private ratedDone = 0;
  private ratedAt = 0;
  private width = 0;

  constructor(source: () => Problem, guided = false) {
    this.source = source;
    this.guided = guided;
    this.tabs = STEPS.map((step, index) => {
      const tab = Dom.make("button", "tab", `<em>${index === 0 ? "✓" : index}</em><span class="long">${Lang.t(`tab.${step.key}`)}</span><span class="short">${Lang.t(`tab.${step.key}.short`)}</span><small></small>`);
      tab.addEventListener("click", () => {
        if (index <= 1 || !this.guided || this.built) this.open(index);
      });
      if (index > 0 || this.guided) Dom.find("tabs").append(tab);
      return tab;
    });
    this.speed.max = String(SLIDER_STEPS);
    this.listen();
    this.reload();
    requestAnimationFrame((now) => this.frame(now));
  }

  reload() {
    this.built = false;
    this.stages = [];
    this.open(this.guided ? 0 : Math.max(1, this.stepIndex));
  }

  private get waiting(): boolean {
    return this.stepIndex > 0 && !this.playing && this.stage.done === 0 && !this.stage.animating;
  }

  private listen() {
    this.play.addEventListener("click", () => {
      if (this.stage.finished) {
        this.open(this.stepIndex, true);
        this.playing = true;
      } else this.playing = !this.playing;
    });
    Dom.find("step").addEventListener("click", () => {
      this.playing = false;
      this.stage.stepOnce();
    });
    this.caption.addEventListener("click", (event) => {
      if (!(event.target as HTMLElement).closest("[data-watch]")) return;
      this.open(1);
      this.playing = this.guided;
    });
    Dom.find("restart").addEventListener("click", () => this.open(this.stepIndex, true));
    this.speed.addEventListener("input", () => this.pace.choose(Pace.at(Number(this.speed.value) / SLIDER_STEPS)));
    this.auto.addEventListener("click", () => (this.pace.auto = !this.pace.auto));
    window.addEventListener("resize", () => {
      if (window.innerWidth !== this.width || window.innerWidth >= NARROW_WIDTH) this.layout();
    });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      this.board.restyle();
      this.dirty = true;
    });
    this.canvas.addEventListener("pointermove", (event) => this.showTip(event));
    this.canvas.addEventListener("pointerdown", (event) => this.showTip(event));
    this.canvas.addEventListener("pointerleave", () => this.point(-1));
  }

  private open(stepIndex: number, fresh = false) {
    const problem = this.source();
    this.stepIndex = stepIndex;
    if (fresh || !this.stages[stepIndex]) this.stages[stepIndex] = STEPS[stepIndex].create(problem);
    this.stage = this.stages[stepIndex];
    this.board = new Board(this.canvas, problem, this.stage.names, this.stage.pool);
    this.pace.auto = true;
    this.stage.plan(this.pace);
    this.playing = false;
    document.body.classList.toggle("intro", stepIndex === 0);
    this.panel.replaceChildren(this.stage.panel);
    this.tabs.forEach((tab, index) => {
      tab.classList.toggle("active", index === stepIndex);
      tab.classList.remove("next");
    });
    this.tip.hidden = true;
    this.lastRefresh = 0;
    this.ratedDone = 0;
    this.layout();
  }

  private layout() {
    this.width = window.innerWidth;
    this.dirty = true;
    const narrow = this.width < NARROW_WIDTH;
    const top = this.wrap.getBoundingClientRect().top + window.scrollY;
    const room = narrow ? window.innerHeight * 0.5 : window.innerHeight - top - 70;
    this.board.resize(this.wrap.clientWidth, Math.max(narrow ? 160 : MIN_BOARD_ROOM, room));
  }

  private frame(now: number) {
    const { stage } = this;
    const seconds = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    if (stage.finished && !stage.animating) this.playing = false;
    if (this.playing) this.pace.spend(seconds);
    stage.tick(seconds, this.playing ? this.pace.rate : 0);
    const refresh = now - this.lastRefresh >= REFRESH_MS;
    if (refresh) {
      this.lastRefresh = now;
      this.refresh(now);
    }
    if (this.dirty || stage.animating || stage.moving || refresh || stage.done !== this.drawnDone) {
      this.board.draw(stage.picture());
      this.dirty = false;
      this.drawnDone = stage.done;
    }
    const caption = this.waiting ? Lang.t(`hint.${STEPS[this.stepIndex].key}`) : stage.caption;
    if (caption !== this.shownCaption) {
      this.shownCaption = caption;
      this.caption.innerHTML = caption;
      this.canvas.setAttribute("aria-label", this.caption.textContent ?? "");
    }
    requestAnimationFrame((next) => this.frame(next));
  }

  private refresh(now: number) {
    const { stage, pace } = this;
    const measured = (1000 * (stage.done - this.ratedDone)) / Math.max(1, now - this.ratedAt);
    this.ratedDone = stage.done;
    this.ratedAt = now;
    const fast = this.playing && !stage.finished && pace.rate > SCENE_RATE;
    stage.refresh();
    this.progress.style.width = `${(100 * stage.done) / Math.max(1, stage.total)}%`;
    this.play.textContent = Lang.t(stage.finished ? "control.replay" : this.playing ? "control.pause" : "control.play");
    document.body.classList.toggle("solving", this.stepIndex === 0 && !stage.finished);
    this.auto.classList.toggle("on", pace.auto);
    this.rate.textContent = Format.rate(fast && measured > 0 ? Math.min(pace.rate, measured) : pace.rate);
    if (pace.auto) this.speed.value = String(Math.round(pace.position * SLIDER_STEPS));
    if (this.stepIndex === 1 && stage.finished) this.built = true;
    this.tabs.forEach((tab, index) => (tab.disabled = this.guided && !this.built && index > 1));
    this.tabs.forEach((tab, index) => {
      const score = this.stages[index]?.score;
      tab.querySelector("small")!.innerHTML = score === undefined ? "" : `<i class="long">${Lang.t("tab.penalty")} </i>${Format.count(score)}`;
    });
    const next = this.tabs[this.stepIndex + 1];
    if (next) next.classList.toggle("next", stage.finished);
  }

  private point(lesson: number) {
    if (this.stage.hovered !== lesson) this.dirty = true;
    this.stage.hovered = lesson;
    this.tip.hidden = lesson < 0;
  }

  private showTip(event: PointerEvent) {
    const { stage } = this;
    const bounds = this.canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const slotOf = stage.picture().slotOf;
    const row = this.board.countRowAt(x, y);
    const lesson = row >= 0 ? stage.tightest(row) : stage.animating && !stage.hoverable ? -1 : this.board.lessonAt(x, y, slotOf);
    this.point(lesson);
    if (lesson < 0) return;
    const { names } = stage;
    const reasons = Trouble.reasons(stage.flag(lesson));
    const lines = [`${names.lesson(lesson)} · ${names.teachers(lesson)} · ${names.slot(slotOf[lesson])}`, stage.note(lesson), reasons.length > 0 ? Lang.t("tip.poor", { reasons: reasons.join("; ") }) : ""];
    this.tip.textContent = lines.filter((line) => line !== "").join("\n");
    this.tip.style.left = `${Math.max(0, Math.min(x + 12, bounds.width - 250))}px`;
    this.tip.style.top = `${y + 16}px`;
    window.clearTimeout(this.tipTimer);
    if (event.pointerType === "touch") this.tipTimer = window.setTimeout(() => this.point(-1), TIP_MS);
  }
}

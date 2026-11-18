import type { Problem } from "../../src/core/problem.ts";
import type { Flash, Picture } from "./board.ts";
import { Dom } from "./dom.ts";
import { Names } from "./names.ts";
import type { Pace } from "./pace.ts";
import type { Tone } from "./theme.ts";

export interface Scene {
  progress: number;
  duration: number;
  more: boolean;
}

interface Spark {
  lesson: number;
  tone: Tone;
  born: number;
}

const SCENE_RATE = 8;
const STEP_SECONDS = 1.6;
const SPARK_SECONDS = 0.45;
const SPARK_LIMIT = 240;

export abstract class Stage<S extends Scene = Scene> {
  abstract readonly about: string;
  readonly problem: Problem;
  readonly names: Names;
  readonly panel: HTMLElement;
  caption = "";
  protected scene: S | undefined;
  private clock = 0;
  private credit = 0;
  private sparks: Spark[] = [];

  constructor(problem: Problem) {
    this.problem = problem;
    this.names = new Names(problem);
    this.panel = Dom.make("div", "live");
  }

  abstract get finished(): boolean;
  abstract get done(): number;
  abstract get total(): number;
  abstract get pool(): number[];
  abstract plan(pace: Pace): void;
  abstract picture(): Picture;
  abstract refresh(): void;
  protected abstract open(duration: number): S | undefined;
  protected abstract burst(count: number): void;
  protected abstract narrate(scene: S | undefined): string;

  get animating(): boolean {
    return this.scene !== undefined;
  }

  tick(seconds: number, rate: number) {
    this.clock += seconds;
    if (this.scene) {
      this.scene.progress += seconds / this.scene.duration;
      if (this.scene.progress >= 1) {
        if (rate <= 0) this.scene.progress = 1;
        else this.scene = this.scene.more ? this.follow(this.scene) : undefined;
      }
    }
    if (!this.scene && rate > 0 && !this.finished) {
      if (rate <= SCENE_RATE) {
        this.scene = this.open(1 / rate);
      } else {
        this.credit += rate * seconds;
        const count = Math.floor(this.credit);
        this.credit -= count;
        if (count > 0) this.burst(count);
      }
    }
    this.caption = this.narrate(this.scene);
  }

  stepOnce() {
    if (this.scene?.more) this.scene = this.follow(this.scene);
    else if (!this.finished) this.scene = this.open(STEP_SECONDS);
    else this.scene = undefined;
  }

  protected phases(labels: string[], active: number): string {
    const chips = labels.map((label, index) => `<span class="${index === active ? "on" : index < active ? "past" : ""}"><em>${index + 1}</em>${label}</span>`);
    return `<div class="phases">${chips.join("")}</div>`;
  }

  protected follow(_scene: S): S | undefined {
    return undefined;
  }

  protected spark(lesson: number, tone: Tone) {
    if (this.sparks.length >= SPARK_LIMIT) this.sparks.shift();
    this.sparks.push({ lesson, tone, born: this.clock });
  }

  protected flashes(): Flash[] {
    this.sparks = this.sparks.filter((spark) => this.clock - spark.born < SPARK_SECONDS);
    return this.sparks.map((spark) => ({ lesson: spark.lesson, tone: spark.tone, alpha: 1 - (this.clock - spark.born) / SPARK_SECONDS }));
  }
}

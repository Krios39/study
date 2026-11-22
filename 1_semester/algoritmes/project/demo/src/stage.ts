import type { Problem } from "../../src/core/problem.ts";
import type { Picture } from "./board.ts";
import { Dom } from "./dom.ts";
import { Names } from "./names.ts";
import type { Pace } from "./pace.ts";

export interface Scene {
  progress: number;
  duration: number;
  more: boolean;
}

export const SCENE_RATE = 8;
export const SETTLE = 0.85;
const STEP_SECONDS = 1.6;

export abstract class Stage<S extends Scene = Scene> {
  readonly problem: Problem;
  readonly names: Names;
  readonly panel: HTMLElement;
  caption = "";
  protected scene: S | undefined;
  private credit = 0;

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
  protected abstract follow(scene: S): S;
  protected abstract burst(count: number): void;
  protected abstract narrate(scene: S | undefined): string;

  get animating(): boolean {
    return this.scene !== undefined;
  }

  get moving(): boolean {
    return false;
  }

  flag(_lesson: number): number {
    return 0;
  }

  tick(seconds: number, rate: number) {
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

  protected say(step: number, steps: number, title: string, text: string, extra = ""): string {
    return `<div class="scene"><em>${step} / ${steps}</em><b>${title}</b></div><p>${text}</p>${extra}`;
  }
}

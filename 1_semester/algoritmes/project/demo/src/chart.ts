import { Format } from "./format.ts";
import type { Theme } from "./theme.ts";

const POINT_LIMIT = 900;
const PADDING = { left: 0, right: 0, top: 20, bottom: 2 };

export class CostChart {
  readonly canvas: HTMLCanvasElement;
  private readonly span: number;
  private xs: number[] = [];
  private ys: number[][];
  private lowest = Infinity;
  private highest = 1;

  constructor(canvas: HTMLCanvasElement, span: number, lines: number) {
    this.canvas = canvas;
    this.span = span;
    this.ys = Array.from({ length: lines }, () => []);
  }

  add(x: number, values: number[]) {
    if (this.xs.length > 0 && this.xs[this.xs.length - 1] === x) return;
    this.xs.push(x);
    values.forEach((value, index) => {
      const safe = Math.max(1, value);
      this.ys[index].push(safe);
      this.lowest = Math.min(this.lowest, safe);
      this.highest = Math.max(this.highest, safe);
    });
    if (this.xs.length <= POINT_LIMIT) return;
    this.xs = this.xs.filter((_, index) => index % 2 === 0);
    this.ys = this.ys.map((line) => line.filter((_, index) => index % 2 === 0));
  }

  draw(theme: Theme) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || this.xs.length === 0) return;
    const ratio = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(width * ratio)) {
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(height * ratio);
    }
    const context = this.canvas.getContext("2d")!;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const low = Math.log(this.lowest * 0.92);
    const high = Math.log(this.highest * 1.05);
    const plotWidth = width - PADDING.left - PADDING.right;
    const plotHeight = height - PADDING.top - PADDING.bottom;
    const px = (x: number) => PADDING.left + (plotWidth * x) / this.span;
    const py = (y: number) => PADDING.top + plotHeight * (1 - (Math.log(y) - low) / (high - low || 1));

    context.strokeStyle = theme.line;
    context.lineWidth = 1;
    context.strokeRect(PADDING.left + 0.5, PADDING.top + 0.5, plotWidth - 1, plotHeight - 1);
    context.fillStyle = theme.muted;
    context.font = "12px Rubik, system-ui, sans-serif";
    context.textBaseline = "top";
    context.textAlign = "left";
    context.fillText("penalty points", PADDING.left, 2);
    context.textAlign = "right";
    context.fillText(`${Format.count(this.highest)} → ${Format.count(this.lowest)}`, width - PADDING.right, 2);

    for (let index = this.ys.length - 1; index >= 0; index--) {
      const line = this.ys[index];
      context.strokeStyle = theme.tone(index === 0 ? "plain" : "warn");
      context.lineWidth = index === 0 ? 2 : 1.5;
      context.setLineDash(index === 0 ? [] : [4, 3]);
      context.beginPath();
      for (let i = 0; i < line.length; i++) {
        if (i === 0) context.moveTo(px(this.xs[i]), py(line[i]));
        else context.lineTo(px(this.xs[i]), py(line[i]));
      }
      context.stroke();
      if (index > 0 || line.length < 2) continue;
      context.lineTo(px(this.xs[line.length - 1]), PADDING.top + plotHeight);
      context.lineTo(px(this.xs[0]), PADDING.top + plotHeight);
      context.fillStyle = theme.tone("plain");
      context.globalAlpha = 0.14;
      context.fill();
      context.globalAlpha = 1;
    }
    context.setLineDash([]);
  }
}

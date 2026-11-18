import { Format } from "./format.ts";
import type { Theme, Tone } from "./theme.ts";

export interface Series {
  label: string;
  tone: Tone;
}

const POINT_LIMIT = 900;
const PADDING = { left: 6, right: 6, top: 16, bottom: 6 };

export class CostChart {
  readonly canvas: HTMLCanvasElement;
  private readonly series: Series[];
  private readonly span: number;
  private xs: number[] = [];
  private ys: number[][];
  private lowest = Infinity;
  private highest = 1;

  constructor(canvas: HTMLCanvasElement, span: number, series: Series[]) {
    this.canvas = canvas;
    this.span = span;
    this.series = series;
    this.ys = series.map(() => []);
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
    context.font = "10px system-ui, sans-serif";
    context.textBaseline = "top";
    context.textAlign = "left";
    context.fillText(`cost, log scale · top ${Format.count(this.highest)}`, PADDING.left, 2);
    context.textAlign = "right";
    context.fillText(`lowest ${Format.count(this.lowest)}`, width - PADDING.right, 2);

    for (let index = this.series.length - 1; index >= 0; index--) {
      const line = this.ys[index];
      context.strokeStyle = theme.tone(this.series[index].tone);
      context.globalAlpha = index === 0 ? 1 : 0.75;
      context.lineWidth = index === 0 ? 2 : 1.5;
      context.beginPath();
      for (let i = 0; i < line.length; i++) {
        if (i === 0) context.moveTo(px(this.xs[i]), py(line[i]));
        else context.lineTo(px(this.xs[i]), py(line[i]));
      }
      context.stroke();
    }
    context.globalAlpha = 1;
  }
}

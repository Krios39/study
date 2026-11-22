import type { Problem } from "../../src/core/problem.ts";
import { UNASSIGNED } from "../../src/model.ts";
import { Names } from "./names.ts";
import type { Palette } from "./palette.ts";
import { Theme, type Tone } from "./theme.ts";

export interface Flight {
  lesson: number;
  from: number;
  to: number;
  progress: number;
  tone: Tone;
}

export interface Mark {
  row: number;
  slot: number;
  tone: Tone;
  level: number;
  ring: boolean;
  text?: string;
  tag?: boolean;
}

export interface Link {
  from: number;
  fromSlot: number;
  to: number;
  toSlot: number;
  sameClass: boolean;
}

export interface Arrow {
  lesson: number;
  from: number;
  to: number;
  tone: Tone;
  alpha: number;
}

export interface Flash {
  lesson: number;
  tone: Tone;
  alpha: number;
}

export interface Badge {
  row: number;
  text: string;
  strong: boolean;
}

export class Picture {
  readonly slotOf: Int32Array;
  flights: Flight[] = [];
  marks: Mark[] = [];
  links: Link[] = [];
  arrows: Arrow[] = [];
  flashes: Flash[] = [];
  badges: Badge[] = [];
  bands: number[] = [];
  bandTone: Tone = "kempe";
  dimPool = false;
  gaps = true;

  constructor(slotOf: Int32Array) {
    this.slotOf = slotOf;
  }
}

const HEADER_HEIGHT = 20;
const MIN_VISIBLE = 7;
const POOL_SHARE = 0.24;
const POOL_GAP = 12;

export class Board {
  palette: Palette;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly problem: Problem;
  private readonly names: Names;
  private readonly poolRank: Int32Array;
  private readonly poolColumns: number;
  private readonly classLoad: Uint8Array;
  private readonly classSeen: Uint8Array;
  private readonly teacherLoad: Uint8Array;
  private readonly flying: Uint8Array;
  private theme = Theme.read();
  private width = 0;
  private height = 0;
  private labelWidth = 0;
  private poolWidth = 0;
  private chipWidth = 0;
  private cellWidth = 0;
  private cellHeight = 0;
  private dayGap = 0;
  private x = 0;
  private y = 0;
  private w = 0;
  private h = 0;

  constructor(canvas: HTMLCanvasElement, problem: Problem, names: Names, palette: Palette, pool: Iterable<number>) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d")!;
    this.problem = problem;
    this.names = names;
    this.palette = palette;
    const perClass = new Int32Array(problem.nClasses);
    this.poolRank = new Int32Array(problem.nLessons).fill(-1);
    for (const lesson of pool) this.poolRank[lesson] = perClass[problem.lessonClass[lesson]]++;
    this.poolColumns = Math.max(0, ...perClass);
    this.classLoad = new Uint8Array(problem.nClasses * problem.nSlots);
    this.classSeen = new Uint8Array(problem.nClasses * problem.nSlots);
    this.teacherLoad = new Uint8Array(problem.nTeachers * problem.nSlots);
    this.flying = new Uint8Array(problem.nLessons);
  }

  resize(width: number, maxHeight: number) {
    const { problem } = this;
    const rows = problem.nClasses;
    const tallest = rows <= 10 ? 52 : 36;
    this.width = width;
    this.cellHeight = Math.max(3, Math.min(tallest, Math.floor((maxHeight - HEADER_HEIGHT) / rows)));
    this.height = HEADER_HEIGHT + rows * this.cellHeight + 2;
    this.labelWidth = this.cellHeight >= 10 ? 34 : 0;
    this.dayGap = width > 700 ? 8 : 4;
    const inner = width - this.labelWidth;
    this.chipWidth = this.poolColumns > 0 ? Math.min(18, (inner * POOL_SHARE) / this.poolColumns) : 0;
    this.poolWidth = this.poolColumns > 0 ? Math.ceil(this.chipWidth * this.poolColumns) + POOL_GAP : 0;
    this.cellWidth = Math.min(64, (inner - this.poolWidth - this.dayGap * (problem.days - 1)) / problem.nSlots);
    const ratio = window.devicePixelRatio || 1;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
  }

  restyle() {
    this.theme = Theme.read();
  }

  draw(picture: Picture) {
    const ratio = window.devicePixelRatio || 1;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.context.clearRect(0, 0, this.width, this.height);
    this.drawBackground();
    this.drawBands(picture.bands, picture.bandTone);
    this.drawMarks(picture.marks);
    this.drawLessons(picture);
    this.drawFlashes(picture);
    this.drawLinks(picture.links);
    this.drawArrows(picture.arrows);
    this.drawFlights(picture.flights);
    this.drawTags(picture.marks);
    this.drawBadges(picture.badges);
    this.drawLabels();
  }

  lessonAt(px: number, py: number, slotOf: Int32Array): number {
    for (let lesson = 0; lesson < this.problem.nLessons; lesson++) {
      this.place(lesson, slotOf[lesson]);
      if (px >= this.x && px < this.x + this.w && py >= this.y && py < this.y + this.h) return lesson;
    }
    return -1;
  }

  private get insetX(): number {
    return this.cellWidth >= 10 ? 1 : 0.5;
  }

  private get insetY(): number {
    return this.cellHeight >= 10 ? 1 : 0.5;
  }

  private columnX(slot: number): number {
    const { problem } = this;
    const day = problem.dayOf(slot);
    return this.labelWidth + this.poolWidth + day * (problem.periods * this.cellWidth + this.dayGap) + problem.periodOf(slot) * this.cellWidth;
  }

  private cell(row: number, slot: number) {
    this.x = this.columnX(slot);
    this.y = HEADER_HEIGHT + row * this.cellHeight;
    this.w = this.cellWidth;
    this.h = this.cellHeight;
  }

  private place(lesson: number, slot: number) {
    const row = this.problem.lessonClass[lesson];
    if (slot !== UNASSIGNED) return this.cell(row, slot);
    this.x = this.labelWidth + Math.max(0, this.poolRank[lesson]) * this.chipWidth;
    this.y = HEADER_HEIGHT + row * this.cellHeight;
    this.w = this.chipWidth;
    this.h = this.cellHeight;
  }

  private enlarge() {
    if (this.w < MIN_VISIBLE) {
      this.x -= (MIN_VISIBLE - this.w) / 2;
      this.w = MIN_VISIBLE;
    }
    if (this.h < MIN_VISIBLE) {
      this.y -= (MIN_VISIBLE - this.h) / 2;
      this.h = MIN_VISIBLE;
    }
  }

  private drawBackground() {
    const { context, problem } = this;
    context.globalAlpha = 1;
    context.fillStyle = this.theme.allowed;
    problem.instance.classes.forEach((cls, row) => {
      for (let day = 0; day < problem.days; day++) {
        this.cell(row, problem.slot(day, cls.firstPeriod));
        context.fillRect(this.x, this.y + this.insetY, this.cellWidth * cls.maxPerDay, this.h - 2 * this.insetY);
      }
    });
  }

  private drawBands(bands: number[], tone: Tone) {
    const { context } = this;
    context.fillStyle = this.theme.tone(tone);
    context.globalAlpha = 0.16;
    for (const slot of bands) {
      if (slot === UNASSIGNED) continue;
      context.fillRect(this.columnX(slot), HEADER_HEIGHT - 4, this.cellWidth, this.height - HEADER_HEIGHT + 4);
    }
    context.globalAlpha = 1;
  }

  private drawMarks(marks: Mark[]) {
    const { context, theme } = this;
    const lettered = this.cellWidth >= 22 && this.cellHeight >= 14;
    context.font = `600 ${Math.min(11, Math.floor(this.cellHeight * 0.5))}px Rubik, system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (const mark of marks) {
      this.cell(mark.row, mark.slot);
      const colour = theme.tone(mark.tone);
      const full = this.h - 2 * this.insetY;
      const bar = mark.level > 0 ? Math.max(2, full * mark.level) : 0;
      context.fillStyle = colour;
      context.globalAlpha = mark.level > 0 ? 0.14 : 0.4;
      context.fillRect(this.x + this.insetX, this.y + this.insetY, this.w - 2 * this.insetX, full);
      context.globalAlpha = 0.85;
      context.fillRect(this.x + this.insetX, this.y + this.insetY + full - bar, this.w - 2 * this.insetX, bar);
      if (mark.text !== undefined && lettered) {
        context.globalAlpha = 1;
        context.fillStyle = theme.ink;
        context.fillText(mark.text, this.x + this.w / 2, this.y + this.h / 2 + 0.5, this.w - 4);
      }
      if (!mark.ring) continue;
      context.globalAlpha = 1;
      context.strokeStyle = theme.ink;
      context.lineWidth = 2;
      context.strokeRect(this.x + 1, this.y + 1, this.w - 2, this.h - 2);
    }
    context.globalAlpha = 1;
  }

  private drawLessons(picture: Picture) {
    const { context, problem, classLoad, classSeen, teacherLoad, flying, palette } = this;
    const { slotOf } = picture;
    const { nLessons, nSlots, lessonClass } = problem;
    classLoad.fill(0);
    classSeen.fill(0);
    teacherLoad.fill(0);
    flying.fill(0);
    for (const flight of picture.flights) flying[flight.lesson] = 1;
    for (let lesson = 0; lesson < nLessons; lesson++) {
      const slot = slotOf[lesson];
      if (flying[lesson] || slot === UNASSIGNED) continue;
      classLoad[lessonClass[lesson] * nSlots + slot]++;
      for (const teacher of problem.teachersOf(lesson)) teacherLoad[teacher * nSlots + slot]++;
    }

    const labelled = this.cellWidth >= 30 && this.cellHeight >= 14;
    context.font = `600 ${Math.min(11, Math.floor(this.cellHeight * 0.5))}px Rubik, system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (let lesson = 0; lesson < nLessons; lesson++) {
      if (flying[lesson]) continue;
      const slot = slotOf[lesson];
      this.place(lesson, slot);
      let shared = 1;
      if (slot !== UNASSIGNED) {
        const key = lessonClass[lesson] * nSlots + slot;
        shared = classLoad[key];
        if (shared > 1) {
          this.w /= shared;
          this.x += this.w * classSeen[key]++;
        }
      }
      const insetX = Math.min(this.insetX, this.w * 0.2);
      const full = this.h - 2 * this.insetY;
      context.fillStyle = palette.fill(lesson);
      context.globalAlpha = slot === UNASSIGNED && picture.dimPool ? 0.3 : 1;
      context.fillRect(this.x + insetX, this.y + this.insetY, this.w - 2 * insetX, full);
      context.globalAlpha = 1;
      if (labelled && shared === 1 && slot !== UNASSIGNED) {
        context.fillStyle = palette.ink(lesson);
        context.fillText(this.names.code(lesson), this.x + this.w / 2, this.y + this.h / 2 + 0.5);
      }
    }

    if (picture.gaps) this.drawGaps();
    context.strokeStyle = this.theme.tone("bad");
    context.lineWidth = this.cellWidth >= 8 ? 2 : 1.5;
    for (let lesson = 0; lesson < nLessons; lesson++) {
      const slot = slotOf[lesson];
      if (flying[lesson] || slot === UNASSIGNED || !this.clashes(lesson, slot)) continue;
      this.cell(lessonClass[lesson], slot);
      context.strokeRect(this.x + 0.5, this.y + 0.5, this.w - 1, this.h - 1);
    }
  }

  private drawGaps() {
    const { context, problem, classLoad } = this;
    context.fillStyle = this.theme.tone("bad");
    context.globalAlpha = 0.45;
    problem.instance.classes.forEach((cls, row) => {
      for (let day = 0; day < problem.days; day++) {
        const base = row * problem.nSlots + day * problem.periods;
        let last = -1;
        for (let period = 0; period < problem.periods; period++) if (classLoad[base + period] > 0) last = period;
        for (let period = cls.firstPeriod; period < last; period++) {
          if (classLoad[base + period] > 0) continue;
          this.cell(row, problem.slot(day, period));
          context.fillRect(this.x + this.insetX, this.y + this.insetY, this.w - 2 * this.insetX, this.h - 2 * this.insetY);
        }
      }
    });
    context.globalAlpha = 1;
  }

  private clashes(lesson: number, slot: number): boolean {
    const { problem } = this;
    if (!problem.isAllowed(lesson, slot)) return true;
    if (this.classLoad[problem.lessonClass[lesson] * problem.nSlots + slot] > 1) return true;
    for (const teacher of problem.teachersOf(lesson)) if (this.teacherLoad[teacher * problem.nSlots + slot] > 1) return true;
    return false;
  }

  private drawFlashes(picture: Picture) {
    const { context, theme } = this;
    context.lineWidth = 2;
    for (const flash of picture.flashes) {
      this.place(flash.lesson, picture.slotOf[flash.lesson]);
      this.enlarge();
      context.globalAlpha = flash.alpha;
      context.strokeStyle = theme.tone(flash.tone);
      context.strokeRect(this.x, this.y, this.w, this.h);
    }
    context.globalAlpha = 1;
  }

  private drawLinks(links: Link[]) {
    const { context, theme } = this;
    context.lineWidth = 2;
    for (const link of links) {
      this.place(link.from, link.fromSlot);
      const ax = this.x + this.w / 2;
      const ay = this.y + this.h / 2;
      this.place(link.to, link.toSlot);
      const bx = this.x + this.w / 2;
      const by = this.y + this.h / 2;
      const colour = theme.tone(link.sameClass ? "plain" : "kempe");
      context.strokeStyle = colour;
      context.fillStyle = colour;
      context.setLineDash(link.sameClass ? [] : [5, 4]);
      context.beginPath();
      context.moveTo(ax, ay);
      context.lineTo(bx, by);
      context.stroke();
      context.setLineDash([]);
      for (const [x, y] of [[ax, ay], [bx, by]]) {
        context.beginPath();
        context.arc(x, y, 3, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  private drawArrows(arrows: Arrow[]) {
    const { context, theme } = this;
    context.lineWidth = this.cellWidth >= 12 ? 2.5 : 1.75;
    for (const arrow of arrows) {
      this.place(arrow.lesson, arrow.from);
      const ax = this.x + this.w / 2;
      const ay = this.y + this.h / 2;
      this.place(arrow.lesson, arrow.to);
      const bx = this.x + this.w / 2;
      const by = this.y + this.h / 2;
      const length = Math.hypot(bx - ax, by - ay);
      if (length < 1) continue;
      const ux = (bx - ax) / length;
      const uy = (by - ay) / length;
      const head = Math.min(8, length / 2);
      const bend = Math.min(26, length * 0.18);
      const mx = (ax + bx) / 2 + uy * bend;
      const my = (ay + by) / 2 - ux * bend - bend * 0.4;
      const colour = theme.tone(arrow.tone);
      context.globalAlpha = arrow.alpha;
      context.strokeStyle = colour;
      context.fillStyle = colour;
      context.beginPath();
      context.moveTo(ax, ay);
      context.quadraticCurveTo(mx, my, bx, by);
      context.stroke();
      const angle = Math.atan2(by - my, bx - mx);
      context.beginPath();
      context.moveTo(bx, by);
      context.lineTo(bx - head * Math.cos(angle - 0.45), by - head * Math.sin(angle - 0.45));
      context.lineTo(bx - head * Math.cos(angle + 0.45), by - head * Math.sin(angle + 0.45));
      context.closePath();
      context.fill();
    }
    context.globalAlpha = 1;
  }

  private drawFlights(flights: Flight[]) {
    const { context, theme } = this;
    for (const flight of flights) {
      const t = flight.progress < 0.5 ? 2 * flight.progress * flight.progress : 1 - Math.pow(-2 * flight.progress + 2, 2) / 2;
      this.place(flight.lesson, flight.from);
      this.enlarge();
      const fx = this.x;
      const fy = this.y;
      const fw = this.w;
      const fh = this.h;
      this.place(flight.lesson, flight.to);
      this.enlarge();
      const x = fx + (this.x - fx) * t;
      const y = fy + (this.y - fy) * t;
      const w = fw + (this.w - fw) * t;
      const h = fh + (this.h - fh) * t;
      context.shadowColor = "rgba(0, 0, 0, 0.35)";
      context.shadowBlur = 8;
      context.fillStyle = this.palette.fill(flight.lesson);
      context.fillRect(x, y, w, h);
      context.shadowBlur = 0;
      context.strokeStyle = theme.tone(flight.tone);
      context.lineWidth = 2;
      context.strokeRect(x, y, w, h);
      if (w >= 30 && h >= 14) {
        context.fillStyle = this.palette.ink(flight.lesson);
        context.fillText(this.names.code(flight.lesson), x + w / 2, y + h / 2 + 0.5);
      }
    }
  }

  private drawTags(marks: Mark[]) {
    const { context, theme } = this;
    context.font = "700 11px Rubik, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (const mark of marks) {
      if (!mark.tag || mark.text === undefined) continue;
      this.cell(mark.row, mark.slot);
      const width = context.measureText(mark.text).width + 10;
      const centre = Math.max(width / 2, Math.min(this.width - width / 2, this.x + this.w / 2));
      const top = this.y - 18;
      context.fillStyle = theme.ink;
      context.beginPath();
      context.roundRect(centre - width / 2, top, width, 16, 4);
      context.moveTo(centre - 4, top + 16);
      context.lineTo(centre, top + 20);
      context.lineTo(centre + 4, top + 16);
      context.fill();
      context.fillStyle = theme.allowed;
      context.fillText(mark.text, centre, top + 8.5);
    }
  }

  private drawBadges(badges: Badge[]) {
    const { context, theme } = this;
    const size = Math.max(13, Math.min(24, Math.floor(this.cellHeight * 0.6)));
    context.font = `700 ${size}px Rubik, system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (const badge of badges) {
      const width = context.measureText(badge.text).width + 14;
      const height = size + 8;
      const right = Math.max(width, this.labelWidth + this.poolWidth - 4);
      const middle = HEADER_HEIGHT + badge.row * this.cellHeight + this.cellHeight / 2;
      const top = Math.max(0, Math.min(this.height - height, middle - height / 2));
      context.shadowColor = "rgba(0, 0, 0, 0.3)";
      context.shadowBlur = 6;
      context.fillStyle = badge.strong ? theme.tone("plain") : theme.muted;
      context.beginPath();
      context.roundRect(right - width, top, width, height, height / 2);
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = theme.onAccent;
      context.fillText(badge.text, right - width / 2, top + height / 2 + 0.5);
    }
  }

  private drawLabels() {
    const { context, problem, theme } = this;
    context.fillStyle = theme.muted;
    context.font = "11px Rubik, system-ui, sans-serif";
    context.textBaseline = "middle";
    context.textAlign = "center";
    const dayWidth = problem.periods * this.cellWidth;
    for (let day = 0; day < problem.days; day++) {
      context.fillText(Names.day(day), this.columnX(problem.slot(day, 0)) + dayWidth / 2, HEADER_HEIGHT / 2);
    }
    if (this.poolWidth >= 60) context.fillText("to place", this.labelWidth + (this.poolWidth - POOL_GAP) / 2, HEADER_HEIGHT / 2);
    if (this.labelWidth === 0) return;
    context.textAlign = "right";
    context.font = `${Math.min(11, this.cellHeight - 1)}px Rubik, system-ui, sans-serif`;
    problem.instance.classes.forEach((cls, row) => {
      context.fillText(cls.id, this.labelWidth - 5, HEADER_HEIGHT + row * this.cellHeight + this.cellHeight / 2 + 0.5);
    });
  }
}

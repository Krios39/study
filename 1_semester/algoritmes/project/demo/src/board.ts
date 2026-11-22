import type { Problem } from "../../src/core/problem.ts";
import { UNASSIGNED } from "../../src/model.ts";
import { Names } from "./names.ts";
import { Theme, type Tone } from "./theme.ts";

export interface Flight {
  lesson: number;
  from: number;
  to: number;
  progress: number;
  tone: Tone;
  note?: string;
  light?: boolean;
}

export interface Mark {
  row: number;
  slot: number;
  open: boolean;
  text?: string;
  ring?: boolean;
  tag?: boolean;
}

export interface Link {
  from: number;
  fromSlot: number;
  to: number;
  toSlot: number;
}

export interface Arrow {
  lesson: number;
  from: number;
  to: number;
  alpha?: number;
}

export class Picture {
  readonly slotOf: Int32Array;
  flights: Flight[] = [];
  marks: Mark[] = [];
  links: Link[] = [];
  arrows: Arrow[] = [];
  crossed: number[] = [];
  bands: number[] = [];
  trouble: Uint8Array | undefined;
  gaps = false;
  counts: Int32Array | undefined;
  countRow = -1;

  constructor(slotOf: Int32Array) {
    this.slotOf = slotOf;
  }
}

const HEADER_HEIGHT = 20;
const MIN_VISIBLE = 7;
const POOL_SHARE = 0.22;
const COUNT_GAP = 40;
const FONT = "Rubik, system-ui, sans-serif";
const LESSON_INK = "#14161a";
const EASY_HUE = 125;

export class Board {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly problem: Problem;
  private readonly names: Names;
  private readonly poolRank: Int32Array;
  private readonly poolColumns: number;
  private readonly classLoad: Uint8Array;
  private readonly classSeen: Uint8Array;
  private readonly teacherLoad: Uint8Array;
  private readonly hidden: Uint8Array;
  private readonly fills: string[];
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

  constructor(canvas: HTMLCanvasElement, problem: Problem, names: Names, pool: Iterable<number>) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d")!;
    this.problem = problem;
    this.names = names;
    const perClass = new Int32Array(problem.nClasses);
    this.poolRank = new Int32Array(problem.nLessons).fill(-1);
    for (const lesson of pool) this.poolRank[lesson] = perClass[problem.lessonClass[lesson]]++;
    this.poolColumns = Math.max(0, ...perClass);
    this.classLoad = new Uint8Array(problem.nClasses * problem.nSlots);
    this.classSeen = new Uint8Array(problem.nClasses * problem.nSlots);
    this.teacherLoad = new Uint8Array(problem.nTeachers * problem.nSlots);
    this.hidden = new Uint8Array(problem.nLessons);
    const { subjects } = problem.instance;
    const hardest = Math.max(...subjects.map((subject) => subject.difficulty));
    this.fills = subjects.map((subject) => `hsl(${Math.round(EASY_HUE * (1 - (subject.difficulty - 1) / Math.max(1, hardest - 1)))} 80% 58%)`);
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
    this.poolWidth = this.poolColumns > 0 ? Math.ceil(this.chipWidth * this.poolColumns) + COUNT_GAP : 0;
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
    this.drawBands(picture.bands);
    this.drawMarks(picture.marks);
    this.drawLessons(picture);
    this.drawLinks(picture.links);
    this.drawArrows(picture.arrows);
    this.drawFlights(picture.flights);
    this.drawTags(picture.marks);
    this.drawCounts(picture);
    this.drawLabels();
  }

  lessonAt(px: number, py: number, slotOf: Int32Array): number {
    for (let lesson = 0; lesson < this.problem.nLessons; lesson++) {
      this.place(lesson, slotOf[lesson]);
      if (px >= this.x && px < this.x + this.w && py >= this.y && py < this.y + this.h) return lesson;
    }
    return -1;
  }

  countRowAt(px: number, py: number): number {
    const right = this.labelWidth + this.poolWidth;
    if (this.poolWidth === 0 || px < right - COUNT_GAP || px >= right || py < HEADER_HEIGHT) return -1;
    const row = Math.floor((py - HEADER_HEIGHT) / this.cellHeight);
    return row < this.problem.nClasses ? row : -1;
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

  private text(size: number, weight = 600) {
    const { context } = this;
    context.font = `${weight} ${size}px ${FONT}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
  }

  private cross(colour: string) {
    const { context } = this;
    const reach = Math.min(this.w, this.h) * 0.24;
    if (reach < 1.2) return;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    context.strokeStyle = colour;
    context.lineWidth = reach > 4 ? 2 : 1.25;
    context.beginPath();
    context.moveTo(cx - reach, cy - reach);
    context.lineTo(cx + reach, cy + reach);
    context.moveTo(cx + reach, cy - reach);
    context.lineTo(cx - reach, cy + reach);
    context.stroke();
  }

  private bubble(centre: number, top: number, text: string, fill: string, ink: string) {
    const { context } = this;
    this.text(11, 700);
    const width = context.measureText(text).width + 10;
    const middle = Math.max(width / 2, Math.min(this.width - width / 2, centre));
    const y = Math.max(0, top);
    context.fillStyle = fill;
    context.beginPath();
    context.roundRect(middle - width / 2, y, width, 16, 4);
    context.moveTo(middle - 4, y + 16);
    context.lineTo(middle, y + 20);
    context.lineTo(middle + 4, y + 16);
    context.fill();
    context.fillStyle = ink;
    context.fillText(text, middle, y + 8.5);
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

  private drawBands(bands: number[]) {
    const { context } = this;
    context.fillStyle = this.theme.tone("plain");
    context.globalAlpha = 0.12;
    for (const slot of bands) context.fillRect(this.columnX(slot), HEADER_HEIGHT - 4, this.cellWidth, this.height - HEADER_HEIGHT + 4);
    context.globalAlpha = 1;
  }

  private drawMarks(marks: Mark[]) {
    const { context, theme } = this;
    const lettered = this.cellWidth >= 22 && this.cellHeight >= 14;
    for (const mark of marks) {
      this.cell(mark.row, mark.slot);
      const colour = theme.tone(mark.open ? "good" : "bad");
      context.fillStyle = colour;
      context.globalAlpha = mark.open ? 0.22 : 0.15;
      context.fillRect(this.x + this.insetX, this.y + this.insetY, this.w - 2 * this.insetX, this.h - 2 * this.insetY);
      context.globalAlpha = 1;
      if (!mark.open) {
        this.cross(colour);
      } else if (mark.text !== undefined && lettered) {
        this.text(Math.min(11, Math.floor(this.cellHeight * 0.5)));
        context.fillStyle = theme.ink;
        context.fillText(mark.text, this.x + this.w / 2, this.y + this.h / 2 + 0.5, this.w - 4);
      } else if (mark.text === undefined) {
        context.beginPath();
        context.arc(this.x + this.w / 2, this.y + this.h / 2, Math.max(1.2, Math.min(this.w, this.h) * 0.14), 0, Math.PI * 2);
        context.fill();
      }
      if (!mark.ring) continue;
      context.strokeStyle = theme.tone("plain");
      context.lineWidth = 3;
      context.strokeRect(this.x + 1.5, this.y + 1.5, this.w - 3, this.h - 3);
    }
  }

  private drawLessons(picture: Picture) {
    const { context, problem, classLoad, classSeen, teacherLoad, hidden, theme } = this;
    const { slotOf, trouble } = picture;
    const { nLessons, nSlots, lessonClass } = problem;
    classLoad.fill(0);
    classSeen.fill(0);
    teacherLoad.fill(0);
    hidden.fill(0);
    for (const flight of picture.flights) hidden[flight.lesson] = 1;
    for (const lesson of picture.crossed) hidden[lesson] = 2;
    for (let lesson = 0; lesson < nLessons; lesson++) {
      const slot = slotOf[lesson];
      if (hidden[lesson] === 1 || slot === UNASSIGNED) continue;
      classLoad[lessonClass[lesson] * nSlots + slot]++;
      for (const teacher of problem.teachersOf(lesson)) teacherLoad[teacher * nSlots + slot]++;
    }

    const labelled = this.cellWidth >= 30 && this.cellHeight >= 14;
    this.text(Math.min(11, Math.floor(this.cellHeight * 0.5)));
    for (let lesson = 0; lesson < nLessons; lesson++) {
      if (hidden[lesson] === 1) continue;
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
      const broken = hidden[lesson] === 2 || (slot !== UNASSIGNED && this.clashes(lesson, slot));
      const costly = !broken && slot !== UNASSIGNED && trouble !== undefined && trouble[lesson] > 0;
      const insetX = Math.min(this.insetX, this.w * 0.2);
      context.fillStyle = broken ? theme.tone("bad") : this.fills[problem.lessonSubject[lesson]];
      context.globalAlpha = slot === UNASSIGNED && !broken ? 0.85 : 1;
      context.fillRect(this.x + insetX, this.y + this.insetY, this.w - 2 * insetX, this.h - 2 * this.insetY);
      context.globalAlpha = 1;
      if (broken) {
        if (slot === UNASSIGNED) this.enlarge();
        this.cross(theme.onAccent);
        continue;
      }
      if (costly) {
        const ear = Math.max(2.5, Math.min(this.w - 2 * insetX, this.h * 0.5, 14));
        context.fillStyle = theme.shade;
        context.beginPath();
        context.moveTo(this.x + this.w - insetX - ear, this.y + this.insetY);
        context.lineTo(this.x + this.w - insetX, this.y + this.insetY);
        context.lineTo(this.x + this.w - insetX, this.y + this.insetY + ear);
        context.fill();
      }
      if (labelled && shared === 1 && slot !== UNASSIGNED) {
        context.fillStyle = LESSON_INK;
        context.fillText(this.names.code(lesson), this.x + this.w / 2, this.y + this.h / 2 + 0.5);
      }
    }
    if (picture.gaps) this.drawGaps();
  }

  private drawGaps() {
    const { context, problem, classLoad, theme } = this;
    problem.instance.classes.forEach((cls, row) => {
      for (let day = 0; day < problem.days; day++) {
        const base = row * problem.nSlots + day * problem.periods;
        let last = -1;
        for (let period = 0; period < problem.periods; period++) if (classLoad[base + period] > 0) last = period;
        for (let period = cls.firstPeriod; period < last; period++) {
          if (classLoad[base + period] > 0) continue;
          this.cell(row, problem.slot(day, period));
          context.fillStyle = theme.tone("bad");
          context.globalAlpha = 0.2;
          context.fillRect(this.x + this.insetX, this.y + this.insetY, this.w - 2 * this.insetX, this.h - 2 * this.insetY);
          context.globalAlpha = 1;
          this.cross(theme.tone("bad"));
        }
      }
    });
  }

  private clashes(lesson: number, slot: number): boolean {
    const { problem } = this;
    if (!problem.isAllowed(lesson, slot)) return true;
    if (this.classLoad[problem.lessonClass[lesson] * problem.nSlots + slot] > 1) return true;
    for (const teacher of problem.teachersOf(lesson)) if (this.teacherLoad[teacher * problem.nSlots + slot] > 1) return true;
    return false;
  }

  private drawLinks(links: Link[]) {
    const { context, theme } = this;
    context.lineWidth = 2;
    context.strokeStyle = theme.tone("plain");
    for (const link of links) {
      this.place(link.from, link.fromSlot);
      const ax = this.x + this.w / 2;
      const ay = this.y + this.h / 2;
      this.place(link.to, link.toSlot);
      context.beginPath();
      context.moveTo(ax, ay);
      context.lineTo(this.x + this.w / 2, this.y + this.h / 2);
      context.stroke();
    }
  }

  private drawArrows(arrows: Arrow[]) {
    const { context, theme } = this;
    const colour = theme.tone("plain");
    context.lineWidth = this.cellWidth >= 12 ? 2.5 : 1.75;
    context.strokeStyle = colour;
    context.fillStyle = colour;
    for (const arrow of arrows) {
      context.globalAlpha = arrow.alpha ?? 1;
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
      const plain = flight.tone === "plain";
      context.shadowColor = "rgba(0, 0, 0, 0.35)";
      context.shadowBlur = flight.light ? 0 : 8;
      context.fillStyle = theme.tone("plain");
      context.fillRect(x, y, w, h);
      context.shadowBlur = 0;
      context.strokeStyle = plain ? theme.shade : theme.tone(flight.tone);
      context.lineWidth = plain ? 2 : 3;
      context.strokeRect(x, y, w, h);
      if (w >= 30 && h >= 14) {
        this.text(Math.min(11, Math.floor(h * 0.5)));
        context.fillStyle = theme.onAccent;
        context.fillText(this.names.code(flight.lesson), x + w / 2, y + h / 2 + 0.5);
      }
      if (flight.note !== undefined) this.bubble(x + w / 2, y - 22, flight.note, plain ? theme.ink : theme.tone(flight.tone), plain ? theme.surface : theme.onAccent);
    }
  }

  private drawTags(marks: Mark[]) {
    for (const mark of marks) {
      if (!mark.tag || mark.text === undefined) continue;
      this.cell(mark.row, mark.slot);
      this.bubble(this.x + this.w / 2, this.y - 20, mark.text, this.theme.ink, this.theme.surface);
    }
  }

  private drawCounts(picture: Picture) {
    const { context, theme } = this;
    const { counts } = picture;
    if (!counts || this.poolWidth === 0) return;
    const right = this.labelWidth + this.poolWidth - 6;
    const quiet = this.cellHeight >= 12;
    counts.forEach((count, row) => {
      if (count < 0) return;
      const middle = HEADER_HEIGHT + row * this.cellHeight + this.cellHeight / 2;
      if (row === picture.countRow) {
        this.text(13, 700);
        const text = String(count);
        const width = Math.max(26, context.measureText(text).width + 12);
        const top = Math.max(0, Math.min(this.height - 20, middle - 10));
        context.fillStyle = theme.tone("plain");
        context.beginPath();
        context.roundRect(right - width, top, width, 20, 10);
        context.fill();
        context.fillStyle = theme.onAccent;
        context.fillText(text, right - width / 2, top + 10.5);
      } else if (quiet) {
        this.text(11, 500);
        context.textAlign = "right";
        context.fillStyle = theme.muted;
        context.fillText(String(count), right - 6, middle + 0.5);
      }
    });
  }

  private drawLabels() {
    const { context, problem, theme } = this;
    context.fillStyle = theme.muted;
    this.text(11, 400);
    const dayWidth = problem.periods * this.cellWidth;
    for (let day = 0; day < problem.days; day++) {
      context.fillText(Names.day(day), this.columnX(problem.slot(day, 0)) + dayWidth / 2, HEADER_HEIGHT / 2);
    }
    if (this.poolWidth >= 150) {
      context.fillText("waiting lessons", this.labelWidth + (this.poolWidth - COUNT_GAP) / 2, HEADER_HEIGHT / 2);
      context.textAlign = "right";
      context.fillText("free", this.labelWidth + this.poolWidth - 10, HEADER_HEIGHT / 2);
    } else if (this.poolWidth >= 80) {
      context.fillText("waiting", this.labelWidth + (this.poolWidth - COUNT_GAP) / 2, HEADER_HEIGHT / 2);
    }
    if (this.labelWidth === 0) return;
    context.textAlign = "right";
    context.font = `${Math.min(11, this.cellHeight - 1)}px ${FONT}`;
    problem.instance.classes.forEach((cls, row) => {
      context.fillText(cls.id, this.labelWidth - 5, HEADER_HEIGHT + row * this.cellHeight + this.cellHeight / 2 + 0.5);
    });
  }
}

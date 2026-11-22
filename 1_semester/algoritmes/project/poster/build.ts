import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { Timetabler } from "../src/timetabler.ts";
import { Trouble } from "../demo/src/trouble.ts";

const DEMO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

const W = 841;
const H = 1189;
const M = 40;
const GAP = 24;
const COL = (W - 2 * M - GAP) / 2;

const BRAND = "#2C5697";
const DARK = "#1B365D";
const MID = "#517DB9";
const LIGHT = "#96C8E6";
const INK = "#333333";
const MUTED = "#666666";
const LINE = "#CCCCCC";
const TINT = "#E8EDF4";
const ORANGE = "#FF5725";

const BODY = 9.0;
const SMALL = 6.6;
const HEAD = 17;

const here = new URL(".", import.meta.url);
const font = (file: string) => readFileSync(new URL(`../demo/fonts/${file}`, here)).toString("base64");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function charWidth(c: string, bold: boolean): number {
  let w: number;
  if (c === " ") w = 0.25;
  else if ("iljI.,:;'|!()[]".includes(c)) w = 0.27;
  else if ("ftr".includes(c)) w = 0.37;
  else if ("mwMW".includes(c)) w = 0.82;
  else if (/[0-9]/.test(c)) w = 0.58;
  else if (/[A-ZА-Я]/.test(c)) w = 0.66;
  else w = 0.55;
  return bold ? w * 1.05 : w;
}

function measure(s: string, size: number, bold = false): number {
  let w = 0;
  for (const c of s) w += charWidth(c, bold);
  return w * size;
}

interface Token {
  text: string;
  bold: boolean;
}

function tokens(text: string): Token[] {
  const out: Token[] = [];
  text.split("**").forEach((part, i) => {
    for (const word of part.split(" ")) if (word) out.push({ text: word, bold: i % 2 === 1 });
  });
  return out;
}

function wrap(text: string, size: number, width: number, bold = false): Token[][] {
  const lines: Token[][] = [];
  let line: Token[] = [];
  let used = 0;
  const space = measure(" ", size);
  for (const token of tokens(text)) {
    const b = bold || token.bold;
    const w = measure(token.text, size, b);
    if (line.length && used + space + w > width) {
      lines.push(line);
      line = [];
      used = 0;
    }
    used += (line.length ? space : 0) + w;
    line.push({ text: token.text, bold: b });
  }
  if (line.length) lines.push(line);
  return lines;
}

function lineSvg(line: Token[]): string {
  const parts: string[] = [];
  let current: boolean | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length) parts.push(current ? `<tspan font-weight="700">${esc(buffer.join(" "))}</tspan>` : esc(buffer.join(" ")));
    buffer = [];
  };
  line.forEach((token, i) => {
    if (token.bold !== current) {
      flush();
      if (i > 0 && !/^[,.;:)]/.test(token.text)) parts.push(" ");
      current = token.bold;
    }
    buffer.push(token.text);
  });
  flush();
  return parts.join("");
}

interface TextOptions {
  size?: number;
  color?: string;
  bold?: boolean;
  lead?: number;
  anchor?: "start" | "middle" | "end";
}

function textBlock(x: number, y: number, width: number, text: string, options: TextOptions = {}): { svg: string; height: number } {
  const size = options.size ?? BODY;
  const lead = (options.lead ?? 1.42) * size;
  const lines = wrap(text, size, width, options.bold);
  const anchor = options.anchor ?? "start";
  const weight = options.bold ? ` font-weight="700"` : "";
  const svg = lines
    .map((line, i) => `<text x="${x}" y="${(y + size * 0.8 + i * lead).toFixed(2)}" font-size="${size}" fill="${options.color ?? INK}" text-anchor="${anchor}"${weight}>${lineSvg(line)}</text>`)
    .join("\n");
  return { svg, height: lines.length * lead };
}

class Column {
  readonly out: string[] = [];
  readonly x: number;
  readonly w: number;
  y: number;
  private first = true;

  constructor(x: number, y: number, w: number) {
    this.x = x;
    this.y = y;
    this.w = w;
  }

  heading(text: string) {
    if (!this.first) {
      this.y += 10;
      this.out.push(`<rect x="${this.x}" y="${this.y}" width="${this.w}" height="0.6" fill="${LINE}"/>`);
      this.y += 12;
    }
    this.first = false;
    this.out.push(`<rect x="${this.x}" y="${this.y}" width="22" height="2.4" fill="${BRAND}"/>`);
    this.y += 7;
    const block = textBlock(this.x, this.y, this.w, text, { size: HEAD, bold: true, color: DARK, lead: 1.15 });
    this.out.push(block.svg);
    this.y += block.height + 5;
  }

  sub(text: string) {
    const block = textBlock(this.x, this.y, this.w, text, { size: 10.5, bold: true, color: DARK, lead: 1.25 });
    this.out.push(block.svg);
    this.y += block.height + 2.5;
  }

  para(text: string, options: TextOptions = {}) {
    const block = textBlock(this.x, this.y, this.w, text, options);
    this.out.push(block.svg);
    this.y += block.height + 4;
  }

  bullets(items: string[], options: TextOptions = {}) {
    const size = options.size ?? BODY;
    for (const item of items) {
      this.out.push(`<rect x="${this.x}" y="${(this.y + size * 0.32).toFixed(2)}" width="${size * 0.42}" height="${size * 0.42}" fill="${options.color === "#FFFFFF" ? LIGHT : BRAND}"/>`);
      const block = textBlock(this.x + size * 1.1, this.y, this.w - size * 1.1, item, options);
      this.out.push(block.svg);
      this.y += block.height + 1.6;
    }
    this.y += 2.5;
  }

  figure(height: number, draw: (x: number, y: number, w: number) => string) {
    this.out.push(draw(this.x, this.y, this.w));
    this.y += height;
  }

  caption(text: string) {
    const block = textBlock(this.x, this.y, this.w, text, { size: SMALL, color: MUTED, lead: 1.35 });
    this.out.push(block.svg);
    this.y += block.height + 5;
  }

  space(h: number) {
    this.y += h;
  }
}

function hue(difficulty: number, hardest: number): string {
  return `hsl(${Math.round(125 * (1 - (difficulty - 1) / Math.max(1, hardest - 1)))} 80% 58%)`;
}

const schedule = new Timetabler().run(fileURLToPath(new URL("../instances/small-7.json", here)));
const problem = schedule.problem;
const instance = problem.instance;
const hardest = Math.max(...instance.subjects.map((s) => s.difficulty as number));
const troubleStart = Trouble.of(problem, schedule.start as Int32Array);
const troubleEnd = Trouble.of(problem, schedule.slotOf as Int32Array);
const poorStart = troubleStart.reduce((a, f) => a + (f ? 1 : 0), 0);
const poorEnd = troubleEnd.reduce((a, f) => a + (f ? 1 : 0), 0);
const SHOWN_CLASS = instance.classes[0].id;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function code(subject: string): string {
  const parts = subject.split("_");
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return parts.length === 1 ? cap(parts[0].slice(0, 4)) : cap(parts[0].slice(0, 2)) + cap(parts[1].slice(0, 2));
}

function classGrid(slotOf: ArrayLike<number>, flags: Uint8Array, x: number, y: number, w: number, title: string, note: string): string {
  const out: string[] = [];
  const cls = instance.classes.findIndex((c) => c.id === SHOWN_CLASS);
  const periods = instance.periodsPerDay;
  const days = instance.days;
  const cells: ({ subject: number; flag: number } | null)[][] = Array.from({ length: days }, () => Array(periods).fill(null));
  let lastPeriod = 0;
  for (let l = 0; l < problem.nLessons; l++) {
    if (problem.lessonClass[l] !== cls || slotOf[l] < 0) continue;
    const d = problem.dayOf(slotOf[l]);
    const p = problem.periodOf(slotOf[l]);
    cells[d][p] = { subject: problem.lessonSubject[l], flag: flags[l] };
    lastPeriod = Math.max(lastPeriod, p);
  }
  const rows = lastPeriod + 1;
  const labelW = 8;
  const cw = (w - labelW) / days;
  const ch = 11.2;
  out.push(`<text x="${x}" y="${y + 7}" font-size="10" font-weight="700" fill="${DARK}">${esc(title)}</text>`);
  const top = y + 13;
  for (let d = 0; d < days; d++) out.push(`<text x="${x + labelW + d * cw + cw / 2}" y="${top + 5}" font-size="${SMALL - 1}" fill="${MUTED}" text-anchor="middle">${DAYS[d]}</text>`);
  for (let p = 0; p < rows; p++) {
    const ry = top + 8 + p * ch;
    out.push(`<text x="${x + labelW - 2.5}" y="${ry + ch / 2 + 2}" font-size="${SMALL - 1}" fill="${MUTED}" text-anchor="end">${p + 1}</text>`);
    for (let d = 0; d < days; d++) {
      const cx = x + labelW + d * cw;
      const cell = cells[d][p];
      if (!cell) {
        out.push(`<rect x="${cx + 0.6}" y="${ry + 0.6}" width="${cw - 1.2}" height="${ch - 1.2}" fill="none" stroke="${LINE}" stroke-width="0.4"/>`);
        continue;
      }
      const subject = instance.subjects[cell.subject];
      out.push(`<rect x="${cx + 0.6}" y="${ry + 0.6}" width="${cw - 1.2}" height="${ch - 1.2}" fill="${hue(subject.difficulty as number, hardest)}"/>`);
      out.push(`<text x="${cx + cw / 2}" y="${ry + ch / 2 + 1.9}" font-size="5.4" fill="#14161A" text-anchor="middle" font-weight="500">${esc(code(subject.id))}</text>`);
      if (cell.flag) out.push(`<path d="M${cx + cw - 0.6} ${ry + 0.6} h-5 l5 5 z" fill="${DARK}"/>`);
    }
  }
  const bottom = top + 8 + rows * ch;
  out.push(`<text x="${x}" y="${bottom + 7}" font-size="${SMALL}" fill="${INK}">${note}</text>`);
  return out.join("\n");
}

function legend(x: number, y: number, w: number): string {
  const out: string[] = [];
  const n = 24;
  const barW = 95;
  for (let i = 0; i < n; i++) out.push(`<rect x="${x + (i * barW) / n}" y="${y}" width="${barW / n + 0.2}" height="5" fill="hsl(${Math.round(125 * (1 - i / (n - 1)))} 80% 58%)"/>`);
  out.push(`<text x="${x}" y="${y + 11}" font-size="${SMALL - 0.6}" fill="${MUTED}">easy subject</text>`);
  out.push(`<text x="${x + barW}" y="${y + 11}" font-size="${SMALL - 0.6}" fill="${MUTED}" text-anchor="end">hard subject</text>`);
  const tx = x + barW + 20;
  out.push(`<rect x="${tx}" y="${y - 1}" width="9" height="7" fill="${TINT}"/><path d="M${tx + 9} ${y - 1} h-5 l5 5 z" fill="${DARK}"/>`);
  out.push(`<text x="${tx + 12}" y="${y + 5}" font-size="${SMALL - 0.6}" fill="${MUTED}">lesson in a poor place: subject twice a day,</text>`);
  out.push(`<text x="${tx + 12}" y="${y + 11}" font-size="${SMALL - 0.6}" fill="${MUTED}">hard subject late, easy early, teacher's wish broken</text>`);
  void w;
  return out.join("\n");
}

function pipeline(x: number, y: number, w: number): string {
  const steps = [
    { n: "1", title: "Construct", algo: "DSATUR", text: "Place the lesson with the fewest free slots first, into its cheapest slot.", fill: DARK },
    { n: "2", title: "Improve", algo: "Simulated annealing", text: "Move a lesson, swap two lessons of a class, or swap a Kempe chain.", fill: BRAND },
    { n: "3", title: "Check", algo: "Exact & external", text: "HiGHS integer program as a reference; HSEval validator on exported XHSTT files.", fill: MID },
  ];
  const arrow = 9;
  const bw = (w - 2 * arrow) / 3;
  const bh = 58;
  const out: string[] = [];
  steps.forEach((s, i) => {
    const bx = x + i * (bw + arrow);
    out.push(`<rect x="${bx}" y="${y}" width="${bw}" height="${bh}" fill="${s.fill}"/>`);
    out.push(`<text x="${bx + 5}" y="${y + 11}" font-size="8" fill="#FFFFFF" font-weight="700" opacity="0.7">${s.n} ${s.title}</text>`);
    const t = textBlock(bx + 5, y + 15, bw - 10, s.algo, { size: 9.6, bold: true, color: "#FFFFFF", lead: 1.15 });
    out.push(t.svg);
    out.push(textBlock(bx + 5, y + 17 + t.height, bw - 10, s.text, { size: SMALL - 0.2, color: "#FFFFFF", lead: 1.32 }).svg);
    if (i < 2) {
      const ax = bx + bw + 1.5;
      out.push(`<path d="M${ax} ${y + bh / 2 - 5} l${arrow - 3} 5 l${-(arrow - 3)} 5 z" fill="${DARK}"/>`);
    }
  });
  return out.join("\n");
}

function kempe(x: number, y: number, w: number): string {
  const out: string[] = [];
  const colW = 92;
  const ax = x + 40;
  const bx = x + w - 40 - colW;
  const rowH = 15;
  const left = ["5A · Math · Aida", "6A · Physics · Bolat", "7A · English · Dana", "8A · History · Erlan"];
  const right = ["6A · Biology · Aida", "5A · Kazakh · Gulnar", "7A · Art · Bolat", "8A · Music · Farida"];
  const inChainL = [true, true, false, false];
  const inChainR = [true, true, true, false];
  const edges: [number, number][] = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 2],
  ];
  out.push(`<text x="${ax + colW / 2}" y="${y + 6}" font-size="${SMALL}" fill="${MUTED}" text-anchor="middle" font-weight="500">slot Mon 2</text>`);
  out.push(`<text x="${bx + colW / 2}" y="${y + 6}" font-size="${SMALL}" fill="${MUTED}" text-anchor="middle" font-weight="500">slot Wed 4</text>`);
  const top = y + 11;
  for (const [i, j] of edges) {
    const y1 = top + i * rowH + 5.5;
    const y2 = top + j * rowH + 5.5;
    out.push(`<line x1="${ax + colW}" y1="${y1}" x2="${bx}" y2="${y2}" stroke="${BRAND}" stroke-width="1.1"/>`);
  }
  const box = (bxx: number, row: number, label: string, on: boolean) => {
    const by = top + row * rowH;
    out.push(`<rect x="${bxx}" y="${by}" width="${colW}" height="11" fill="${on ? BRAND : TINT}"/>`);
    out.push(`<text x="${bxx + colW / 2}" y="${by + 7.5}" font-size="${SMALL - 0.4}" fill="${on ? "#FFFFFF" : DARK}" text-anchor="middle">${esc(label)}</text>`);
  };
  left.forEach((l, i) => box(ax, i, l, inChainL[i]));
  right.forEach((l, i) => box(bx, i, l, inChainR[i]));
  out.push(`<text x="${x + w / 2}" y="${top + 4 * rowH + 4}" font-size="${SMALL - 0.4}" fill="${MUTED}" text-anchor="middle">a line = same class or same teacher; blue lessons swap slots together</text>`);
  return out.join("\n");
}

function hbars(x: number, y: number, w: number, rows: { label: string; value: number; color: string; note?: string }[], max: number, unit: string): string {
  const out: string[] = [];
  const labelW = 92;
  const barMax = w - labelW - 34;
  const rh = 15;
  rows.forEach((r, i) => {
    const ry = y + i * rh;
    out.push(`<text x="${x + labelW - 4}" y="${ry + 7.6}" font-size="${SMALL + 0.4}" fill="${INK}" text-anchor="end">${esc(r.label)}</text>`);
    const bw = (r.value / max) * barMax;
    out.push(`<rect x="${x + labelW}" y="${ry}" width="${bw}" height="10.5" fill="${r.color}"/>`);
    out.push(`<text x="${x + labelW + bw + 2.5}" y="${ry + 7.8}" font-size="${SMALL + 1.4}" fill="${DARK}" font-weight="700">${r.value}${unit}</text>`);
  });
  out.push(`<line x1="${x + labelW}" y1="${y - 2}" x2="${x + labelW}" y2="${y + rows.length * rh - 2}" stroke="${INK}" stroke-width="0.4"/>`);
  return out.join("\n");
}

function curve(x: number, y: number, w: number, h: number): string {
  const pts = [
    { t: 0.1, c: 880.2, hard: 9 },
    { t: 0.3, c: 675.8, hard: 1 },
    { t: 1.0, c: 467.7, hard: 0 },
    { t: 2.9, c: 360.6, hard: 0 },
    { t: 10.1, c: 291.3, hard: 0 },
  ];
  const left = x + 24;
  const right = x + w - 8;
  const top = y + 12;
  const bottom = y + h - 16;
  const lx = (t: number) => left + ((Math.log10(t) + 1) / 2) * (right - left);
  const ly = (c: number) => bottom - (c / 1000) * (bottom - top);
  const out: string[] = [];
  for (const c of [0, 250, 500, 750, 1000]) {
    out.push(`<line x1="${left}" y1="${ly(c)}" x2="${right}" y2="${ly(c)}" stroke="${c ? LINE : INK}" stroke-width="${c ? 0.3 : 0.4}"/>`);
    out.push(`<text x="${left - 2.5}" y="${ly(c) + 2}" font-size="${SMALL - 0.8}" fill="${MUTED}" text-anchor="end">${c}</text>`);
  }
  for (const t of [0.1, 0.3, 1, 3, 10]) out.push(`<text x="${lx(t)}" y="${bottom + 7}" font-size="${SMALL - 0.8}" fill="${MUTED}" text-anchor="middle">${t} s</text>`);
  out.push(`<text x="${(left + right) / 2}" y="${bottom + 14}" font-size="${SMALL - 0.4}" fill="${MUTED}" text-anchor="middle">running time (log scale)</text>`);
  out.push(`<rect x="${lx(1) - 0.3}" y="${top}" width="${lx(10.1) - lx(1) + 0.6}" height="${bottom - top}" fill="${TINT}" opacity="0.8"/>`);
  out.push(`<text x="${lx(3)}" y="${top + 8}" font-size="${SMALL - 0.2}" fill="${DARK}" text-anchor="middle" font-weight="500">no hard violations</text>`);
  out.push(`<polyline points="${pts.map((p) => `${lx(p.t)},${ly(p.c)}`).join(" ")}" fill="none" stroke="${BRAND}" stroke-width="1.4"/>`);
  for (const p of pts) {
    if (p.hard) {
      const px = lx(p.t);
      const py = ly(p.c);
      out.push(`<path d="M${px - 2.4} ${py - 2.4} l4.8 4.8 M${px + 2.4} ${py - 2.4} l-4.8 4.8" stroke="#C42E3B" stroke-width="1.3"/>`);
      out.push(`<text x="${px + 3.5}" y="${py - 3}" font-size="${SMALL - 0.8}" fill="#C42E3B">${p.hard} hard</text>`);
    } else out.push(`<circle cx="${lx(p.t)}" cy="${ly(p.c)}" r="1.9" fill="${BRAND}"/>`);
  }
  out.push(`<text x="${left - 2.5}" y="${top - 7}" font-size="${SMALL - 0.4}" fill="${MUTED}">soft cost per 100 lessons</text>`);
  return out.join("\n");
}

function khe(x: number, y: number, w: number): string {
  const rows = [
    ["small-7", "7", "1", "0", "1.9 s", "3", "2.0 s", "khe"],
    ["heavy-4", "29", "1", "9", "10.3 s", "57", "11.9 s", "khe"],
    ["large-100", "100", "1", "75", "33.5 s", "192", "41.6 s", "khe"],
    ["medium-30", "30", "2", "1370", "33.3 s", "960", "2.6 s", "ours"],
    ["large-60", "60", "2", "1864", "72.1 s", "1432", "6.2 s", "ours"],
    ["large-100", "100", "2", "2177", "124.5 s", "1943", "11.8 s", "ours"],
  ];
  const cols = [0, 50, 82, 120, 170, 222, 272];
  const out: string[] = [];
  const head = ["school", "classes", "shifts", "KHE", "", "annealing", ""];
  const sub = ["", "", "", "cost", "time", "cost", "time"];
  const scale = w / 300;
  const cx = (i: number) => x + cols[i] * scale;
  head.forEach((t, i) => t && out.push(`<text x="${cx(i)}" y="${y + 6}" font-size="${SMALL}" font-weight="700" fill="${DARK}">${t}</text>`));
  sub.forEach((t, i) => t && out.push(`<text x="${cx(i)}" y="${y + 13}" font-size="${SMALL - 0.6}" fill="${MUTED}">${t}</text>`));
  out.push(`<rect x="${x}" y="${y + 16}" width="${w}" height="0.5" fill="${INK}"/>`);
  rows.forEach((r, i) => {
    const ry = y + 17 + i * 10.5;
    if (r[2] === "2" && rows[i - 1][2] === "1") out.push(`<rect x="${x}" y="${ry}" width="${w}" height="0.4" fill="${LINE}"/>`);
    const winner = r[7] === "khe" ? 3 : 5;
    const end = winner === 3 ? cols[5] : 300;
    out.push(`<rect x="${cx(winner) - 2}" y="${ry + 1.5}" width="${(end - cols[winner]) * scale - 4}" height="8.5" fill="${TINT}"/>`);
    for (let c = 0; c < 7; c++) out.push(`<text x="${cx(c)}" y="${ry + 7.6}" font-size="${SMALL}" fill="${INK}"${c === winner ? ` font-weight="700"` : ""}>${r[c]}</text>`);
  });
  return out.join("\n");
}

async function qr(x: number, y: number, size: number): Promise<string> {
  const code = QRCode.create(DEMO_URL, { errorCorrectionLevel: "M" });
  const n = code.modules.size;
  const quiet = 2;
  const cell = size / (n + 2 * quiet);
  const out: string[] = [`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#FFFFFF"/>`];
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (code.modules.get(r, c)) d += `M${(x + (c + quiet) * cell).toFixed(3)} ${(y + (r + quiet) * cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h${(-cell).toFixed(3)}z`;
  out.push(`<path d="${d}" fill="${DARK}"/>`);
  return out.join("\n");
}

const HEADER_H = 190;
const STRIP_H = 46;
const FOOTER_H = 112;
const BAND_H = 112;

const LOGO_W = 200;
const LOGO_H = (LOGO_W * 105.88) / 779.18;
const logo = readFileSync(new URL("ut-logo-white.svg", here), "utf8")
  .replace(/<\?xml[^>]*>\s*/, "")
  .replace(/<!--[\s\S]*?-->\s*/g, "")
  .replace(/<svg\b[^>]*>/, `<svg x="${M}" y="26" width="${LOGO_W}" height="${LOGO_H.toFixed(2)}" viewBox="0 0 779.18 105.88">`)
  .replace(/<style[\s\S]*?<\/style>/, "")
  .replace(/class="st2"/g, `fill="#FFFFFF"`);

const header = `
<rect x="0" y="0" width="${W}" height="${HEADER_H}" fill="${BRAND}"/>
<rect x="${W - 210}" y="-120" width="320" height="300" fill="${MID}" transform="rotate(15 ${W - 50} 30)"/>
${logo}
<text x="${M}" y="100" font-size="36" font-weight="700" fill="#FFFFFF">School timetabling</text>
<text x="${M}" y="139" font-size="36" font-weight="700" fill="#FFFFFF">by heuristic optimisation</text>
<text x="${M}" y="165" font-size="12.5" fill="#FFFFFF" font-weight="500">Ruslan Nechshadimov</text>
<text x="${M}" y="179" font-size="10" fill="#FFFFFF">Algorithmics (MTAT.03.238) · Institute of Computer Science · November 2026</text>
<rect x="0" y="${HEADER_H}" width="${W}" height="${STRIP_H}" fill="${DARK}"/>
<text x="${M}" y="${HEADER_H + 29}" font-size="13" fill="#FFFFFF">A clash-free weekly timetable for a <tspan font-weight="700">100-class school in 1 second</tspan>, polished in 10 seconds.</text>
<rect x="${M}" y="${HEADER_H + STRIP_H - 4}" width="60" height="4" fill="${ORANGE}"/>
`;

const top = HEADER_H + STRIP_H + 28;
const L = new Column(M, top, COL);
const R = new Column(M + COL + GAP, top, COL);

L.heading("The problem");
L.para("Schools in Kazakhstan still build timetables by hand: **20–100 classes** in grades 5–11, **up to 170 teachers**, two shifts, subgroup lessons with two teachers.");
L.para("Clashes alone already make it **graph colouring** (lessons are vertices, a shared class or teacher is an edge, slots are colours), so the problem is NP-hard.");
L.sub("Hard rules: must hold");
L.bullets(["no clash for a class or a teacher; every lesson placed", "class stays inside its shift and has no gaps in its day", "teacher is not booked when unavailable"]);
L.sub("Soft rules: weighted penalty to minimise");
L.bullets([
  "same subject twice a day; hard subjects late, easy ones early",
  "uneven daily difficulty by the official subject scores (ҚР ДСМ-76 [6])",
  "teacher gaps (squared), switches between shifts, broken teacher wishes",
]);
L.heading("Method");
L.figure(65, (x, y, w) => pipeline(x, y, w));
L.para("**Annealing** starts from the DSATUR timetable and accepts a worse one with probability exp(−Δ/T), T = 20 → 1, 1000 moves per lesson. A broken hard rule costs 1000, so the search may pass through infeasible timetables and repair them.");
L.sub("Kempe chain move");
L.figure(82, (x, y, w) => kempe(x, y, w));
L.para("Take two slots and one lesson in them, then everything linked to it by a shared class or teacher. Swapping the whole chain **never creates a clash**. Chains are short: median 2 lessons, capped at 16.");
L.sub("What the two steps do to one class");
L.space(1);
L.figure(108, (x, y, w) => {
  const gw = (w - 16) / 2;
  return [
    classGrid(schedule.start, troubleStart, x, y, gw, "After DSATUR", `${poorStart} lessons in a poor place (whole school)`),
    classGrid(schedule.slotOf, troubleEnd, x + gw + 16, y, gw, "After annealing", `${poorEnd} lessons in a poor place (whole school)`),
  ].join("\n");
});
L.figure(18, (x, y, w) => legend(x, y, w));
L.caption(`Timetable of class ${SHOWN_CLASS} in a generated 7-class school (${problem.nLessons} lessons), produced by the solver itself.`);

R.heading("Results");
R.figure(65, (x, y, w) => {
  const items = [
    { big: "1 s", text: "to a feasible timetable for 100 classes, 3,208 lessons, 171 teachers" },
    { big: "63 / 64", text: "dense schools at default settings, the 64th with 4000 moves per lesson; DSATUR alone solves 19" },
  ];
  const out = [`<rect x="${x}" y="${y}" width="${w}" height="57" fill="${TINT}"/>`];
  items.forEach((it, i) => {
    const iy = y + 4 + i * 26.5;
    if (i) out.push(`<rect x="${x + 6}" y="${iy - 1.5}" width="${w - 12}" height="0.4" fill="${LINE}"/>`);
    out.push(`<text x="${x + 6}" y="${iy + 13}" font-size="16" font-weight="700" fill="${DARK}">${it.big}</text>`);
    out.push(textBlock(x + 82, iy + 3.5, w - 90, it.text, { size: BODY - 0.6, lead: 1.3 }).svg);
  });
  return out.join("\n");
});
R.sub("Kempe chains make dense schools feasible");
R.figure(50, (x, y, w) =>
  hbars(
    x,
    y,
    w,
    [
      { label: "DSATUR", value: 19, color: MID },
      { label: "+ annealing", value: 58, color: BRAND },
      { label: "+ Kempe chains", value: 63, color: DARK },
    ],
    64,
    " / 64",
  ),
);
R.caption("64 schools with a feasible timetable proved by HiGHS; the busiest teacher is booked up to 97 % of the week. Final weights, same set for all three. At equal running time Kempe chains also lower the soft cost by about 15 %, more than all parameter tuning together (3 %).");
R.sub("Annealing beats tabu search at equal time");
R.figure(66, (x, y, w) =>
  hbars(
    x,
    y,
    w,
    [
      { label: "normal: annealing", value: 274.7, color: BRAND },
      { label: "tabu search", value: 301.3, color: LIGHT },
      { label: "dense: annealing", value: 344.7, color: BRAND },
      { label: "tabu search", value: 418.5, color: LIGHT },
    ],
    420,
    "",
  ),
);
R.caption("Soft cost per 100 lessons, lower is better; 30 normal and 64 dense schools, same moves and same time. Tabu search spends 100 evaluations per step, annealing one, so annealing takes 100× more steps.");
R.sub("Quality grows with time, size is not a problem");
R.figure(96, (x, y, w) => curve(x, y, w, 94));
R.caption("100-class school, one shift. Running time grows linearly with the number of lessons: 7 s for 60 classes, 10 s for 100.");
R.sub("Against KHE, a specialised solver");
R.figure(86, (x, y, w) => khe(x, y, w));
R.caption("Common cost that both programs can express (no difficulty rules), costs re-checked by our XHSTT evaluator; the better result is shaded. KHE wins on one-shift schools, annealing wins on two-shift schools and is 3–13× faster.");

R.heading("What we do not know yet");
R.bullets([
  "All schools are generated from real curricula and rules; **no real school** has been timetabled yet.",
  "The weights encode our priorities; only a deputy head can confirm them.",
  "Distance to the optimum: best lower bound 42 vs our 75 on the smallest school.",
  "HSEval sees up to a third of the soft cost: daily difficulty and half-day rules are not exported, they are cross-checked by our exact model only.",
]);

const used = Math.max(L.y, R.y);
const footerY = H - FOOTER_H;
const bandY = footerY - BAND_H;

function band(): string {
  const out: string[] = [`<rect x="0" y="${bandY}" width="${W}" height="${BAND_H}" fill="${TINT}"/>`];
  out.push(`<rect x="${M}" y="${bandY + 14}" width="22" height="2.4" fill="${BRAND}"/>`);
  out.push(`<text x="${M}" y="${bandY + 35}" font-size="${HEAD}" font-weight="700" fill="${DARK}">Checked by the official validator</text>`);
  const steps = [
    { title: "Our solver", text: "DSATUR + annealing", fill: DARK },
    { title: "XHSTT file", text: "our own exporter", fill: BRAND },
    { title: "HSEval", text: "the format's reference validator", fill: MID },
  ];
  const arrow = 9;
  const bw = (COL - 2 * arrow) / 3;
  const by = bandY + 44;
  steps.forEach((s, i) => {
    const bx = M + i * (bw + arrow);
    out.push(`<rect x="${bx}" y="${by}" width="${bw}" height="26" fill="${s.fill}"/>`);
    out.push(`<text x="${bx + 5}" y="${by + 11}" font-size="9.6" font-weight="700" fill="#FFFFFF">${s.title}</text>`);
    out.push(textBlock(bx + 5, by + 14, bw - 8, s.text, { size: SMALL - 0.4, color: "#FFFFFF", lead: 1.25 }).svg);
    if (i < 2) out.push(`<path d="M${bx + bw + 1.5} ${by + 8} l${arrow - 3} 5 l${-(arrow - 3)} 5 z" fill="${DARK}"/>`);
  });
  out.push(
    textBlock(M, by + 31, COL, "We wrote a reader and a writer for XHSTT, the standard format of school timetabling, and ran our timetables through HSEval. It accepted every file and re-scored every timetable to the same numbers. Our reader also loads all 25 schools of the public XHSTT archive.", {
      size: BODY - 0.8,
      lead: 1.35,
    }).svg,
  );
  const rx = M + COL + GAP;
  const items = [
    { big: "139 / 139", text: "timetables: the validator's cost equals ours, to the point" },
    { big: "65 / 65", text: "schools, 100 classes included: zero hard violations in our annealing timetables by the validator" },
    { big: "3 ways", text: "hard rules, repeats, teacher gaps, shifts and wishes agree in our solver, our exact model and HSEval" },
  ];
  items.forEach((it, i) => {
    const iy = bandY + 16 + i * 31;
    if (i) out.push(`<rect x="${rx}" y="${iy - 3}" width="${COL}" height="0.4" fill="${LINE}"/>`);
    out.push(`<text x="${rx}" y="${iy + 15}" font-size="18" font-weight="700" fill="${DARK}">${it.big}</text>`);
    out.push(textBlock(rx + 92, iy + 2.5, COL - 92, it.text, { size: BODY - 0.6, lead: 1.3 }).svg);
  });
  return out.join("\n");
}

const references = [
  "[1] Post et al. XHSTT: an XML archive for high school timetabling problems. Annals of OR, 2014",
  "[2] Brélaz. New methods to color the vertices of a graph. CACM, 1979",
  "[3] Kirkpatrick, Gelatt, Vecchi. Optimization by simulated annealing. Science, 1983",
  "[4] Kingston. KHE and HSEval, jeffreykingston.id.au",
  "[5] Huangfu, Hall. Parallelizing the dual revised simplex method (HiGHS). Math. Prog. Comp., 2018",
  "[6] Sanitary Rules of Kazakhstan, Order of the Minister of Healthcare No. ҚР ДСМ-76, 2021. adilet.zan.kz",
];

const qrSize = 80;
const footer = `
<rect x="0" y="${footerY}" width="${W}" height="${FOOTER_H}" fill="${DARK}"/>
${await qr(M, footerY + 16, qrSize)}
<text x="${M + qrSize + 18}" y="${footerY + 36}" font-size="16" font-weight="700" fill="#FFFFFF">Try it in the browser</text>
${textBlock(M + qrSize + 18, footerY + 44, 250, "Build your own school and watch DSATUR, annealing and Kempe chains work step by step. Same code as the solver.", { size: BODY, color: "#FFFFFF", lead: 1.35 }).svg}
${references.map((r, i) => `<text x="${M + COL + GAP}" y="${footerY + 30 + i * 10}" font-size="${SMALL - 0.4}" fill="#FFFFFF">${esc(r)}</text>`).join("\n")}
<text x="${M + COL + GAP}" y="${footerY + 96}" font-size="${SMALL - 0.4}" fill="#FFFFFF" opacity="0.8">TypeScript on Node.js · tests in Vitest · exact model with HiGHS</text>
`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">
<style>
@font-face { font-family: Rubik; font-weight: 300 900; src: url(data:font/woff2;base64,${font("rubik-latin.woff2")}) format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: Rubik; font-weight: 300 900; src: url(data:font/woff2;base64,${font("rubik-cyrillic.woff2")}) format("woff2"); unicode-range: U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+04A0-04FF, U+2116; }
text { font-family: Rubik, Arial, sans-serif; }
</style>
<rect width="${W}" height="${H}" fill="#FFFFFF"/>
${header}
${L.out.join("\n")}
${R.out.join("\n")}
${band()}
${footer}
</svg>
`;

writeFileSync(new URL("poster.svg", here), svg);
writeFileSync(
  new URL("poster.html", here),
  `<!doctype html><html><head><meta charset="utf-8"><style>@page { size: ${W}mm ${H}mm; margin: 0; } html, body { margin: 0; padding: 0; } svg { display: block; width: ${W}mm; height: ${H}mm; }</style></head><body>${svg}</body></html>`,
);
console.log(`left column ends at ${L.y.toFixed(0)}, right at ${R.y.toFixed(0)}, band starts at ${bandY}; content bottom ${used.toFixed(0)}`);
console.log(`poor places: DSATUR ${poorStart}, annealing ${poorEnd}, lessons ${problem.nLessons}`);

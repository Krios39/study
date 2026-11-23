import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import QRCode from "qrcode";

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

const GREY = "#767676";
const SLOT = ["", "#0072B2", "#D55E00", "#009E73", "#882255"];

interface Node {
  id: string;
  label: string;
  teacher: string;
  x: number;
  y: number;
  slot: number;
}

const NODES: Node[] = [
  { id: "a", label: "5A Math", teacher: "Aida", x: 22, y: 18, slot: 1 },
  { id: "b", label: "5A Eng", teacher: "Dana", x: 87, y: 18, slot: 2 },
  { id: "c", label: "5A Phys", teacher: "Bolat", x: 152, y: 18, slot: 3 },
  { id: "d", label: "6A Math", teacher: "Aida", x: 22, y: 54, slot: 2 },
  { id: "e", label: "6A Eng", teacher: "Dana", x: 87, y: 54, slot: 3 },
  { id: "f", label: "6A Phys", teacher: "Bolat", x: 152, y: 54, slot: 1 },
  { id: "g", label: "6A Hist", teacher: "Erlan", x: 22, y: 90, slot: 4 },
  { id: "h", label: "7A Bio", teacher: "Gulnar", x: 87, y: 90, slot: 1 },
  { id: "i", label: "7A Art", teacher: "Farida", x: 152, y: 90, slot: 2 },
];

const EDGES: { u: string; v: string; kind: "class" | "teacher"; bend?: number }[] = [
  { u: "a", v: "b", kind: "class" },
  { u: "b", v: "c", kind: "class" },
  { u: "a", v: "c", kind: "class", bend: -14 },
  { u: "d", v: "e", kind: "class" },
  { u: "e", v: "f", kind: "class" },
  { u: "d", v: "f", kind: "class", bend: -11 },
  { u: "d", v: "g", kind: "class" },
  { u: "e", v: "g", kind: "class" },
  { u: "f", v: "g", kind: "class" },
  { u: "h", v: "i", kind: "class" },
  { u: "a", v: "d", kind: "teacher" },
  { u: "b", v: "e", kind: "teacher" },
  { u: "c", v: "f", kind: "teacher" },
];

const CHAIN = new Set(["a", "b", "d", "f"]);

function graphPanel(x: number, y: number, w: number, after: boolean): string {
  const s = w / 175;
  const out: string[] = [];
  const pos = new Map(NODES.map((n) => [n.id, { x: x + n.x * s, y: y + n.y * s }]));
  const slotOf = (n: Node) => (after && CHAIN.has(n.id) ? (n.slot === 1 ? 2 : 1) : n.slot);
  const faded = (n: Node) => after && slotOf(n) > 2;
  for (const e of EDGES) {
    const p = pos.get(e.u)!;
    const q = pos.get(e.v)!;
    const inChain = after && CHAIN.has(e.u) && CHAIN.has(e.v);
    const nu = NODES.find((n) => n.id === e.u)!;
    const nv = NODES.find((n) => n.id === e.v)!;
    const dim = after && !inChain && (faded(nu) || faded(nv));
    const stroke = inChain ? DARK : GREY;
    const width = inChain ? 1.6 : 0.7;
    const dash = e.kind === "teacher" ? ` stroke-dasharray="2.2 1.6"` : "";
    const opacity = dim ? ` opacity="0.35"` : "";
    const d = e.bend ? `M${p.x} ${p.y} Q${(p.x + q.x) / 2} ${p.y + e.bend * s * 2} ${q.x} ${q.y}` : `M${p.x} ${p.y} L${q.x} ${q.y}`;
    out.push(`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}"${dash}${opacity}/>`);
  }
  const bw = 46 * s;
  const bh = 15 * s;
  for (const n of NODES) {
    const p = pos.get(n.id)!;
    const slot = slotOf(n);
    const color = SLOT[slot];
    const bx = p.x - bw / 2;
    const by = p.y - bh / 2;
    const opacity = faded(n) ? ` opacity="0.35"` : "";
    const ring = after && CHAIN.has(n.id) ? `<rect x="${bx - 1.2}" y="${by - 1.2}" width="${bw + 2.4}" height="${bh + 2.4}" fill="none" stroke="${DARK}" stroke-width="1.1"/>` : "";
    out.push(`<g${opacity}>${ring}<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#FFFFFF" stroke="${color}" stroke-width="0.9"/>`);
    out.push(`<rect x="${bx}" y="${by}" width="${bh}" height="${bh}" fill="${color}"/>`);
    out.push(`<text x="${bx + bh / 2}" y="${by + bh / 2 + 2.3}" font-size="7.4" font-weight="700" fill="#FFFFFF" text-anchor="middle">${slot}</text>`);
    out.push(`<text x="${bx + bh + 1.6}" y="${by + bh * 0.45}" font-size="5.9" font-weight="700" fill="${DARK}">${n.label}</text>`);
    out.push(`<text x="${bx + bh + 1.6}" y="${by + bh * 0.88}" font-size="5.3" fill="${MUTED}">${n.teacher}</text></g>`);
  }
  return out.join("\n");
}

type LegendKey = "class" | "teacher" | "slot" | "chain" | "faded";

function legendItem(key: LegendKey, x: number, y: number): string {
  if (key === "class") return `<line x1="${x}" y1="${y}" x2="${x + 10}" y2="${y}" stroke="${GREY}" stroke-width="0.8"/>`;
  if (key === "teacher") return `<line x1="${x}" y1="${y}" x2="${x + 10}" y2="${y}" stroke="${GREY}" stroke-width="0.8" stroke-dasharray="2.2 1.6"/>`;
  if (key === "slot") return `<rect x="${x + 2}" y="${y - 3}" width="6" height="6" fill="${SLOT[1]}"/>`;
  if (key === "chain") return `<rect x="${x}" y="${y - 3.2}" width="10" height="6.4" fill="none" stroke="${DARK}" stroke-width="1.1"/>`;
  return `<rect x="${x}" y="${y - 3.2}" width="10" height="6.4" fill="#FFFFFF" stroke="${SLOT[3]}" stroke-width="0.9" opacity="0.35"/>`;
}

function graphFigure(x: number, y: number, w: number, after: boolean, title: string, text: string, legend: [LegendKey, string][]): { svg: string; height: number } {
  const gap = 12;
  const pw = (w - gap) / 2;
  const out: string[] = [];
  out.push(`<text x="${x}" y="${y + 5}" font-size="${SMALL + 0.4}" font-weight="700" fill="${DARK}">${esc(title)}</text>`);
  out.push(graphPanel(x, y + 9, pw, after));
  const tx = x + pw + gap;
  const body = textBlock(tx, y + 9, pw, text, { size: BODY - 0.8, lead: 1.36 });
  out.push(body.svg);
  let ly = y + 9 + body.height + 5;
  for (const [key, label] of legend) {
    out.push(legendItem(key, tx, ly));
    const t = textBlock(tx + 14, ly - SMALL * 0.62, pw - 14, label, { size: SMALL - 0.4, lead: 1.3 });
    out.push(t.svg);
    ly += Math.max(8, t.height + 1.5);
  }
  const height = Math.max(9 + (104 * pw) / 175, ly - y);
  return { svg: out.join("\n"), height };
}

const requireCjs = createRequire(import.meta.url);
const { mathjax } = requireCjs("mathjax-full/js/mathjax.js");
const { TeX } = requireCjs("mathjax-full/js/input/tex.js");
const { SVG } = requireCjs("mathjax-full/js/output/svg.js");
const { liteAdaptor } = requireCjs("mathjax-full/js/adaptors/liteAdaptor.js");
const { RegisterHTMLHandler } = requireCjs("mathjax-full/js/handlers/html.js");
const { AllPackages } = requireCjs("mathjax-full/js/input/tex/AllPackages.js");
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const mathDoc = mathjax.document("", { InputJax: new TeX({ packages: AllPackages }), OutputJax: new SVG({ fontCache: "none" }) });

function tex(src: string, x: number, y: number, size: number): { svg: string; width: number; height: number } {
  const raw: string = adaptor.innerHTML(mathDoc.convert(src, { display: true }));
  const ex = size * 0.442;
  const w = Number(/width="([\d.]+)ex"/.exec(raw)![1]) * ex;
  const h = Number(/height="([\d.]+)ex"/.exec(raw)![1]) * ex;
  const svg = raw
    .replace(/ style="[^"]*"/, "")
    .replace(/width="[\d.]+ex"/, `x="${x}" y="${y}" width="${w.toFixed(2)}"`)
    .replace(/height="[\d.]+ex"/, `height="${h.toFixed(2)}"`)
    .replace(/currentColor/g, INK);
  return { svg, width: w, height: h };
}

function hbars(x: number, y: number, w: number, rows: { label: string; value: number; color: string }[], max: number, unit: string, labelW: number): string {
  const out: string[] = [];
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
    { t: 0.1, c: 888.7, note: "3 / 3 schools infeasible" },
    { t: 0.3, c: 639.6, note: "2 / 3 infeasible" },
    { t: 1.0, c: 461.0, note: "" },
    { t: 3.0, c: 352.9, note: "" },
    { t: 10.0, c: 288.8, note: "" },
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
  out.push(`<rect x="${lx(1) - 0.3}" y="${top}" width="${lx(10) - lx(1) + 0.6}" height="${bottom - top}" fill="${TINT}" opacity="0.8"/>`);
  out.push(`<text x="${lx(3)}" y="${top + 8}" font-size="${SMALL - 0.2}" fill="${DARK}" text-anchor="middle" font-weight="500">all three schools feasible</text>`);
  out.push(`<polyline points="${pts.map((p) => `${lx(p.t)},${ly(p.c)}`).join(" ")}" fill="none" stroke="${BRAND}" stroke-width="1.4"/>`);
  for (const p of pts) {
    const px = lx(p.t);
    const py = ly(p.c);
    if (p.note) {
      out.push(`<path d="M${px - 2.4} ${py - 2.4} l4.8 4.8 M${px + 2.4} ${py - 2.4} l-4.8 4.8" stroke="#C42E3B" stroke-width="1.3"/>`);
      out.push(`<text x="${px + 3.5}" y="${py - 3}" font-size="${SMALL - 0.8}" fill="#C42E3B">${p.note}</text>`);
    } else out.push(`<circle cx="${px}" cy="${py}" r="1.9" fill="${BRAND}"/>`);
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
  const subHead = ["", "", "", "cost", "time", "cost", "time"];
  const scale = w / 300;
  const cx = (i: number) => x + cols[i] * scale;
  head.forEach((t, i) => t && out.push(`<text x="${cx(i)}" y="${y + 6}" font-size="${SMALL}" font-weight="700" fill="${DARK}">${t}</text>`));
  subHead.forEach((t, i) => t && out.push(`<text x="${cx(i)}" y="${y + 13}" font-size="${SMALL - 0.6}" fill="${MUTED}">${t}</text>`));
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

const HEADER_H = 190;
const STRIP_H = 40;
const FOOTER_H = 100;
const BAND_H = 104;

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
<text x="${M}" y="${HEADER_H + 25}" font-size="11.5" fill="#FFFFFF">A clash-free timetable is a <tspan font-weight="700">proper colouring of the conflict graph</tspan>: DSATUR builds one, <tspan font-weight="700">simulated annealing with Kempe chains</tspan> improves it.</text>
<rect x="${M}" y="${HEADER_H + STRIP_H - 4}" width="60" height="4" fill="${ORANGE}"/>
`;

function pipeline(x: number, y: number, w: number): string {
  const steps = [
    { n: "1", title: "Construct", algo: "DSATUR", text: "Lesson with the fewest free slots first, into the slot with the smallest penalty.", fill: DARK },
    { n: "2", title: "Improve", algo: "Simulated annealing", text: "N1 move a lesson, N2 swap two lessons of a class, N3 Kempe chain (≤ 16 lessons).", fill: BRAND },
    { n: "3", title: "Check", algo: "Exact & external", text: "Integer program (HiGHS): feasibility and lower bounds. HSEval: external cost.", fill: MID },
  ];
  const arrow = 9;
  const bw = (w - 2 * arrow) / 3;
  const bh = 60;
  const out: string[] = [];
  steps.forEach((s, i) => {
    const bx = x + i * (bw + arrow);
    out.push(`<rect x="${bx}" y="${y}" width="${bw}" height="${bh}" fill="${s.fill}"/>`);
    out.push(`<text x="${bx + 5}" y="${y + 11}" font-size="8" fill="#FFFFFF" font-weight="700" opacity="0.75">${s.n} ${s.title}</text>`);
    const t = textBlock(bx + 5, y + 15, bw - 10, s.algo, { size: 9.4, bold: true, color: "#FFFFFF", lead: 1.15 });
    out.push(t.svg);
    out.push(textBlock(bx + 5, y + 17 + t.height, bw - 10, s.text, { size: SMALL - 0.2, color: "#FFFFFF", lead: 1.32 }).svg);
    if (i < 2) out.push(`<path d="M${bx + bw + 1.5} ${y + bh / 2 - 5} l${arrow - 3} 5 l${-(arrow - 3)} 5 z" fill="${DARK}"/>`);
  });
  return out.join("\n");
}

function bigNumbers(x: number, y: number, w: number, items: { big: string; text: string }[], numberW: number): { svg: string; height: number } {
  const rowH = 25;
  const h = items.length * rowH + 6;
  const out = [`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${TINT}"/>`];
  items.forEach((it, i) => {
    const iy = y + 4 + i * rowH;
    if (i) out.push(`<rect x="${x + 6}" y="${iy - 1.5}" width="${w - 12}" height="0.4" fill="${LINE}"/>`);
    out.push(`<text x="${x + 6}" y="${iy + 14}" font-size="16" font-weight="700" fill="${DARK}">${it.big}</text>`);
    out.push(textBlock(x + numberW, iy + 3.5, w - numberW - 8, it.text, { size: BODY - 0.8, lead: 1.3 }).svg);
  });
  return { svg: out.join("\n"), height: h };
}

const top = HEADER_H + STRIP_H + 24;
const L = new Column(M, top, COL);
const R = new Column(M + COL + GAP, top, COL);

L.heading("The problem");
L.para("Weekly timetables for secondary schools in Kazakhstan, grades 5–11: 20–100 classes, up to 170 teachers, one or two shifts, subgroup lessons with two teachers. Each requirement (class, subject, teachers, h hours a week) gives h **lessons** L; slots S = days × periods; a timetable is a map σ: L → S.");
{
  const f = graphFigure(
    L.x,
    L.y,
    L.w,
    false,
    "Fig. 1. Conflict graph of a toy school",
    "**Conflict graph** G = (L, E): lessons are adjacent if they share a class or a teacher. A clash-free timetable is exactly a **proper colouring** of G with |S| colours, so the problem is NP-hard already without the other rules.",
    [
      ["class", "same class"],
      ["teacher", "same teacher"],
      ["slot", "time slot of the lesson; colour repeats the number"],
    ],
  );
  L.out.push(f.svg);
  L.y += f.height + 6;
}

L.sub("Hard constraints");
L.bullets([
  "**H1** no clash of a class or a teacher (proper colouring of G); **H2** every lesson placed",
  "**H3** a class stays inside its shift; **H4** no gaps in its day; **H5** teacher available",
]);
L.sub("Objective");
{
  const f = tex("\\min_{\\sigma}\\; f(\\sigma) \\;=\\; 1000\\cdot h(\\sigma) \\;+\\; \\sum_{k} w_k\\, f_k(\\sigma)", L.x, L.y, BODY + 1.4);
  L.out.push(f.svg);
  L.y += f.height + 2;
}
{
  const symbolW = 32;
  const rows: [string, string][] = [
    ["\\sigma", "timetable, the slot of every lesson"],
    ["h(\\sigma)", "number of violated hard constraints H1–H5"],
    ["f_k(\\sigma)", "soft term k, e.g. repeats of a subject in a day, teacher gaps"],
    ["w_k", "its weight: **100** per repeat, **50** per broken teacher wish, **10** per hard subject late in the day, **3** per squared teacher gap"],
  ];
  for (const [symbol, text] of rows) {
    const t = textBlock(L.x + symbolW, L.y, L.w - symbolW, text, { size: BODY - 0.4, lead: 1.38 });
    const s = tex(symbol, L.x, L.y, BODY);
    const mid = L.y + (BODY - 0.4) * 0.62;
    L.out.push(s.svg.replace(/ y="[\d.]+"/, ` y="${(mid - s.height / 2).toFixed(2)}"`));
    L.out.push(t.svg);
    L.y += t.height + 1.5;
  }
  L.y += 3;
}

L.heading("Method");
L.figure(66, (x, y, w) => pipeline(x, y, w));
L.para("**DSATUR** colours the most saturated lesson first, the one with the fewest slots still free of clashes; the slot is chosen by a penalty for gaps and repeats.");
L.para("**Simulated annealing** starts from that timetable. Each step proposes N1, N2 or N3 (Kempe chains in half of the steps) and accepts a worse timetable with probability exp(−Δ/T); T cools geometrically from 20 to 1 over 1000 proposals per lesson, Δ is computed only on the changed lessons. Hard constraints are only penalised, so the search may pass through infeasible timetables.");
{
  const f = graphFigure(
    L.x,
    L.y,
    L.w,
    true,
    "Fig. 2. Kempe chain move N3 on the graph of Fig. 1",
    "**Kempe chain** K(v; i, j): the component containing v of the subgraph induced by slots i and j. Swapping i ↔ j on all of K keeps the colouring proper. Here v = 5A Math, slots 1 and 2: four lessons of 5A and 6A move together, while 7A also uses slots 1 and 2 but lies in another component and stays.",
    [
      ["chain", "lesson in K(5A Math; 1, 2), now in the other slot"],
      ["faded", "slots 3 and 4, not involved"],
    ],
  );
  L.out.push(f.svg);
  L.y += f.height + 6;
}

R.heading("Results");
{
  const b = bigNumbers(
    R.x,
    R.y,
    R.w,
    [
      { big: "1 s", text: "to a feasible timetable for 100 classes, 3,208 lessons" },
      { big: "63 / 64", text: "dense schools solved; 58 without Kempe chains, 19 by DSATUR alone" },
    ],
    84,
  );
  R.out.push(b.svg);
  R.y += b.height + 5;
}
R.para("Schools are generated from the national curricula and sanitary rules. **Dense set**: 64 one-shift schools with teacher load 26–40 lessons a week, each certified feasible by the integer program. **Normal set**: 30 schools. **Large**: 6 schools with 100 classes. **Baseline**: tabu search on the same neighbourhoods, best of 100 random proposals per step. Cost per 100 lessons, one seed per run.", { size: BODY - 0.6 });

R.sub("Kempe chains make dense schools feasible");
R.figure(50, (x, y, w) =>
  hbars(
    x,
    y + 2,
    w,
    [
      { label: "DSATUR", value: 19, color: "#949494" },
      { label: "+ annealing, N1–N2", value: 58, color: MID },
      { label: "+ Kempe chains", value: 63, color: DARK },
    ],
    64,
    " / 64",
    100,
  ),
);
R.caption("Dense schools without hard violations. Without Kempe chains annealing starts to fail when the busiest teacher is booked for 88 % of the week or more. The one school left is solved with another seed or 4000 proposals per lesson.");

R.sub("Annealing beats tabu search at the same budget");
R.figure(80, (x, y, w) =>
  hbars(
    x,
    y + 2,
    w,
    [
      { label: "normal: annealing + Kempe", value: 274.7, color: DARK },
      { label: "tabu search", value: 301.3, color: "#949494" },
      { label: "dense: annealing + Kempe", value: 344.7, color: DARK },
      { label: "tabu search", value: 418.5, color: "#949494" },
      { label: "annealing, no Kempe", value: 518.4, color: MID },
    ],
    520,
    "",
    100,
  ),
);
R.caption("Soft cost per 100 lessons, lower is better; 1000 proposals per lesson for every method. Tabu search spends 100 proposals per step, annealing one, so annealing takes 100× more steps.");

R.sub("Quality grows with time, size is not a problem");
R.figure(90, (x, y, w) => curve(x, y, w, 88));
R.caption("Three one-shift schools with 100 classes (3,208 lessons), mean cost. Two-shift schools are feasible from the first point. Running time grows linearly with the number of lessons.");

R.sub("Against KHE, a dedicated XHSTT solver");
R.figure(84, (x, y, w) => khe(x, y, w));
R.caption("KHE 2.14 on the cost both can express (no difficulty or half-day terms); the better result is shaded. KHE wins on one-shift schools, annealing on two-shift schools and is 3–13× faster.");

R.heading("What we do not know yet");
R.bullets(
  [
    "All schools are generated; no real school has been timetabled.",
    "The weights reflect our priorities and are not validated by schools.",
    "Gap to the optimum: best lower bound 42 vs our 75 on the smallest school.",
  ],
  { size: BODY - 0.4 },
);

const footerY = H - FOOTER_H;
const bandY = footerY - BAND_H;

function band(): string {
  const out: string[] = [`<rect x="0" y="${bandY}" width="${W}" height="${BAND_H}" fill="${TINT}"/>`];
  out.push(`<rect x="${M}" y="${bandY + 12}" width="22" height="2.4" fill="${BRAND}"/>`);
  out.push(`<text x="${M}" y="${bandY + 32}" font-size="${HEAD}" font-weight="700" fill="${DARK}">Checked by an external validator</text>`);
  const steps = [
    { title: "Solver", text: "incremental cost", fill: DARK },
    { title: "XHSTT file", text: "our exporter", fill: BRAND },
    { title: "HSEval 2.15", text: "reference evaluator", fill: MID },
  ];
  const arrow = 9;
  const bw = (COL - 2 * arrow) / 3;
  const by = bandY + 40;
  steps.forEach((s, i) => {
    const bx = M + i * (bw + arrow);
    out.push(`<rect x="${bx}" y="${by}" width="${bw}" height="24" fill="${s.fill}"/>`);
    out.push(`<text x="${bx + 5}" y="${by + 10.5}" font-size="9.2" font-weight="700" fill="#FFFFFF">${s.title}</text>`);
    out.push(`<text x="${bx + 5}" y="${by + 18.5}" font-size="${SMALL - 0.4}" fill="#FFFFFF">${s.text}</text>`);
    if (i < 2) out.push(`<path d="M${bx + bw + 1.5} ${by + 7} l${arrow - 3} 5 l${-(arrow - 3)} 5 z" fill="${DARK}"/>`);
  });
  out.push(
    textBlock(M, by + 29, COL, "Exported: hard constraints, repeats, teacher gaps, shift switches, wishes (≤ 1/3 of the soft cost). Difficulty and half-day terms are cross-checked by the integer program only.", {
      size: BODY - 1,
      lead: 1.35,
    }).svg,
  );
  const rx = M + COL + GAP;
  const items = [
    { big: "139 / 139", text: "timetables: HSEval's soft cost equals ours exactly" },
    { big: "65 / 65", text: "schools, 100 classes included: no hard violations in our timetables according to HSEval" },
    { big: "3", text: "independent evaluators agree: solver, integer program, HSEval" },
  ];
  items.forEach((it, i) => {
    const iy = bandY + 13 + i * 29;
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
  "[6] Sanitary Rules of Kazakhstan, Order of the Minister of Healthcare No. ҚР ДСМ-76, 2021",
];

const qrSize = 72;
const footer = `
<rect x="0" y="${footerY}" width="${W}" height="${FOOTER_H}" fill="${DARK}"/>
${await qr(M, footerY + 14, qrSize)}
<text x="${M + qrSize + 14}" y="${footerY + 30}" font-size="14" font-weight="700" fill="#FFFFFF">Interactive demo</text>
${textBlock(M + qrSize + 14, footerY + 36, COL - qrSize - 18, "DSATUR, annealing and Kempe chains step by step, on the solver's own code. TypeScript on Node.js, exact model with HiGHS.", { size: BODY - 0.8, color: "#FFFFFF", lead: 1.35 }).svg}
<text x="${M + COL + GAP}" y="${footerY + 18}" font-size="${SMALL + 0.4}" font-weight="700" fill="#FFFFFF">References</text>
${references.map((r, i) => `<text x="${M + COL + GAP}" y="${footerY + 29 + i * 9.6}" font-size="${SMALL - 0.9}" fill="#FFFFFF">${esc(r)}</text>`).join("\n")}
`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="poster-title poster-desc">
<title id="poster-title">School timetabling by heuristic optimisation</title>
<desc id="poster-desc">A0 poster. School timetabling is modelled as colouring a conflict graph of lessons. DSATUR builds a start, simulated annealing with Kempe chain moves improves it. On 64 dense feasible schools annealing with Kempe chains solves 63, without them 58, DSATUR 19, and has the lowest soft cost at equal budget. A 100-class school becomes feasible after about 1 second. Costs agree with the external HSEval validator on 139 timetables. KHE is better on one-shift schools, annealing on two-shift schools.</desc>
<style>
@font-face { font-family: Rubik; font-weight: 300 900; src: url(data:font/woff2;base64,${font("rubik-latin.woff2")}) format("woff2"); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2190-2199, U+2212, U+2215, U+FEFF, U+FFFD; }
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
console.log(`left column ends at ${L.y.toFixed(0)}, right at ${R.y.toFixed(0)}, band starts at ${bandY}`);

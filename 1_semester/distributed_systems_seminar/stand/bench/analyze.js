#!/usr/bin/env node
// Сводка по results/<dir>: медиана по повторам p50/p90/p99, разности с full, байты на проводе, рост лога, OCSP/TSA.
//   node bench/analyze.js results/2026-09-24-10-00            → печатает markdown, пишет summary.csv и summary.md рядом
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

// ошибки измеряемой фазы по requests.csv.gz: status != 200 (счётчик k6 в старых прогонах считал длину тела неверно)
function csvErrors(dir) {
  const f = path.join(dir, 'requests.csv.gz');
  if (!fs.existsSync(f)) return null;
  let bad = 0;
  for (const line of zlib.gunzipSync(fs.readFileSync(f)).toString().split('\n')) {
    if (!line.startsWith('http_req_duration,') || !line.includes('phase=measured')) continue;
    const c = line.split(',');
    if (c[13] !== '200') bad++;
  }
  return bad;
}

// один каталог — сводка в него; несколько — объединяются как повторы, сводка в results/merged.md
const dirs = process.argv.slice(2).map((d) => path.resolve(d)).filter((d) => fs.existsSync(d));
if (!dirs.length) { console.error('usage: node bench/analyze.js results/<dir> [results/<dir2> ...]'); process.exit(2); }
const dir = dirs.length === 1 ? dirs[0] : path.dirname(dirs[0]);
const outName = dirs.length === 1 ? 'summary' : 'merged';

const runs = [];
for (const base of dirs) {
  for (const d of fs.readdirSync(base)) {
    const s = path.join(base, d, 'summary.json'), m = path.join(base, d, 'meta.json');
    if (fs.existsSync(s) && fs.existsSync(m)) {
      const r = { ...JSON.parse(fs.readFileSync(s)), meta: JSON.parse(fs.readFileSync(m)) };
      const e = csvErrors(path.join(base, d));
      if (e !== null) r.errors = e;
      runs.push(r);
    }
  }
}
if (!runs.length) { console.error('no runs'); process.exit(1); }

const median = (a) => { const b = a.slice().sort((x, y) => x - y); const k = b.length; return k ? (k % 2 ? b[(k - 1) / 2] : (b[k / 2 - 1] + b[k / 2]) / 2) : NaN; };
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');

// негодный прогон: >10 % ошибок или p50 > 10 с (TSA умер, всё упёрлось в 60-секундные таймауты) — в медианы не входит, считается в колонке invalid
const isInvalid = (r) => r.errors > 0.1 * r.n || r.p50 > 10000;

// группировка: config × size × vus (контрольные прогоны — отдельно, в сводку не входят)
const groups = new Map();
for (const r of runs) {
  if (r.meta.tag) continue;
  const key = `${r.config}|${r.size}|${r.vus}`;
  if (!groups.has(key)) groups.set(key, { config: r.config, size: r.size, vus: r.vus, runs: [] });
  groups.get(key).runs.push(r);
}
const rows = [];
for (const g of groups.values()) {
  const invalid = g.runs.filter(isInvalid).length;
  g.runs = g.runs.filter((r) => !isInvalid(r));
  if (!g.runs.length) { rows.push({ config: g.config, size: g.size, vus: g.vus, reps: 0, invalid, errors: NaN }); continue; }
  const per = (f) => median(g.runs.map(f));
  const n = g.runs[0].n;
  rows.push({
    config: g.config, size: g.size, vus: g.vus, reps: g.runs.length, invalid,
    p50: per((r) => r.p50), p90: per((r) => r.p90), p99: per((r) => r.p99), avg: per((r) => r.avg),
    rps: per((r) => r.rps_measured), errors: g.runs.reduce((a, r) => a + r.errors, 0),
    // байты на проводе: tx ss1 / число запросов (прогрев включён в счётчик → делим на warmup+n)
    wire_tx_ss1: per((r) => (r.meta.net_bytes?.ss1?.tx ?? NaN) / (r.warmup + r.n)),
    wire_rx_ss2: per((r) => (r.meta.net_bytes?.ss2?.rx ?? NaN) / (r.warmup + r.n)),
    log_ss1: per((r) => (r.meta.messagelog_growth_bytes?.ss1 ?? NaN) / (r.warmup + r.n)),
    log_ss2: per((r) => (r.meta.messagelog_growth_bytes?.ss2 ?? NaN) / (r.warmup + r.n)),
    ocsp: per((r) => r.meta.ca_calls?.ocsp ?? NaN), tsa: per((r) => r.meta.ca_calls?.tsa ?? NaN),
    tsa_flags: g.runs.filter((r) => r.meta.tsa_restarted_before || (r.meta.tsa_probe_after && r.meta.tsa_probe_after !== '200')).length,
    spread_p50: (() => { const v = g.runs.map((r) => r.p50); return v.length > 1 ? (Math.max(...v) - Math.min(...v)) / median(v) * 100 : NaN; })(),
  });
}
rows.sort((a, b) => a.size - b.size || a.vus - b.vus || a.config.localeCompare(b.config));

// разности с full при тех же size/vus
const full = new Map(rows.filter((r) => r.config === 'full').map((r) => [`${r.size}|${r.vus}`, r]));
for (const r of rows) {
  const f = full.get(`${r.size}|${r.vus}`);
  const cmp = f && r.config !== 'full' && r.config !== 'direct';   // direct — не конфигурация X-Road, Δ бессмысленна
  r.d_p50 = cmp ? r.p50 - f.p50 : NaN;
  r.d_p90 = cmp ? r.p90 - f.p90 : NaN;
}

const cols = ['config', 'size', 'vus', 'reps', 'p50', 'p90', 'p99', 'd_p50', 'd_p90', 'rps', 'spread_p50', 'wire_tx_ss1', 'log_ss1', 'ocsp', 'tsa', 'errors', 'tsa_flags', 'invalid'];
const head = ['config', 'size', 'vus', 'reps', 'p50 ms', 'p90 ms', 'p99 ms', 'Δp50 vs full', 'Δp90 vs full', 'req/s', 'разброс p50 %', 'tx ss1 B/req', 'log ss1 B/req', 'OCSP/run', 'TSA/run', 'errors', 'TSA-сбои', 'негодных'];
let md = `| ${head.join(' | ')} |\n| ${head.map(() => '---').join(' | ')} |\n`;
let csv = cols.join(',') + '\n';
for (const r of rows) {
  const intCols = new Set(['size', 'vus', 'reps', 'errors', 'tsa_flags', 'invalid', 'ocsp', 'tsa', 'wire_tx_ss1', 'wire_rx_ss2', 'log_ss1', 'log_ss2']);
  const vals = cols.map((c) => (typeof r[c] === 'number' ? fmt(r[c], intCols.has(c) ? 0 : 1) : r[c]));
  md += `| ${vals.join(' | ')} |\n`;
  csv += cols.map((c) => (typeof r[c] === 'number' ? (Number.isFinite(r[c]) ? r[c] : '') : r[c])).join(',') + '\n';
}

// контрольные прогоны: два подряд одной конфигурации
const control = runs.filter((r) => /^control/.test(r.meta.tag || ''));
let note = '';
if (control.length >= 2) {
  const [a, b] = control;
  const d = Math.abs(a.p50 - b.p50) / ((a.p50 + b.p50) / 2) * 100;
  note = `\nКонтроль: p50 ${fmt(a.p50)} vs ${fmt(b.p50)} мс, расхождение ${fmt(d)}% (p90 ${fmt(a.p90)} vs ${fmt(b.p90)}). ` +
    (d < 5 ? 'Стенд стабилен.' : d < 10 ? 'Пограничное — эффекты меньше 10% не интерпретировать.' : 'Нестабильно: снижать нагрузку/контейнеры, повторить.') + '\n';
}

console.log(md + note);
fs.writeFileSync(path.join(dir, `${outName}.md`), md + note);
fs.writeFileSync(path.join(dir, `${outName}.csv`), csv);
console.log(`written: ${path.join(dir, `${outName}.md`)}, ${outName}.csv`);

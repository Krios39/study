#!/usr/bin/env node
// Сводка по results/<dir>: медиана по повторам p50/p90/p99, разности с full, разброс между повторами, байты на канале
// ss1 <-> ss2, рост лога, OCSP/TSA, дождались ли меток времени перед чисткой.
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
  // два провайдера (target xroad2) — отдельной строкой: full+ss3 рядом с full при той же нагрузке
  const config = r.config + (r.meta.target === 'xroad2' ? '+ss3' : '');
  const key = `${config}|${r.size}|${r.vus}`;
  if (!groups.has(key)) groups.set(key, { config, size: r.size, vus: r.vus, runs: [] });
  groups.get(key).runs.push(r);
}
// размах между повторами: (max − min) / медиана, % — чувствителен к одиночному выбросу
const spread = (v) => (v.length > 1 ? (Math.max(...v) - Math.min(...v)) / median(v) * 100 : NaN);
// межквартильный размах (Q3 − Q1) / медиана, %: типичный разброс без влияния одиночных выбросов (квантили с линейной интерполяцией)
const quantile = (a, q) => { const b = a.slice().sort((x, y) => x - y); const p = (b.length - 1) * q, i = Math.floor(p); return b[i] + (b[Math.min(i + 1, b.length - 1)] - b[i]) * (p - i); };
const iqr = (v) => (v.length > 3 ? (quantile(v, 0.75) - quantile(v, 0.25)) / median(v) * 100 : NaN);
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
    ok: g.runs.reduce((a, r) => a + r.n - r.errors, 0),                // успешных запросов в измеряемой фазе, по всем повторам
    // байты: счётчики / число запросов (прогрев включён в счётчик → делим на warmup+n).
    // wire_* — eth0 целиком (у ss1 это и ответ клиенту, и CS/CA — не канал между SS); link_* — только ss1 <-> ss2:5500, IP-уровень
    wire_tx_ss1: per((r) => (r.meta.net_bytes?.ss1?.tx ?? NaN) / (r.warmup + r.n)),
    wire_rx_ss2: per((r) => (r.meta.net_bytes?.ss2?.rx ?? NaN) / (r.warmup + r.n)),
    // с двумя провайдерами — сумма по обоим каналам (ss1→ss2 + ss1→ss3): байты на запрос сравнимы с одним провайдером
    link_tx: per((r) => ((r.meta.link_bytes?.xroad_tx ?? NaN) + (r.meta.link_bytes_ss3?.xroad_tx ?? 0)) / (r.warmup + r.n)),
    link_rx: per((r) => ((r.meta.link_bytes?.xroad_rx ?? NaN) + (r.meta.link_bytes_ss3?.xroad_rx ?? 0)) / (r.warmup + r.n)),
    log_ss1: per((r) => (r.meta.messagelog_growth_bytes?.ss1 ?? NaN) / (r.warmup + r.n)),
    log_ss2: per((r) => (r.meta.messagelog_growth_bytes?.ss2 ?? NaN) / (r.warmup + r.n)),
    ocsp: per((r) => r.meta.ca_calls?.ocsp ?? NaN), tsa: per((r) => r.meta.ca_calls?.tsa ?? NaN),
    // TSA за прогон + за ожидание меток после него (пакетное проставление обычно приходится на ожидание)
    tsa_total: per((r) => (r.meta.ca_calls?.tsa ?? NaN) + (r.meta.timestamping?.ca_calls_while_waiting?.tsa ?? 0)),
    stamped: g.config === 'direct' || !g.runs.some((r) => r.meta.timestamping) ? '—'
      : `${g.runs.filter((r) => r.meta.timestamping?.completed).length}/${g.runs.length}`,
    tsa_flags: g.runs.filter((r) => r.meta.tsa_restarted_before || (r.meta.tsa_probe_after && r.meta.tsa_probe_after !== '200')).length,
    spread_p50: spread(g.runs.map((r) => r.p50)),
    spread_rps: spread(g.runs.map((r) => r.rps_measured)),
    iqr_p50: iqr(g.runs.map((r) => r.p50)),
    iqr_rps: iqr(g.runs.map((r) => r.rps_measured)),
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

// в md: канал ss1 <-> ss2, если он мерился (с 30.09); иначе старая колонка tx eth0 ss1. В csv — всё.
const hasLink = runs.some((r) => r.meta.link_bytes);
const COLS = [
  ['config', 'config'], ['size', 'size'], ['vus', 'vus'], ['reps', 'reps'],
  ['p50', 'p50 ms'], ['p90', 'p90 ms'], ['p99', 'p99 ms'], ['d_p50', 'Δp50 vs full'], ['d_p90', 'Δp90 vs full'],
  ['iqr_p50', 'IQR p50 %'], ['spread_p50', 'размах p50 %'], ['rps', 'req/s'], ['iqr_rps', 'IQR req/s %'], ['spread_rps', 'размах req/s %'],
  ...(hasLink ? [['link_tx', 'ss1→ss2 B/req'], ['link_rx', 'ss2→ss1 B/req']] : [['wire_tx_ss1', 'tx eth0 ss1 B/req']]),
  ['log_ss1', 'log ss1 B/req'], ['ocsp', 'OCSP/run'], ['tsa', 'TSA/run'],
  ...(hasLink ? [['tsa_total', 'TSA/run+ожидание'], ['stamped', 'метки до чистки']] : []),
  ['ok', 'успешных'], ['errors', 'errors'], ['tsa_flags', 'TSA-сбои'], ['invalid', 'негодных'],
];
const cols = COLS.map(([c]) => c);
const csvCols = [...new Set([...cols, 'wire_tx_ss1', 'wire_rx_ss2', 'link_tx', 'link_rx', 'log_ss2', 'tsa_total', 'stamped'])];
const intCols = new Set(['size', 'vus', 'reps', 'errors', 'ok', 'tsa_flags', 'invalid', 'ocsp', 'tsa', 'tsa_total', 'wire_tx_ss1', 'wire_rx_ss2', 'link_tx', 'link_rx', 'log_ss1', 'log_ss2']);
let md = `| ${COLS.map(([, h]) => h).join(' | ')} |\n| ${COLS.map(() => '---').join(' | ')} |\n`;
let csv = csvCols.join(',') + '\n';
for (const r of rows) {
  const vals = cols.map((c) => (typeof r[c] === 'number' ? fmt(r[c], intCols.has(c) ? 0 : 1) : r[c]));
  md += `| ${vals.join(' | ')} |\n`;
  csv += csvCols.map((c) => (typeof r[c] === 'number' ? (Number.isFinite(r[c]) ? r[c] : '') : (r[c] ?? ''))).join(',') + '\n';
}

// контрольные прогоны (full в начале каждого повтора и в конце; в старых сетках — два подряд в начале): дрейф стенда
const control = runs.filter((r) => /^control/.test(r.meta.tag || '')).sort((a, b) => a.meta.started.localeCompare(b.meta.started));
let note = '';
if (control.length >= 2) {
  const d = spread(control.map((r) => r.p50)), q = iqr(control.map((r) => r.p50));
  note = `\nКонтроль (${control.length} прогонов full ${control[0].size} B, ${control[0].vus} VU, по времени): ` +
    `p50 ${control.map((r) => fmt(r.p50)).join(' / ')} мс, размах ${fmt(d)}%, IQR ${fmt(q)}%; req/s ${control.map((r) => fmt(r.rps_measured)).join(' / ')}. ` +
    (d < 5 ? 'Стенд стабилен.' : d < 10 ? 'Пограничное — эффекты меньше 10% не интерпретировать.' : 'Нестабильно: эффекты меньше этого разброса не интерпретировать.') + '\n';
}

console.log(md + note);
fs.writeFileSync(path.join(dir, `${outName}.md`), md + note);
fs.writeFileSync(path.join(dir, `${outName}.csv`), csv);
console.log(`written: ${path.join(dir, `${outName}.md`)}, ${outName}.csv`);

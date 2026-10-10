#!/usr/bin/env node
// Разбивка задержки по этапам из operational monitoring самого X-Road (база op-monitor на ss1 и провайдере).
// На каждом SS для каждого запроса 4 метки (мс): request_in/out, response_in/out. Записи consumer (ss1, Client) и
// provider (ss2/ss3, Producer) склеиваются по x_request_id. Этапы идут подряд, их сумма = total (ss1 in → ss1 out):
//   c_req     ss1.request_in  → ss1.request_out    consumer до отправки запроса
//   net_req   ss1.request_out → p.request_in       соединение, TLS, передача и подпись запроса (X-Road шлёт поток,
//                                                  подпись идёт в конце сообщения, поэтому она здесь, а не в c_req)
//   p_req     p.request_in    → p.request_out      provider: проверка подписи, лог запроса
//   is        p.request_out   → p.response_in      эхо-сервис
//   p_resp    p.response_in   → p.response_out     provider: подпись ответа, лог, передача до конца
//   c_resp    p.response_out  → ss1.response_out   consumer: конец приёма, проверка подписи, лог, ответ клиенту
// ss1.response_in почти совпадает с p.response_in (ответ идёт потоком, ss1 начинает принимать сразу), поэтому граница
// между provider и consumer на обратном пути — p.response_out, а не ss1.response_in. Справочно resp_start = их разность.
// Так же на прямом пути: request_out на ss1 ставится в начале отправки, и подпись и лог запроса на consumer попадают в net_req.
// Межсерверные этапы (net_req, c_resp) на нескольких машинах содержат расхождение часов хостов.
// Записи хранятся keep-records-for-days (по умолчанию 7 дней) — задним числом можно разобрать только последнюю неделю.
//   node bench/opmon.js results/<dir> [dir2 ...]          # opmon.json в каждый прогон (если ещё нет) + opmon.md
//   node bench/opmon.js --force results/<dir>             # пересчитать
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const L = require('./lib');

const STAGES = ['c_req', 'net_req', 'p_req', 'is', 'p_resp', 'c_resp'];
const COLS = ['request_in_ts', 'request_out_ts', 'response_in_ts', 'response_out_ts'];

function rows(c, type, fromMs, toMs) {
  const t = L.pgTable(c, 'op-monitor', 'operational_data');
  const out = L.psql(c, 'op-monitor', `select x_request_id,${COLS.join(',')},succeeded from ${t} `
    + `where security_server_type='${type}' and request_in_ts between ${fromMs} and ${toMs} and x_request_id is not null order by request_in_ts`);
  return out.split('\n').filter(Boolean).map((l) => {
    const [id, a, b, cc, d, ok] = l.split('|');
    return { id, in: +a, out: +b, rin: +cc, rout: +d, ok: ok === 't' };
  });
}

const quantile = (a, q) => { if (!a.length) return NaN; const b = a.slice().sort((x, y) => x - y); const p = (b.length - 1) * q, i = Math.floor(p); return b[i] + (b[Math.min(i + 1, b.length - 1)] - b[i]) * (p - i); };
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);

// один прогон: meta.json → opmon.json (+ сырые этапы в opmon.csv.gz, не в git)
function extract(dir) {
  const meta = L.readJson(path.join(dir, 'meta.json'));
  if (meta.target === 'direct') return null;
  const from = Date.parse(meta.started) - 2000, to = Date.parse(meta.finished) + 2000;
  const providers = meta.target === 'xroad2' ? ['ss2', 'ss3'] : ['ss2'];
  const cons = L.running('ss1') ? rows('ss1', 'Client', from, to) : [];
  const measured = cons.slice(meta.warmup, meta.warmup + meta.n);   // первые warmup — прогрев (shared-iterations, по времени входа)
  const prov = new Map();
  for (const p of providers) {
    if (!L.running(p)) continue;
    for (const r of rows(p, 'Producer', from, to + 60000)) prov.set(r.id, r);
  }
  if (!cons.length) return providerOnly(dir, meta, [...prov.values()]);
  const lines = ['x_request_id,' + [...STAGES, 'resp_start', 'total'].join(',')];
  const st = Object.fromEntries([...STAGES, 'resp_start', 'total'].map((k) => [k, []]));
  let failed = 0;
  for (const c of measured) {
    if (!c.ok) { failed++; continue; }
    const p = prov.get(c.id);
    if (!p) continue;
    const v = { c_req: c.out - c.in, net_req: p.in - c.out, p_req: p.out - p.in, is: p.rin - p.out,
      p_resp: p.rout - p.rin, c_resp: c.rout - p.rout, resp_start: c.rin - p.rin, total: c.rout - c.in };
    for (const k of Object.keys(st)) st[k].push(v[k]);
    lines.push(`${c.id},${Object.keys(st).map((k) => v[k]).join(',')}`);
  }
  const res = {
    source: 'op-monitor', found_consumer: cons.length, expected: meta.warmup + meta.n, measured: measured.length,
    joined: st.total.length, failed,
    stages: Object.fromEntries(Object.entries(st).map(([k, a]) => [k, { mean: r2(mean(a)), p50: r2(quantile(a, 0.5)), p90: r2(quantile(a, 0.9)) }])),
  };
  L.writeJson(path.join(dir, 'opmon.json'), res);
  fs.writeFileSync(path.join(dir, 'opmon.csv.gz'), zlib.gzipSync(lines.join('\n') + '\n'));
  return res;
}

// записей consumer нет (стенд ss1 пересоздан), есть только provider: этапы p_req, is, p_resp
function providerOnly(dir, meta, prov) {
  const measured = prov.sort((a, b) => a.in - b.in).slice(meta.warmup, meta.warmup + meta.n).filter((p) => p.ok);
  const st = { p_req: [], is: [], p_resp: [], p_total: [] };
  for (const p of measured) { st.p_req.push(p.out - p.in); st.is.push(p.rin - p.out); st.p_resp.push(p.rout - p.rin); st.p_total.push(p.rout - p.in); }
  const res = {
    source: 'op-monitor', mode: 'provider_only', found_consumer: 0, found_provider: prov.length, expected: meta.warmup + meta.n,
    measured: measured.length, joined: measured.length, failed: 0,
    stages: Object.fromEntries(Object.entries(st).map(([k, a]) => [k, { mean: r2(mean(a)), p50: r2(quantile(a, 0.5)), p90: r2(quantile(a, 0.9)) }])),
  };
  L.writeJson(path.join(dir, 'opmon.json'), res);
  return res;
}

const median = (a) => quantile(a, 0.5);
const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');
const label = (m) => (m.target === 'xroad2' ? `${m.config}+ss3` : m.config);

// сводка: по каждой точке медиана по повторам от средних этапов прогона (средние складываются в total, медианы — нет)
function summarize(dirs) {
  const groups = new Map();
  for (const base of dirs) {
    for (const d of fs.readdirSync(base)) {
      const f = path.join(base, d, 'opmon.json'), m = path.join(base, d, 'meta.json');
      if (d.startsWith('_') || !fs.existsSync(f) || !fs.existsSync(m)) continue;
      const meta = L.readJson(m), o = L.readJson(f);
      if (/^control/.test(meta.tag || '') || !o.joined) continue;
      const k = `${label(meta)}|${meta.size}|${meta.vus}`;
      if (!groups.has(k)) groups.set(k, { config: label(meta), size: meta.size, vus: meta.vus, runs: [] });
      groups.get(k).runs.push(o);
    }
  }
  const order = ['full', 'nobody', 'reuse', 'synctsa', 'full+ss3'];
  const rowsOut = [...groups.values()].sort((a, b) => a.size - b.size || a.vus - b.vus || order.indexOf(a.config) - order.indexOf(b.config));
  for (const g of rowsOut) {
    g.reps = g.runs.length;
    g.joined = g.runs.reduce((s, o) => s + o.joined, 0);
    g.expected = g.runs.reduce((s, o) => s + o.measured, 0);
    for (const k of [...STAGES, 'resp_start', 'total']) g[k] = median(g.runs.map((o) => o.stages[k]?.mean ?? NaN));
    g.total_p50 = median(g.runs.map((o) => o.stages.total?.p50 ?? NaN));
  }
  const full = new Map(rowsOut.filter((g) => g.config === 'full').map((g) => [`${g.size}|${g.vus}`, g]));
  const head = ['config', 'size', 'vus', 'reps', 'склеено', 'total p50', 'total mean', ...STAGES];
  let md = `| ${head.join(' | ')} |\n|${head.map(() => ' --- ').join('|')}|\n`;
  for (const g of rowsOut) md += `| ${[g.config, g.size, g.vus, g.reps, `${g.joined}/${g.expected}`, fmt(g.total_p50), fmt(g.total), ...STAGES.map((k) => fmt(g[k]))].join(' | ')} |\n`;
  md += '\nΔ средних этапов против full в той же точке (мс):\n\n';
  const dh = ['config', 'size', 'vus', 'Δ total', ...STAGES.map((k) => `Δ ${k}`)];
  md += `| ${dh.join(' | ')} |\n|${dh.map(() => ' --- ').join('|')}|\n`;
  for (const g of rowsOut) {
    const f = full.get(`${g.size}|${g.vus}`);
    if (g.config === 'full' || !f) continue;
    md += `| ${[g.config, g.size, g.vus, fmt(g.total - f.total), ...STAGES.map((k) => fmt(g[k] - f[k]))].join(' | ')} |\n`;
  }
  md += `\nЭтапы — средние по прогону (мс), по точке — медиана по повторам. Источник: opmonitor.operational_data на ss1 и провайдере, `
    + `склейка по x_request_id; разрешение меток 1 мс. c_req → net_req → p_req → is → p_resp → c_resp идут подряд, их сумма = total mean. `
    + `Подпись и лог запроса на consumer входят в net_req (ss1 ставит request_out в начале отправки). На нескольких машинах в net_req и c_resp входит расхождение часов.\n`;
  return md;
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((d) => path.resolve(d)).filter((d) => fs.existsSync(d));
  if (!dirs.length) { console.error('usage: node bench/opmon.js [--force] results/<dir> [dir2 ...]'); process.exit(2); }
  for (const base of dirs) {
    for (const d of fs.readdirSync(base).sort()) {
      const run = path.join(base, d);
      if (d.startsWith('_') || !fs.existsSync(path.join(run, 'meta.json'))) continue;
      if (!force && fs.existsSync(path.join(run, 'opmon.json'))) continue;
      const o = extract(run);
      if (o) console.log(`${d}  joined ${o.joined}/${o.measured} (consumer rows ${o.found_consumer}/${o.expected})  total mean ${fmt((o.stages.total || o.stages.p_total).mean)} ms${o.mode ? ' ' + o.mode : ''}`);
    }
  }
  const md = summarize(dirs);
  const out = dirs.length === 1 ? dirs[0] : path.dirname(dirs[0]);
  const name = dirs.length === 1 ? 'opmon.md' : 'opmon-merged.md';
  fs.writeFileSync(path.join(out, name), md);
  console.log('\n' + md + `\n→ ${path.join(out, name)}`);
}

module.exports = { extract, summarize, STAGES };

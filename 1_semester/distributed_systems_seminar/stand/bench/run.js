#!/usr/bin/env node
// 3. Замеры: контрольный прогон + полная сетка по matrix.json → results/<дата>/
//   node bench/run.js                      # контроль (одна конфигурация дважды) и сразу сетка, ~4 ч
//   node bench/run.js --control            # только контроль, ~5 мин
//   node bench/run.js --grid               # только сетка, без контроля
//   node bench/run.js --resume results/X   # продолжить: прогоны с готовым summary.json пропускаются
//   node bench/run.js --only full,nobody   # подмножество конфигураций
//   node bench/run.js --dry                # показать порядок прогонов, ничего не запускать
// На каждый прогон: конфигурация (если сменилась) → clean → счётчики до → k6 → счётчики после → meta.json
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const L = require('./lib');
const { apply: applyConfig } = require('./config');
const { clean } = require('./clean');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

const M = L.readJson(path.join(__dirname, 'matrix.json'));
const RESULTS = opt('--resume') ? path.resolve(opt('--resume'))
  : path.join(L.STAND, 'results', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
if (!flag('--dry')) {
  fs.mkdirSync(RESULTS, { recursive: true });
  L.setLogFile(path.join(RESULTS, 'run.log'));    // полный журнал прогона, включая вывод hurl/compose/k6 и ошибки
}
process.on('uncaughtException', (e) => { L.log('FATAL', e.stack || e.message); process.exit(1); });

// ---------- план ----------
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function buildPlan() {
  const plan = [];
  if (!flag('--grid')) {
    const c = M.control;
    for (let k = 1; k <= c.repeats; k++) plan.push({ rep: 1, config: c.config, target: 'xroad', size: c.size, vus: c.vus, tag: `control${k}` });
    if (flag('--control')) return plan;
  }
  const configs = opt('--only') ? opt('--only').split(',') : M.configs;
  for (let rep = 1; rep <= M.reps; rep++) {
    for (const size of M.baseline.sizes) for (const vus of M.baseline.vus) plan.push({ rep, config: 'direct', target: 'direct', size, vus });
    for (const config of shuffle(configs.slice())) {
      const runs = [];
      for (const size of M.latency.sizes) for (const vus of M.latency.vus) runs.push({ rep, config, target: 'xroad', size, vus });
      for (const size of M.concurrency.sizes) for (const vus of M.concurrency.vus) runs.push({ rep, config, target: 'xroad', size, vus });
      plan.push(...shuffle(runs));
    }
  }
  return plan;
}

const runName = (r) => `${r.config}_s${r.size}_v${r.vus}_r${r.rep}${r.tag ? '_' + r.tag : ''}`;

// spawn с ожиданием: k6 нельзя запускать через spawnSync — он блокирует цикл событий, и docker stats в фоне не пишется
function run(cmd, args) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args);
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => { L.tee(`$ ${cmd} ${args.join(' ')}\n${out}`); resolve({ code, out: out.trim() }); });
  });
}

// ---------- docker stats в фоне ----------
function startStats(file) {
  const out = fs.createWriteStream(file);
  let stopped = false;                      // docker stats может отдать хвост после kill — не писать в закрытый поток
  const p = spawn('docker', ['stats', '--format', '{{.Name}},{{.CPUPerc}},{{.MemUsage}}', 'cs', 'ss1', 'ss2', 'is-provider']);
  p.stdout.on('data', (buf) => {
    if (stopped) return;
    const ts = new Date().toISOString();
    for (const line of buf.toString().replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').split('\n')) {
      if (line.includes(',')) out.write(`${ts},${line.trim()}\n`);
    }
  });
  p.on('error', () => {});
  return () => { stopped = true; p.kill(); out.end(); };
}

// ---------- один прогон ----------
async function runOne(r, dir, warmup, extra = {}) {
  const n = r.tag === 'burnin' ? M.burnin.n : r.size >= M.large_from ? M.n_large : M.n;
  fs.mkdirSync(dir, { recursive: true });
  const before = { t: new Date().toISOString(), net: {}, db: {} };
  for (const c of L.MEASURED_SS) { before.net[c] = L.netBytes(c); before.db[c] = L.messagelogBytes(c); }
  const stopStats = startStats(path.join(dir, 'stats.csv'));

  const k6args = ['run', '--rm', '--network', L.NET,
    '-v', `${path.join(L.STAND, 'k6')}:/k6:ro`, '-v', `${dir}:/out`,
    'grafana/k6:latest', 'run', '--quiet', '--out', 'csv=/out/requests.csv.gz',
    '-e', `CONFIG=${r.config}`, '-e', `TARGET=${r.target}`, '-e', `SIZE=${r.size}`, '-e', `VUS=${r.vus}`,
    '-e', `N=${n}`, '-e', `WARMUP=${warmup}`, '-e', `REP=${r.rep}`, '-e', 'OUT=/out', '/k6/grid.js'];
  const t0 = Date.now();
  const res = (await run('docker', k6args)).out;
  const wall = (Date.now() - t0) / 1000;
  stopStats();

  const after = { t: new Date().toISOString(), net: {}, db: {} };
  for (const c of L.MEASURED_SS) { after.net[c] = L.netBytes(c); after.db[c] = L.messagelogBytes(c); }
  const ca = L.caCalls(before.t, after.t);

  const summary = fs.existsSync(path.join(dir, 'summary.json')) ? L.readJson(path.join(dir, 'summary.json')) : null;
  const meta = {
    run: runName(r), ...r, n, warmup, wall_s: wall, started: before.t, finished: after.t,
    net_bytes: Object.fromEntries(L.MEASURED_SS.map((c) => [c, { rx: after.net[c].rx - before.net[c].rx, tx: after.net[c].tx - before.net[c].tx }])),
    messagelog_growth_bytes: Object.fromEntries(L.MEASURED_SS.map((c) => [c, after.db[c] - before.db[c]])),
    ca_calls: ca,
    local_ini: Object.fromEntries(L.MEASURED_SS.map((c) => [c, L.iniDump(c)])),
    k6_stdout: res,
    tsa_probe_after: r.target === 'xroad' ? L.tsaProbe() : null,   // '200' = TSA пережил прогон
    ...extra,
  };
  L.writeJson(path.join(dir, 'meta.json'), meta);
  const s = summary || {};
  L.log(`${runName(r)}  p50=${(s.p50 || 0).toFixed(1)} p90=${(s.p90 || 0).toFixed(1)} p99=${(s.p99 || 0).toFixed(1)} err=${s.errors ?? '?'}  ocsp=${ca.ocsp} tsa=${ca.tsa}  ${wall.toFixed(0)}s`);
  if (!summary) throw new Error(`no summary.json for ${runName(r)} — k6 failed:\n${res}`);
}

// контроль: два прогона одной конфигурации подряд — оценка шума стенда
function controlVerdict() {
  const p = [];
  for (let k = 1; k <= M.control.repeats; k++) {
    const f = path.join(RESULTS, runName({ ...M.control, rep: 1, tag: `control${k}` }), 'summary.json');
    if (fs.existsSync(f)) p.push(L.readJson(f).p50);
  }
  if (p.length < 2) return;
  const d = (Math.max(...p) - Math.min(...p)) / (p.reduce((a, b) => a + b, 0) / p.length) * 100;
  L.log(`control: p50 ${p.map((x) => x.toFixed(1)).join(' / ')} ms, spread ${d.toFixed(1)}% — ` +
    (d < 5 ? 'stable' : d < 10 ? 'borderline: effects <10% are noise' : 'UNSTABLE: close other apps, plug in power, re-run --control before trusting the grid'));
}

// ---------- главный цикл ----------
(async () => {
  const plan = buildPlan();
  const todo = plan.filter((r) => !fs.existsSync(path.join(RESULTS, runName(r), 'summary.json')));
  L.log(`results → ${RESULTS}`);
  L.log(`${plan.length} runs planned, ${todo.length} to do`);
  if (flag('--dry')) { todo.forEach((r) => console.log('  ' + runName(r))); return; }

  L.writeJson(path.join(RESULTS, 'env.json'), { started: new Date().toISOString(), matrix: M, images: L.imageDigests(), plan: plan.map(runName) });

  let current = null;
  for (const r of todo) {
    let warmup = M.warmup_next;
    if (r.target === 'xroad' && r.config !== current) {
      await applyConfig(r.config);
      current = r.config;
      warmup = M.warmup_first;
      // прогон-«обкатка» после смены конфигурации: первый прогон после рестарта proxy систематически медленнее
      // даже с прогревом 4000 (1 VU греет не те пути, что 4–8 VU) → выкидываем целый прогон при 4 VU, в сводку не идёт
      if (M.burnin) {
        const b = { rep: r.rep, config: r.config, target: 'xroad', size: M.burnin.size, vus: M.burnin.vus, tag: 'burnin' };
        clean();
        await runOne(b, path.join(RESULTS, '_burnin', `${r.config}_r${r.rep}`), M.burnin.warmup);
      }
    }
    if (r.size >= M.large_from) warmup = Math.ceil(warmup / 5);
    if (r.target === 'direct') warmup = 100;
    clean();
    const tsaRestarted = r.target === 'xroad' ? await L.ensureTsa() : false;   // TSA жив? иначе restart ca (помечается в meta)
    await runOne(r, path.join(RESULTS, runName(r)), warmup, { tsa_restarted_before: tsaRestarted });
    if (r.tag === `control${M.control.repeats}`) controlVerdict();
  }
  if (current && current !== 'full') { L.log('restoring config full'); await applyConfig('full'); }
  L.log('done');
})().catch((e) => { L.log('ERROR', e.stack || e.message); process.exit(1); });

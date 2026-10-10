#!/usr/bin/env node
// 3. Замеры: контрольный прогон + полная сетка по matrix.json → results/<дата>/
//   node bench/run.js                      # контроль (одна конфигурация дважды) и сразу сетка, ~4 ч
//   node bench/run.js --control            # только контроль, ~5 мин
//   node bench/run.js --grid               # только сетка, без контроля
//   node bench/run.js --resume results/X   # продолжить: прогоны с готовым summary.json пропускаются
//   node bench/run.js --only full,nobody   # подмножество конфигураций
//   node bench/run.js --dry                # показать порядок прогонов, ничего не запускать
//   node bench/run.js --out results/X      # писать в заданный каталог (для night.js)
//   node bench/run.js --matrix bench/matrix-wide.json   # другая сетка (по умолчанию bench/matrix.json)
// На каждый прогон: конфигурация (если сменилась) → clean → счётчики до → k6 → счётчики после →
// ожидание меток времени (пакетное проставление должно закрыть все сообщения прогона до чистки) → meta.json.
// ss3 (второй провайдер, в измеряемом пути не участвует) останавливается и после сетки остаётся остановленным: запущенный
// в конце, он ещё стартовал, когда night.js проверял стенд перед следующей сеткой, и check.js падал. Поднять — node bench/up.js.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const L = require('./lib');
const opmon = require('./opmon');
const { apply: applyConfig } = require('./config');
const { clean } = require('./clean');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

const M = L.readJson(opt('--matrix') ? path.resolve(opt('--matrix')) : path.join(__dirname, 'matrix.json'));
const RESULTS = opt('--resume') ? path.resolve(opt('--resume'))
  : opt('--out') ? path.resolve(opt('--out'))
  : path.join(L.STAND, 'results', new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'));
if (!flag('--dry')) {
  fs.mkdirSync(RESULTS, { recursive: true });
  L.setLogFile(path.join(RESULTS, 'run.log'));    // полный журнал прогона, включая вывод hurl/compose/k6 и ошибки
}
process.on('uncaughtException', (e) => { L.log('FATAL', e.stack || e.message); process.exit(1); });

// два провайдера: только full — config.js меняет local.ini лишь на ss1/ss2, у ss3 остались бы настройки по умолчанию
const TWO = M.two_providers || null;
if (TWO && TWO.configs.some((c) => c !== 'full')) throw new Error('two_providers: only "full" (config.js does not configure ss3)');

// ---------- план ----------
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// контроль: одна и та же точка (full, 10 КБ, 1 VU). Старая сетка — M.control.repeats подряд в начале;
// M.control.per_rep — в начале каждого повтора и в конце (control_r<rep>, control_end): дрейф стенда за ночь
const controlRun = (tag) => ({ rep: 1, config: M.control.config, target: 'xroad', size: M.control.size, vus: M.control.vus, tag });
const controlTags = () => (M.control.per_rep
  ? [...Array.from({ length: M.reps }, (_, i) => `control_r${i + 1}`), 'control_end']
  : Array.from({ length: M.control.repeats }, (_, i) => `control${i + 1}`));

function buildPlan() {
  const plan = [];
  const withControl = !flag('--grid');
  if (withControl && !M.control.per_rep) for (const t of controlTags()) plan.push(controlRun(t));
  if (flag('--control')) return M.control.per_rep ? [controlRun('control_r1'), controlRun('control_end')] : plan;
  const configs = opt('--only') ? opt('--only').split(',') : M.configs;
  // M.points: [[size, vus], ...] — одни и те же точки для direct и X-Road; иначе старая сетка latency/concurrency/baseline
  const xroadPoints = M.points || [
    ...M.latency.sizes.flatMap((size) => M.latency.vus.map((vus) => [size, vus])),
    ...M.concurrency.sizes.flatMap((size) => M.concurrency.vus.map((vus) => [size, vus])),
  ];
  const directPoints = M.points || M.baseline.sizes.flatMap((size) => M.baseline.vus.map((vus) => [size, vus]));
  for (let rep = 1; rep <= M.reps; rep++) {
    if (withControl && M.control.per_rep) plan.push(controlRun(`control_r${rep}`));
    for (const [size, vus] of directPoints) plan.push({ rep, config: 'direct', target: 'direct', size, vus });
    for (const config of shuffle(configs.slice())) {
      // M.two_providers: те же точки, но запросы по очереди на ss2 и ss3 (target xroad2) — в блоке своей конфигурации
      const two = TWO && TWO.configs.includes(config) ? TWO.points.map(([size, vus]) => ({ rep, config, target: 'xroad2', size, vus })) : [];
      plan.push(...shuffle([...xroadPoints.map(([size, vus]) => ({ rep, config, target: 'xroad', size, vus })), ...two]));
    }
  }
  if (withControl && M.control.per_rep) plan.push(controlRun('control_end'));
  return plan;
}

const runName = (r) => `${r.config}${r.target === 'xroad2' ? '-2p' : ''}_s${r.size}_v${r.vus}_r${r.rep}${r.tag ? '_' + r.tag : ''}`;

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
  // по процессу docker stats на машину (на одной машине — один)
  const procs = L.statsTargets(['cs', 'ss1', 'ss2', 'is-provider', ...(TWO ? ['ss3'] : [])]).map((t) => {
    const p = spawn('docker', [...t.args, 'stats', '--format', '{{.Name}},{{.CPUPerc}},{{.MemUsage}}', ...t.names]);
    p.stdout.on('data', (buf) => {
      if (stopped) return;
      const ts = new Date().toISOString();
      for (const line of buf.toString().replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').split('\n')) {
        if (line.includes(',')) out.write(`${ts},${line.trim()}\n`);
      }
    });
    p.on('error', () => {});
    return p;
  });
  return () => { stopped = true; procs.forEach((p) => p.kill()); out.end(); };
}

// ---------- один прогон ----------
async function runOne(r, dir, warmup, extra = {}) {
  const n = r.tag === 'burnin' ? M.burnin.n : r.size >= M.large_from ? M.n_large : M.n;
  fs.mkdirSync(dir, { recursive: true });
  const xroad = r.target !== 'direct';
  const two = r.target === 'xroad2';                 // два провайдера: метки и байты ещё и для ss3
  const logged = two ? [...L.MEASURED_SS, 'ss3'] : L.MEASURED_SS;
  const before = { t: new Date().toISOString(), net: {}, db: {} };
  for (const c of L.MEASURED_SS) { before.net[c] = L.netBytes(c); before.db[c] = L.messagelogBytes(c); }
  before.link = L.linkBytes();
  before.link3 = two ? L.linkBytes('ss1', 'ss3') : null;
  const stopStats = startStats(path.join(dir, 'stats.csv'));

  // на Linux k6 в контейнере — свой uid (12345) и не может писать в каталог результатов bench'а; запускаем от нашего
  // пользователя (Docker Desktop на Windows права на bind mount не проверяет)
  const asUser = process.getuid ? ['--user', `${process.getuid()}:${process.getgid()}`] : [];
  const k6args = ['run', '--rm', ...asUser, ...L.NETARGS,
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
  after.link = L.linkBytes();
  after.link3 = two ? L.linkBytes('ss1', 'ss3') : null;
  const ca = L.caCalls(before.t, after.t);
  // метки времени: при notsa интервал сутки — не ждём, только фиксируем, сколько сообщений осталось без метки
  const stamping = !xroad ? null
    : r.config === 'notsa' ? { completed: false, waited: false, ...Object.fromEntries(L.MEASURED_SS.map((c) => [c, { unstamped_after_run: L.unstamped(c) }])) }
    : await L.waitStamped(logged, M.stamping_timeout_s ?? 300);
  if (stamping && stamping.waited !== false) stamping.ca_calls_while_waiting = L.caCalls(after.t, new Date().toISOString());

  const summary = fs.existsSync(path.join(dir, 'summary.json')) ? L.readJson(path.join(dir, 'summary.json')) : null;
  const meta = {
    run: runName(r), ...r, n, warmup, wall_s: wall, started: before.t, finished: after.t,
    net_bytes: Object.fromEntries(L.MEASURED_SS.map((c) => [c, { rx: after.net[c].rx - before.net[c].rx, tx: after.net[c].tx - before.net[c].tx }])),
    messagelog_growth_bytes: Object.fromEntries(L.MEASURED_SS.map((c) => [c, after.db[c] - before.db[c]])),
    // канал ss1 <-> ss2 за время k6 (iptables в namespace ss1): xroad_* — порт 5500, link_* — весь трафик между ними
    link_bytes: Object.fromEntries(Object.keys(after.link).map((k) => [k, after.link[k] - (before.link[k] ?? 0)])),
    link_bytes_ss3: two ? Object.fromEntries(Object.keys(after.link3).map((k) => [k, after.link3[k] - (before.link3[k] ?? 0)])) : undefined,
    timestamping: stamping,
    ca_calls: ca,
    local_ini: Object.fromEntries(L.MEASURED_SS.map((c) => [c, L.iniDump(c)])),
    k6_stdout: res,
    tsa_probe_after: xroad ? L.tsaProbe() : null,   // '200' = TSA пережил прогон
    ...extra,
  };
  L.writeJson(path.join(dir, 'meta.json'), meta);
  // этапы из op-monitoring (opmon.json); демон op-monitor пишет записи с задержкой — если склеилось не всё, ещё раз через 10 с
  let om = null;
  if (xroad) {
    try {
      om = opmon.extract(dir);
      if (om && om.joined + om.failed < om.measured) { await L.sleep(10000); om = opmon.extract(dir); }
    } catch (e) { L.log(`opmon failed: ${e.message.split('\n')[0]}`); }
  }
  const s = summary || {};
  const st = stamping ? `  stamped=${stamping.completed ? 'yes' : 'NO'}${stamping.wait_s != null ? ` +${stamping.wait_s}s` : ''}` : '';
  L.log(`${runName(r)}  p50=${(s.p50 || 0).toFixed(1)} p90=${(s.p90 || 0).toFixed(1)} p99=${(s.p99 || 0).toFixed(1)} err=${s.errors ?? '?'}${om ? `  opmon=${om.joined}/${om.measured}` : ''}  ocsp=${ca.ocsp} tsa=${ca.tsa}${st}  ${wall.toFixed(0)}s`);
  if (!summary) throw new Error(`no summary.json for ${runName(r)} — k6 failed:\n${res}`);
}

// контроль: два прогона одной конфигурации подряд — оценка шума стенда
function controlVerdict() {
  const p = [];
  for (const tag of controlTags()) {
    const f = path.join(RESULTS, runName(controlRun(tag)), 'summary.json');
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

  L.writeJson(path.join(RESULTS, 'env.json'), {
    started: new Date().toISOString(), matrix: M, images: L.imageDigests(), plan: plan.map(runName),
    cpu: (L.THIS_HOST ? L.HOSTS : [null]).map((h) => L.cpuMode(h)),   // режим процессора: в balanced задержки в разы выше
  });

  // ss3 нужен только прогонам с двумя провайдерами; без них — остановить, чтобы не ел CPU
  if (todo.some((r) => r.target === 'xroad2')) await L.ensureProvider('ss3', L.PROVIDERS.ss3);
  else if (L.running('ss3')) { L.log('stopping ss3 (not in the measured path)'); L.dctl('ss3', 'stop'); }
  let current = null;
  for (const r of todo) {
    let warmup = M.warmup_next;
    if (r.target !== 'direct' && r.config !== current) {
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
    const tsaRestarted = r.target !== 'direct' ? await L.ensureTsa() : false;   // TSA жив? иначе restart ca (помечается в meta)
    await runOne(r, path.join(RESULTS, runName(r)), warmup, { tsa_restarted_before: tsaRestarted });
    if (/^control/.test(r.tag || '')) controlVerdict();
  }
  if (current && current !== 'full') { L.log('restoring config full'); await applyConfig('full'); }
  L.log('done');
})().catch((e) => { L.log('ERROR', e.stack || e.message); process.exit(1); });

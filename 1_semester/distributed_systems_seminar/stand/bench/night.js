#!/usr/bin/env node
// Ночной запуск: несколько полных сеток подряд, каждая в свой каталог, с автоматическим продолжением после обрыва.
//   node bench/night.js            # 3 сетки (~4.5 ч каждая)
//   node bench/night.js 2          # две
// Перед каждой сеткой: node bench/check.js (при FAIL — config.js full и ещё одна попытка). Сетка упала — config.js full,
// TSA-проверка, --resume; до 5 попыток на сетку. После каждой сетки analyze.js, в конце — объединённая сводка по всем
// сеткам этой ночи (results/night-<дата>/merged.md). Журнал: results/night-<дата>.log.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const L = require('./lib');

const COUNT = Number(process.argv[2] || 3);
const RETRIES = 5;
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const RESULTS = path.join(L.STAND, 'results');
L.setLogFile(path.join(RESULTS, `night-${stamp}.log`));

const node = (script, ...args) => spawnSync(process.execPath, [path.join(__dirname, script), ...args], { stdio: 'inherit', cwd: L.STAND }).status;

async function recover() {
  L.log('recover: config full + TSA check');
  node('config.js', 'full');
  await L.ensureTsa();
}

async function grid(i) {
  const dir = path.join(RESULTS, `${stamp}-g${i}`);
  L.log(`=== grid ${i}/${COUNT} → ${dir}`);
  if (node('check.js', '--quick') !== 0) {
    L.log('check failed — trying to recover');
    await recover();
    if (node('check.js', '--quick') !== 0) throw new Error('stand not ready');
  }
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const args = attempt === 1 ? ['--out', dir] : ['--resume', dir];
    L.log(`run.js ${args.join(' ')} (attempt ${attempt})`);
    if (node('run.js', ...args) === 0) break;
    if (attempt === RETRIES) throw new Error(`grid ${i} failed after ${RETRIES} attempts`);
    L.log(`grid ${i} interrupted — recovering and resuming in 60 s`);
    await L.sleep(60000);
    await recover();
  }
  node('analyze.js', dir);
  return dir;
}

(async () => {
  const done = [];
  const t0 = Date.now();
  for (let i = 1; i <= COUNT; i++) {
    try { done.push(await grid(i)); } catch (e) { L.log(`ERROR grid ${i}: ${e.message}`); }
    L.log(`elapsed ${((Date.now() - t0) / 3600e3).toFixed(1)} h, grids done: ${done.length}`);
  }
  if (done.length > 1) {
    const mergedDir = path.join(RESULTS, `night-${stamp}`);
    fs.mkdirSync(mergedDir, { recursive: true });
    node('analyze.js', ...done);                                   // пишет results/merged.md
    for (const f of ['merged.md', 'merged.csv']) if (fs.existsSync(path.join(RESULTS, f))) fs.renameSync(path.join(RESULTS, f), path.join(mergedDir, f));
    L.log(`merged summary → ${mergedDir}/merged.md`);
  }
  L.log(`night done: ${done.length}/${COUNT} grids, ${((Date.now() - t0) / 3600e3).toFixed(1)} h`);
  process.exit(done.length === COUNT ? 0 : 1);
})().catch((e) => { L.log('FATAL', e.stack || e.message); process.exit(1); });

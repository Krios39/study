#!/usr/bin/env node
// Сквозная проверка всей цепочки замера на крошечной сетке (bench/matrix-smoke.json, ~20 мин): все конфигурации,
// обкатка, контроль, 1 МБ и 4 VU, ожидание меток, счётчики канала, сводка. Ловит то, что check.js не видит
// (права на каталог результатов у k6, iptables в namespace ss1, метки, analyze) — до того, как на это уйдёт ночь.
//   node bench/smoke.js                    # → results/smoke-<дата>/, код выхода 0 = можно запускать сетку
// night.js запускает его перед сетками сам (отключить: --no-smoke).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const L = require('./lib');

const node = (script, ...args) => spawnSync(process.execPath, [path.join(__dirname, script), ...args], { stdio: 'inherit', cwd: L.STAND }).status;

function smoke(dir) {
  L.log(`smoke → ${dir}`);
  if (node('run.js', '--matrix', path.join(__dirname, 'matrix-smoke.json'), '--out', dir) !== 0) return ['run.js failed — см. run.log'];
  const problems = [];
  const runs = fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'meta.json')));
  if (!runs.length) problems.push('ни одного прогона');
  for (const d of runs) {
    const meta = L.readJson(path.join(dir, d, 'meta.json'));
    const sf = path.join(dir, d, 'summary.json');
    const s = fs.existsSync(sf) ? L.readJson(sf) : null;
    if (!s) { problems.push(`${d}: нет summary.json`); continue; }
    if (!(s.p50 > 0)) problems.push(`${d}: p50=${s.p50}`);
    if (s.errors > 0) problems.push(`${d}: ${s.errors} ошибок`);
    if (!fs.existsSync(path.join(dir, d, 'requests.csv.gz'))) problems.push(`${d}: нет requests.csv.gz`);
    if (meta.target !== 'xroad') continue;
    if (!(meta.link_bytes?.xroad_tx > 0)) problems.push(`${d}: счётчики канала ss1→ss2 = 0 (iptables в namespace ss1?)`);
    if (meta.config !== 'notsa' && !meta.timestamping?.completed) problems.push(`${d}: метки не проставились до чистки`);
    if (!meta.ca_calls) problems.push(`${d}: нет обращений к CA в meta (логи ca?)`);
  }
  if (node('analyze.js', dir) !== 0) problems.push('analyze.js failed');
  L.log(`smoke: ${runs.length} прогонов, ${problems.length ? problems.length + ' проблем' : 'всё ok'}`);
  for (const p of problems) L.log(`  !! ${p}`);
  return problems;
}

module.exports = { smoke };
if (require.main === module) {
  const dir = path.join(L.STAND, 'results', `smoke-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`);
  fs.mkdirSync(dir, { recursive: true });
  process.exit(smoke(dir).length ? 1 : 0);
}

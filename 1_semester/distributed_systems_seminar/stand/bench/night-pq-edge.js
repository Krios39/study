#!/usr/bin/env node
// Ночь 19–20.11 для статьи: поднять стенд, повторить прерванный прогон g2 (pq-large), затем сетка pq-edge.
//   node bench/night-pq-edge.js
// Результаты: g2 дополняется на месте (../paper/stand-results/pq-large-2026-11-18-15-07-g2, исходный env.json
// сохраняется как env-2026-11-18.json), pq-edge — в results/pq-edge-<дата>-g1 (потом перенести в ../paper/stand-results).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const STAND = path.join(__dirname, '..');
const G2 = path.join(STAND, '..', 'paper', 'stand-results', 'pq-large-2026-11-18-15-07-g2');
const node = (...args) => {
  console.log(`\n=== node ${args.join(' ')}`);
  return spawnSync(process.execPath, args, { stdio: 'inherit', cwd: STAND }).status;
};

if (node('bench/up.js') !== 0) process.exit(1);
const env = path.join(G2, 'env.json');
const keep = path.join(G2, 'env-2026-11-18.json');
if (fs.existsSync(env) && !fs.existsSync(keep)) fs.copyFileSync(env, keep);
const g2 = node('bench/run.js', '--resume', G2, '--matrix', '../paper/grids/matrix-pq-large.json');
console.log(`g2 resume exit ${g2}`);
const edge = node('bench/night.js', '1', '--matrix', '../paper/grids/matrix-pq-edge.json');
console.log(`pq-edge exit ${edge}`);
process.exit(edge || g2);

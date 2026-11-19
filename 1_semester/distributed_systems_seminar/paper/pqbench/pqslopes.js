#!/usr/bin/env node
// Slopes of the size scenarios (paper/grids/matrix-pq.json, matrix-pq-large.json): median over repetitions of each run's p50,
// slope = (tR - t0) / R ms (R = the grid RTT, 50 or 20), the number of round trips a message waits for.
// Usage: node pqslopes.js <results dir> > slopes.csv
'use strict';
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const NAMES = {
  '10240/0': 'base GET', '10240/1': 'base POST',
  '14849/4609': 'A ML-DSA-44', '17049/6809': 'A ML-DSA-65', '19866/9626': 'A ML-DSA-87',
  '24212/18572': 'B ML-DSA-44', '31169/27947': 'B ML-DSA-65', '40594/40648': 'B ML-DSA-87',
  // matrix-pq-large.json
  '45051/46654': 'B MLDSA87-RSA4096', '48025/51973': 'C ML-DSA-65 + SLH-DSA-128S',
  '87868/110280': 'C ML-DSA-65 + SLH-DSA-128F', '142742/190594': 'C ML-DSA-65 + SLH-DSA-256S',
  // matrix-pq-edge.json: points near flight boundaries
  '19007/11558': 'B FALCON-1024', '31767/28753': 'B MLDSA65-P256',
  '19602/13962': 'D ML-DSA-44', '20005/14573': 'D MLDSA44-P256', '30969/31023': 'D ML-DSA-87',
};
const med = (a) => { const b = a.slice().sort((x, y) => x - y); const k = b.length; return k % 2 ? b[(k - 1) / 2] : (b[k / 2 - 1] + b[k / 2]) / 2; };

const runs = {};
for (const d of fs.readdirSync(dir)) {
  const m = d.match(/^(full|reuse)_s(\d+)(?:_q(\d+))?_v1_rtt(\d+)_r(\d+)$/);
  if (!m) continue;
  const f = path.join(dir, d, 'summary.json');
  if (!fs.existsSync(f)) continue;
  const s = JSON.parse(fs.readFileSync(f, 'utf8'));
  const key = `${m[1]}|${m[2]}/${m[3] || 0}|${m[4]}`;
  (runs[key] = runs[key] || []).push({ p50: s.p50, err: s.errors });
}
// the non-zero RTT of the grid (50 in matrix-pq*.json, 20 in matrix-pq-large-rtt20.json); p50_rtt is at that RTT
const R = Math.max(...Object.keys(runs).map((k) => Number(k.split('|')[2])));
console.log('config,scenario,size,req,n_reps,p50_rtt0,p50_rtt,slope,errors,rtt');
for (const config of ['full', 'reuse']) {
  for (const [k, name] of Object.entries(NAMES)) {
    const a = runs[`${config}|${k}|0`] || [], b = runs[`${config}|${k}|${R}`] || [];
    if (!a.length || !b.length) continue;
    const t0 = med(a.map((x) => x.p50)), t50 = med(b.map((x) => x.p50));
    const err = [...a, ...b].reduce((s, x) => s + (x.err || 0), 0);
    const [size, req] = k.split('/');
    console.log([config, name, size, req, Math.min(a.length, b.length), t0.toFixed(1), t50.toFixed(1), ((t50 - t0) / R).toFixed(2), err, R].join(','));
  }
}

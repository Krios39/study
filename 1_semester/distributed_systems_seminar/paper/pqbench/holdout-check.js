#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const dirs = process.argv.slice(2);
if (!dirs.length) { console.error('usage: node holdout-check.js <results dir> [more dirs]'); process.exit(2); }
const pred = fs.readFileSync(path.join(__dirname, '..', 'grids', 'pq-holdout-predictions.csv'), 'utf8').trim().split(/\r?\n/);
const h = pred[0].split(',');
const points = pred.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [h[i], Number(v)])));

const med = (a) => { const b = a.slice().sort((x, y) => x - y); const k = b.length; return k % 2 ? b[(k - 1) / 2] : (b[k / 2 - 1] + b[k / 2]) / 2; };
const runs = {};
let errors = 0;
for (const dir of dirs) {
  for (const d of fs.readdirSync(dir)) {
    const m = d.match(/^(full|reuse)_s(\d+)(?:_q(\d+))?_v1_rtt(\d+)_r(\d+)$/);
    if (!m) continue;
    if (!fs.existsSync(path.join(dir, d, 'meta.json'))) continue;
    const s = JSON.parse(fs.readFileSync(path.join(dir, d, 'summary.json'), 'utf8').replace(/^﻿/, ''));
    const key = `${m[1]}|${m[2]}/${m[3] || 0}|${m[4]}`;
    (runs[key] = runs[key] || []).push(s.p50);
    errors += s.errors || 0;
  }
}
const rtts = [...new Set(Object.keys(runs).map((k) => Number(k.split('|')[2])))].filter((r) => r > 0).sort((a, b) => a - b);
const p = (config, size, req, rtt) => { const a = runs[`${config}|${size}/${req}|${rtt}`]; return a && a.length ? med(a) : null; };

console.log('config,rtt,request_extra,response_extra,n_reps,p50_ms,base_p50_ms,measured_round_trips,predicted,agrees');
let agree = 0, total = 0;
for (const config of ['full', 'reuse']) {
  for (const rtt of rtts) {
    const base = p(config, 10240, 1, rtt);
    if (base === null) continue;
    for (const pt of points) {
      const v = p(config, pt.size, pt.req, rtt);
      if (v === null) continue;
      const measured = (v - base) / rtt;
      const expected = config === 'full' ? pt.extra_round_trips_full : pt.extra_round_trips_reuse;
      const ok = Math.round(measured) === expected;
      total++; if (ok) agree++;
      const n = runs[`${config}|${pt.size}/${pt.req}|${rtt}`].length;
      console.log([config, rtt, pt.request_extra, pt.response_extra, n, v.toFixed(1), base.toFixed(1), measured.toFixed(2), expected, ok ? 1 : 0].join(','));
    }
  }
}
console.error(`agree ${agree} of ${total}; request errors ${errors}`);

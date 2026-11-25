#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const MSS = 1448;
const WIRE = { req: 12562, respBody: 20700 };
const REQ_FLIGHTS = [9, 20, 40, 36, 41];
const RESP_BODY_FLIGHTS = [20, 40, 80, 160];
function flights(bytes, caps) {
  let left = bytes, n = 0;
  for (const c of caps) { n++; left -= c * MSS; if (left <= 0) return n; }
  return n + 1;
}
const reqFl = (extra) => Math.max(2, flights(WIRE.req + extra, REQ_FLIGHTS));
const respFl = (extra) => 1 + flights(WIRE.respBody + extra, RESP_BODY_FLIGHTS);
const base = reqFl(0) + respFl(0);

const POINTS = [
  [15000, 4000],
  [27800, 6700],
  [31000, 9800],
  [60000, 40000],
  [85800, 67700],
  [88900, 64600],
  [120000, 120000],
  [137900, 183500],
  [141000, 180500],
  [170000, 250000],
];

const gridsDir = path.join(__dirname, '..', 'grids');
const rows = [['request_extra', 'response_extra', 'size', 'req', 'request_flights', 'response_flights', 'extra_round_trips_full', 'extra_round_trips_reuse',
  'request_margin_bytes', 'response_margin_bytes']];
function margin(bytes, caps) {
  let edge = 0;
  const edges = [];
  for (const c of caps) { edge += c * MSS; edges.push(edge); }
  return Math.min(...edges.map((e) => Math.abs(e - bytes)));
}
for (const [q, r] of POINTS) {
  rows.push([q, r, 10240 + r, q, reqFl(q), respFl(r), reqFl(q) + respFl(r) - base, 0,
    margin(WIRE.req + q, REQ_FLIGHTS), margin(WIRE.respBody + r, RESP_BODY_FLIGHTS)]);
}
fs.writeFileSync(path.join(gridsDir, 'pq-holdout-predictions.csv'), rows.map((r) => r.join(',')).join('\n') + '\n');

const matrix = {
  _comment: 'Holdout check of the frozen flight model (pqbench/sizemodel.js as of 20.11.2026): new sizes and RTT 100 ms, none used to build or correct the model. Predictions: pq-holdout-predictions.csv, written by pqbench/holdout.js before the run.',
  reps: 3,
  warmup_first: 1000,
  warmup_next: 100,
  n: 150,
  n_large: 150,
  large_from: 1048576,
  configs: ['full', 'reuse'],
  points: [[10240, 1, 1], ...POINTS.map(([q, r]) => [10240 + r, 1, q])],
  rtts: [0, 20, 100],
  direct: false,
  control: { config: 'full', size: 10240, vus: 1, per_rep: true },
  stamping_timeout_s: 300,
  burnin: { size: 10240, vus: 4, n: 1000, warmup: 500 },
};
fs.writeFileSync(path.join(gridsDir, 'matrix-pq-holdout.json'), JSON.stringify(matrix, null, 2) + '\n');
console.log(rows.map((r) => r.join(',')).join('\n'));

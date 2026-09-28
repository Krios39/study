// Кривая прогрева: N запросов подряд в 1 VU, статистика по окнам в WINDOW запросов.
//   -e N=3000 -e WINDOW=100 -e SIZE=1024
// Окна реализованы как sub-metrics по тегу (thresholds), потому что handleSummary
// исполняется в отдельном рантайме и данных VU не видит.
import http from 'k6/http';
import { Trend } from 'k6/metrics';

const SIZE = Number(__ENV.SIZE || 1024);
const N = Number(__ENV.N || 3000);
const WINDOW = Number(__ENV.WINDOW || 100);
const PROVIDER = __ENV.PROVIDER || 'DEV/MEMBER/SS2-CODE/ECHO';
const URL = `http://ss1:8080/r1/${PROVIDER}/echo?size=${SIZE}`;
const HEADERS = { 'X-Road-Client': 'DEV/MEMBER/SS1-CODE/CLIENT' };
const WINDOWS = Math.ceil(N / WINDOW);

const lat = new Trend('lat', true);

const thresholds = {};
for (let w = 0; w < WINDOWS; w++) thresholds[`lat{w:${w}}`] = ['max>=0'];

export const options = {
  vus: 1,
  iterations: N,
  thresholds,
  summaryTrendStats: ['med', 'p(90)', 'p(99)'],
};

export default function () {
  const res = http.get(URL, { headers: HEADERS });
  if (res.status === 200) lat.add(res.timings.duration, { w: String(Math.floor(__ITER / WINDOW)) });
}

export function handleSummary(data) {
  let out = 'window\tfrom\tto\tp50\tp90\tp99\n';
  for (let w = 0; w < WINDOWS; w++) {
    const m = data.metrics[`lat{w:${w}}`];
    if (!m) continue;
    const v = m.values;
    out += `${w}\t${w * WINDOW}\t${Math.min(N, (w + 1) * WINDOW)}\t${v.med.toFixed(1)}\t${v['p(90)'].toFixed(1)}\t${v['p(99)'].toFixed(1)}\n`;
  }
  return { stdout: out };
}

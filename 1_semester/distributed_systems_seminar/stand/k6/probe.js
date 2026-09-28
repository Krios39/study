// Этап 0: прогрев + замер в одном VU, статистика только по измеряемым запросам.
// Запускается через probe.ps1 контейнером k6 в сети xroad-network.
//   -e TARGET=xroad|direct  -e SIZE=1024  -e WARMUP=100  -e N=200  -e LABEL=имя
import http from 'k6/http';
import { Trend, Counter } from 'k6/metrics';

const SIZE = Number(__ENV.SIZE || 1024);
const WARMUP = Number(__ENV.WARMUP || 100);
const N = Number(__ENV.N || 200);
const TARGET = __ENV.TARGET || 'xroad';
const LABEL = __ENV.LABEL || TARGET;
const PROVIDER = __ENV.PROVIDER || 'DEV/MEMBER/SS2-CODE/ECHO';

const URL = TARGET === 'direct'
  ? `http://is-provider:8080/echo?size=${SIZE}`
  : `http://ss1:8080/r1/${PROVIDER}/echo?size=${SIZE}`;
const HEADERS = { 'X-Road-Client': 'DEV/MEMBER/SS1-CODE/CLIENT' };

const lat = new Trend('measured_ms', true);
const errors = new Counter('measured_errors');

export const options = {
  vus: 1,
  iterations: WARMUP + N,
  summaryTrendStats: ['min', 'med', 'p(90)', 'p(99)', 'max'],
};

export default function () {
  const res = http.get(URL, { headers: HEADERS, tags: { phase: __ITER < WARMUP ? 'warmup' : 'measured' } });
  if (__ITER >= WARMUP) {
    lat.add(res.timings.duration);
    if (res.status !== 200 || res.body.length !== SIZE) errors.add(1);
  }
}

export function handleSummary(data) {
  const m = data.metrics.measured_ms.values;
  const e = data.metrics.measured_errors ? data.metrics.measured_errors.values.count : 0;
  const line = `${LABEL}\tsize=${SIZE}\tn=${N}\tmin=${m.min.toFixed(1)}\tp50=${m.med.toFixed(1)}\tp90=${m['p(90)'].toFixed(1)}\tp99=${m['p(99)'].toFixed(1)}\tmax=${m.max.toFixed(1)}\terrors=${e}\n`;
  return { stdout: line };
}

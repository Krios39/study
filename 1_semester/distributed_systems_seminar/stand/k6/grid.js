// Один прогон сетки: WARMUP запросов прогрева (не пишутся) + N измеряемых, VUS параллельных клиентов.
// env: CONFIG SIZE VUS N WARMUP REP TARGET(xroad|direct) PROVIDER METHOD(GET|POST) FILL(random|abc) OUT(/out)
// Выход: /out/summary.json (перцентили по измеряемым) и /out/requests.csv (по-запросные строки).
import http from 'k6/http';
import exec from 'k6/execution';
import { Trend, Counter } from 'k6/metrics';

const CONFIG = __ENV.CONFIG || 'full';
const SIZE = Number(__ENV.SIZE || 1024);
const VUS = Number(__ENV.VUS || 1);
const N = Number(__ENV.N || 1000);
const WARMUP = Number(__ENV.WARMUP || 1000);
const REP = Number(__ENV.REP || 1);
const TARGET = __ENV.TARGET || 'xroad';
const METHOD = __ENV.METHOD || 'GET';
const PROVIDER = __ENV.PROVIDER || 'DEV/MEMBER/SS2-CODE/ECHO';
const OUT = __ENV.OUT || '/out';
const FILL = __ENV.FILL || 'random';     // random — несжимаемое тело: размер message log не занижается TOAST-сжатием

const QS = METHOD === 'GET' ? `?size=${SIZE}&fill=${FILL}` : '';
const URL = TARGET === 'direct' ? `http://is-provider:8080/echo${QS}` : `http://ss1:8080/r1/${PROVIDER}/echo${QS}`;
const HEADERS = { 'X-Road-Client': 'DEV/MEMBER/SS1-CODE/CLIENT' };
const BODY = METHOD === 'POST' ? 'x'.repeat(SIZE) : null;

const measured = new Trend('measured', true);
const errors = new Counter('errors');

export const options = {
  scenarios: {
    grid: { executor: 'shared-iterations', vus: VUS, iterations: WARMUP + N, maxDuration: '30m' },
  },
  summaryTrendStats: ['count', 'min', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: { 'measured{phase:measured}': ['max>=0'] },
};

// по-запросные строки копим в VU и отдаём через console.log? нет — пишем через open/teardown нельзя.
// Используем стандартный --out csv (в run.ps1) и фильтруем по тегу phase=measured при разборе.
export default function () {
  const i = exec.scenario.iterationInTest;          // глобальный номер, а не per-VU
  const phase = i < WARMUP ? 'warmup' : 'measured';
  // responseType binary: тело — случайные байты, как строка после UTF-8-декодирования оно другой длины
  const params = { headers: HEADERS, responseType: 'binary', tags: { phase, config: CONFIG, size: String(SIZE), vus: String(VUS), rep: String(REP) } };
  const res = METHOD === 'POST' ? http.post(URL, BODY, params) : http.get(URL, params);
  if (phase === 'measured') {
    measured.add(res.timings.duration, { phase });
    if (res.status !== 200 || !res.body || res.body.byteLength !== SIZE) errors.add(1);
  }
}

export function handleSummary(data) {
  const m = data.metrics['measured{phase:measured}'] || data.metrics.measured;
  const v = m ? m.values : {};
  const e = data.metrics.errors ? data.metrics.errors.values.count : 0;
  const summary = {
    config: CONFIG, target: TARGET, method: METHOD, size: SIZE, vus: VUS, rep: REP, n: N, warmup: WARMUP,
    min: v.min, avg: v.avg, p50: v.med, p90: v['p(90)'], p95: v['p(95)'], p99: v['p(99)'], max: v.max,
    errors: e, count: v.count,
    duration_s: data.state.testRunDurationMs / 1000,           // весь прогон, включая прогрев
    // пропускная способность измеряемой фазы: закрытый цикл без пауз → по Литтлу VUS / средняя задержка
    rps_measured: v.avg ? VUS * 1000 / v.avg : null,
  };
  const line = `${CONFIG}\t${TARGET}\tsize=${SIZE}\tvus=${VUS}\trep=${REP}\tp50=${(v.med || 0).toFixed(1)}\tp90=${(v['p(90)'] || 0).toFixed(1)}\tp99=${(v['p(99)'] || 0).toFixed(1)}\terrors=${e}\n`;
  return { stdout: line, [`${OUT}/summary.json`]: JSON.stringify(summary, null, 2) };
}

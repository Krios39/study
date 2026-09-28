// Дымовой прогон через X-Road: 1 VU, 30 с. Полная сетка (размер × конфигурация × VU) — отдельный скрипт, шаг 3 плана.
// Запуск с хоста:  k6 run -e SIZE=1024 k6/smoke.js
// Из контейнера:   docker run --rm --network host -v ${PWD}/k6:/k6 grafana/k6 run -e SIZE=1024 /k6/smoke.js
import http from 'k6/http';
import { check } from 'k6';

const SIZE = __ENV.SIZE || 1024;
const PROVIDER = __ENV.PROVIDER || 'DEV/MEMBER/SS2-CODE/ECHO';         // или DEV/MEMBER/SS3-CODE/ECHO для ss3
const CONSUMER_SS = __ENV.CONSUMER_SS || 'http://localhost:4210'; // ss1:8080 на хосте
const BASELINE = __ENV.BASELINE || 'http://localhost:8081';       // echo напрямую, мимо X-Road

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: { http_req_failed: ['rate<0.01'] },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(99)', 'max'],
};

export default function () {
  const url = __ENV.DIRECT
    ? `${BASELINE}/echo?size=${SIZE}`
    : `${CONSUMER_SS}/r1/${PROVIDER}/echo?size=${SIZE}`;
  const res = http.get(url, { headers: { 'X-Road-Client': 'DEV/MEMBER/SS1-CODE/CLIENT' } });
  check(res, {
    'status 200': (r) => r.status === 200,
    'size ok': (r) => r.body.length == SIZE,
  });
}

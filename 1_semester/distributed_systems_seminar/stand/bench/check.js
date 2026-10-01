#!/usr/bin/env node
// 2. Готов ли стенд к замерам. Ничего не меняет, только проверяет; код возврата 0 = можно запускать run.js.
//   node bench/check.js
//   node bench/check.js --quick     # без hurl-диагностики SS (быстрее, ~15 с)
'use strict';
const L = require('./lib');
const path = require('node:path');

const quick = process.argv.includes('--quick');
const results = [];
function check(name, fn) {
  let ok = false, note = '';
  try { const r = fn(); ok = r === true || (r && r.ok); note = (r && r.note) || ''; } catch (e) { note = e.message.split('\n')[0]; }
  results.push({ name, ok, note });
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${note ? '  — ' + note : ''}`);
  return ok;
}

// --- несколько машин (multihost/): docker на l1/l3 через context, часы (метки времени, OCSP и подсчёт обращений к CA
// по логам ca сравнивают время разных машин), задержка по свитчу
if (L.THIS_HOST) {
  for (const h of L.HOSTS.filter((x) => x !== L.THIS_HOST)) {
    check(`${h}: docker via context`, () => { const v = L.sh('docker', [...L.hostCtx(h), 'version', '--format', '{{.Server.Version}}'], { ok: true }); return { ok: !!v, note: v || `docker --context ${h} — multihost/setup.sh on ${L.THIS_HOST}` }; });
    check(`${h}: clock offset`, () => {
      const t0 = Date.now() / 1000;
      const remote = Number(L.sh('ssh', [h, 'date +%s.%N'], { ok: true }));
      const off = (remote - (t0 + Date.now() / 1000) / 2) * 1000;   // середина интервала ssh-вызова
      return { ok: Number.isFinite(off) && Math.abs(off) < 50, note: `${off.toFixed(0)} ms (ssh-оценка, грубая; chronyc tracking на ${h})` };
    });
    check(`${h}: ping over switch`, () => { const r = L.sh('ping', ['-c', '5', '-q', h], { ok: true }) || ''; const m = /= [\d.]+\/([\d.]+)\//.exec(r); return { ok: !!m && Number(m[1]) < 2, note: m ? `rtt avg ${m[1]} ms` : 'no reply' }; });
  }
}

// --- контейнеры
// ss3 в измеряемом пути не участвует, run.js останавливает его на время сетки — остановленный ss3 не ошибка
const ss3 = L.running('ss3');
for (const c of ['cs', 'ca', 'ss0', 'ss1', 'ss2', 'ss3', 'is-provider', ...(L.THIS_HOST ? ['is-provider-b'] : [])]) {
  if (c === 'ss3' && !ss3) { check('ss3 stopped', () => ({ ok: true, note: 'not in the measured path; node bench/up.js starts it' })); continue; }
  check(`${c} healthy`, () => { const h = L.health(c); return { ok: h === 'healthy', note: h }; });
}

// --- образы для замера (иначе первый прогон потратит время на pull)
for (const img of ['grafana/k6:latest', 'curlimages/curl:latest']) {
  check(`image ${img}`, () => L.shCode('docker', ['image', 'inspect', img]) === 0 || (L.sh('docker', ['pull', img], { ok: true }), L.shCode('docker', ['image', 'inspect', img]) === 0));
}

// --- сеть и сервисы
check('echo direct (baseline-0)', () => { const r = L.smokeDirect(16); return { ok: r === '200 16', note: r }; });
check('X-Road ss1 → ss2 (provider A)', () => { const r = L.smoke(L.PROVIDERS.ss2); return { ok: r === '200', note: `HTTP ${r}` }; });
if (ss3) check('X-Road ss1 → ss3 (provider B)', () => { const r = L.smoke(L.PROVIDERS.ss3); return { ok: r === '200', note: `HTTP ${r}` }; });

check('TSA (openssl ts -query → ca:8899)', () => { const r = L.tsaProbe(); return { ok: r === '200', note: `HTTP ${r}${r !== '200' ? ' — docker compose restart ca' : ''}` }; });
check('ca tsa_server.py многопоточный', () => { const l = L.sh('docker', [...L.ctx('ca'), 'logs', 'ca'], { ok: true }); const m = /tsa_server: (\d+) workers/.exec(l); return { ok: !!m, note: m ? `${m[1]} workers` : 'оригинальный однопоточный — docker compose up -d ca' }; });

check('link counters ss1 <-> ss2 (iptables, stand-netcount)', () => { const b = L.linkBytes(); return { ok: 'xroad_tx' in b, note: JSON.stringify(b) }; });

// --- доступ к БД, которым пользуются clean.js и config.js
for (const c of ['ss0', 'ss1', 'ss2', ...(ss3 ? ['ss3'] : [])]) check(`${c} messagelog db`, () => ({ ok: true, note: L.pgTable(c, 'messagelog', 'logrecord') }));
check('cs system_parameters', () => ({ ok: true, note: L.pgTable('cs', 'centerui_production', 'system_parameters') }));

// --- конфигурация доверия = full
const BENCH_KEYS = ['message-body-logging', 'acceptable-timestamp-failure-period', 'timestamp-immediately'];
for (const c of L.MEASURED_SS) {
  check(`${c} local.ini без ключей замера`, () => {
    const ini = L.iniDump(c);
    const found = BENCH_KEYS.filter((k) => ini.includes(k));
    return { ok: !found.length, note: found.length ? `${found.join(', ')} — node bench/config.js full` : 'full' };
  });
}
check('cs без ocspFreshnessSeconds', () => {
  const d = L.csParamDump();
  return { ok: !d.includes('ocspFreshnessSeconds'), note: d.includes('ocspFreshnessSeconds') ? 'node bench/config.js full' : 'default 3600' };
});

// --- лог testca с портами (иначе OCSP/TSA в meta.json будут нулями)
check('ca nginx log_format ports', () => {
  const t = L.dexecOk('ca', 'sh', '-c', 'nginx -T 2>/dev/null | grep -c "access_log /dev/stdout ports"');
  return { ok: Number(t) >= 1, note: Number(t) >= 1 ? 'active' : 'docker compose up -d --force-recreate ca' };
});

// --- фон: стенд должен простаивать
check('idle CPU', () => {
  const out = (L.THIS_HOST ? L.HOSTS.map(L.hostCtx) : [[]])
    .map((a) => L.sh('docker', [...a, 'stats', '--no-stream', '--format', '{{.Name}} {{.CPUPerc}}'], { ok: true }) || '').join('\n');
  const total = out.split('\n').map((l) => Number((l.split(' ')[1] || '0').replace('%', ''))).reduce((a, b) => a + b, 0);
  return { ok: total < 40, note: `${total.toFixed(0)}% суммарно${total >= 40 ? ' — подождать, фон ещё не успокоился' : ''}` };
});

// --- диагностика SS через API: gconf, TSA, OCSP, сертификаты
if (!quick) {
  for (const c of L.MEASURED_SS) {
    check(`${c} diagnostics (gconf/TSA/OCSP/certs)`, () => ({ ok: L.hurl('check-ss.hurl', { ss_host: c }, { ok: true, retry: 0 }), note: 'hurl/check-ss.hurl' }));
  }
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAIL — стенд не готов` : `\nвсё ok — можно: node bench/run.js`);
console.log(`конфигурации: ${L.readJson(path.join(__dirname, 'matrix.json')).configs.join(', ')}`);
process.exit(failed.length ? 1 : 0);

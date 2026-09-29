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

// --- контейнеры
for (const c of ['cs', 'ca', 'ss0', 'ss1', 'ss2', 'ss3', 'is-provider']) {
  check(`${c} healthy`, () => { const h = L.health(c); return { ok: h === 'healthy', note: h }; });
}

// --- образы для замера (иначе первый прогон потратит время на pull)
for (const img of ['grafana/k6:latest', 'curlimages/curl:latest']) {
  check(`image ${img}`, () => L.shCode('docker', ['image', 'inspect', img]) === 0 || (L.sh('docker', ['pull', img], { ok: true }), L.shCode('docker', ['image', 'inspect', img]) === 0));
}

// --- сеть и сервисы
check('echo direct (baseline-0)', () => { const r = L.smokeDirect(16); return { ok: r === '200 16', note: r }; });
check('X-Road ss1 → ss2 (provider A)', () => { const r = L.smoke(L.PROVIDERS.ss2); return { ok: r === '200', note: `HTTP ${r}` }; });
check('X-Road ss1 → ss3 (provider B)', () => { const r = L.smoke(L.PROVIDERS.ss3); return { ok: r === '200', note: `HTTP ${r}` }; });

check('TSA (openssl ts -query → ca:8899)', () => { const r = L.tsaProbe(); return { ok: r === '200', note: `HTTP ${r}${r !== '200' ? ' — docker compose restart ca' : ''}` }; });
check('ca tsa_server.py многопоточный', () => { const l = L.sh('docker', ['logs', 'ca'], { ok: true }); const m = /tsa_server: (\d+) workers/.exec(l); return { ok: !!m, note: m ? `${m[1]} workers` : 'оригинальный однопоточный — docker compose up -d ca' }; });

// --- доступ к БД, которым пользуются clean.js и config.js
for (const c of ['ss0', 'ss1', 'ss2', 'ss3']) check(`${c} messagelog db`, () => ({ ok: true, note: L.pgTable(c, 'messagelog', 'logrecord') }));
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
  const out = L.sh('docker', ['stats', '--no-stream', '--format', '{{.Name}} {{.CPUPerc}}'], { ok: true });
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

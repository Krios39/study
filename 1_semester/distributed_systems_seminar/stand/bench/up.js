#!/usr/bin/env node
// 1. Поднять стенд.
//   node bench/up.js            # docker compose up, ждать healthy, инициализировать (если ещё нет), дождаться первого ответа через X-Road
//   node bench/up.js --fresh    # сначала docker compose down -v (снести volume'ы) — чистый стенд с нуля, ~15 мин
// Инициализация (hurl-сценарии) не идемпотентна: если стенд инициализирован наполовину, скрипт скажет сделать --fresh.
'use strict';
const L = require('./lib');

// на нескольких машинах у provider B свой эхо-сервис рядом (multihost/compose.yml)
const SERVICES = ['cs', 'ca', 'ss0', 'ss1', 'ss2', 'ss3', 'is-provider', ...(L.THIS_HOST ? ['is-provider-b'] : [])];
const fresh = process.argv.includes('--fresh');

async function waitHealthy(timeoutS = 600) {
  const t0 = Date.now();
  for (;;) {
    const st = Object.fromEntries(SERVICES.map((c) => [c, L.health(c)]));
    const bad = SERVICES.filter((c) => st[c] !== 'healthy');
    if (!bad.length) return;
    if (Date.now() - t0 > timeoutS * 1000) throw new Error(`not healthy after ${timeoutS}s: ${bad.map((c) => `${c}=${st[c]}`).join(' ')}`);
    L.log(`waiting: ${bad.map((c) => `${c}=${st[c]}`).join(' ')}`);
    await L.sleep(10000);
  }
}

// признак инициализации: у SS появился якорь конфигурации (первый шаг 02-ss-base.hurl)
const hasAnchor = (c) => L.shCode('docker', [...L.ctx(c), 'exec', c, 'test', '-f', '/etc/xroad/configuration-anchor.xml']) === 0;

function init() {
  const H = (file, vars) => { L.log(`>>> ${file} ${JSON.stringify(vars || {})}`); L.hurl(file, vars, { retry: 30, interval: 10000 }); };
  H('01-cs.hurl');
  H('02-ss-base.hurl', { ss_host: 'ss0', ss_code: 'SS0', member_code: 'SS0-CODE', member_name: 'SS0-NAME' });
  H('03-ss0-management.hurl', { ss_host: 'ss0', ss_code: 'SS0' });
  for (const i of [1, 2, 3]) H('02-ss-base.hurl', { ss_host: `ss${i}`, ss_code: `SS${i}`, member_code: `SS${i}-CODE`, member_name: `SS${i}-NAME` });
  H('04-consumer.hurl', { ss_host: 'ss1', member_code: 'SS1-CODE', subsystem: 'CLIENT' });
  H('05-provider.hurl', { ss_host: 'ss2', member_code: 'SS2-CODE', subsystem: 'ECHO' });
  H('05-provider.hurl', { ss_host: 'ss3', member_code: 'SS3-CODE', subsystem: 'ECHO',
    ...(L.THIS_HOST ? { echo_url: 'http://is-provider-b:8080/echo' } : {}) });
}

async function waitXroad(timeoutS) {
  const t0 = Date.now();
  for (;;) {
    const a = L.smokeErr(L.PROVIDERS.ss2), b = L.smokeErr(L.PROVIDERS.ss3);
    if (a.code === '200' && b.code === '200') return;
    const why = `ss2=${a.code} ss3=${b.code}: ${(a.code !== '200' ? a : b).body}`;
    if (Date.now() - t0 > timeoutS * 1000) throw new Error(`X-Road not answering after ${timeoutS}s — ${why}`);
    L.log(`waiting for X-Road: ${why}`);
    await L.sleep(10000);
  }
}

(async () => {
  if (fresh) { L.log('docker compose down -v'); L.compose('down', '-v', '--remove-orphans'); }
  L.log('docker compose up -d --build');
  L.compose('up', '-d', '--build');
  await waitHealthy();
  L.log('all containers healthy');

  if (L.smoke() === '200') { L.log('X-Road already answers — stand is up'); return; }
  const anchors = ['ss0', 'ss1', 'ss2', 'ss3'].map(hasAnchor);
  if (anchors.every((x) => x)) {
    // после рестарта контейнеров software-токен закрыт → у signer «нет сертификатов»; открыть PIN'ом
    L.log('unlocking software tokens on ss0..ss3');
    for (const c of ['ss0', 'ss1', 'ss2', 'ss3']) L.hurl('token-login.hurl', { ss_host: c }, { retry: 3 });
  }
  if (anchors.every((x) => !x)) {
    L.log('stand not initialised — running hurl scenarios (~10–15 min)');
    init();
  } else if (!anchors.every((x) => x)) {
    throw new Error('stand is half-initialised (anchors: ' + anchors.join(',') + ') — run: node bench/up.js --fresh');
  } else {
    L.log('stand initialised, waiting for global configuration to reach ss1/ss2/ss3');
  }
  try {
    await waitXroad(anchors.every((x) => x) ? 180 : 300);
  } catch (e) {
    if (!/authentication certificate/.test(e.message)) throw e;
    // после долгого простоя OCSP-ответы на сертификаты истекли, а signer обновляет их раз в ocspFetchInterval (20 мин):
    // до этого «Security server has no authentication certificate». Рестарт signer — запрос OCSP сразу (~20 с)
    L.log('auth certificate not usable (stale OCSP after downtime) — restarting xroad-signer and xroad-proxy');
    for (const c of ['ss0', 'ss1', 'ss2', 'ss3'].filter(L.running)) L.dexec(c, 'supervisorctl', 'restart', 'xroad-signer', 'xroad-proxy');
    await waitXroad(300);
  }
  L.log('X-Road answers from both providers — stand is up. Next: node bench/check.js');
})().catch((e) => { console.error(e.message); process.exit(1); });

#!/usr/bin/env node
// Переключение конфигурации доверия на стенде.
//   node bench/config.js full | nobody | notsa | synctsa | reuse | ocsp | show
// Каждое имя — полное состояние: сначала всё сбрасывается к full, потом применяется нужное.
// Что стоит за каждым (X-Road 7.8.3):
//   full     — дефолты; TSA настроен; ocspFreshnessSeconds=3600 (дефолт CS)
//   nobody   — [message-log] message-body-logging=false           (цена записи тела в message log)
//   notsa    — CS system_parameters.timeStampingIntervalSeconds=86400 (максимум; LogManager.TimestamperJob) — TSA остаётся
//              настроен, но пакетное проставление меток раз в сутки → в прогонах TSA не участвует. Снять TSA совсем нельзя:
//              LogManager.verifyCanLogMessage() при пустом списке TSA отвергает каждое сообщение независимо от
//              acceptable-timestamp-failure-period (проверено по исходникам 7.8.3).
//   synctsa  — [message-log] timestamp-immediately=true           (метка времени синхронно на каждое сообщение)
//   reuse    — [proxy] pool-enable-connection-reuse=true (клиент), server-support-clients-pooled-connections=true и
//              server-connector-max-idle-time=120000 (провайдер) — как в пакете FI. По умолчанию (и в EE) false: каждое
//              сообщение открывает новое TCP + mTLS-соединение между SS (видно по tcpdump 05.10). Разность full − reuse =
//              цена mTLS-рукопожатия на каждое сообщение. Ставится на ss1 и ss2 (обе роли на обоих — не мешает).
//   ocsp     — CS system_parameters.ocspFreshnessSeconds=10. НЕ РАБОТАЕТ и из сетки убран (matrix.json): по исходникам 7.8.3
//              клиентский proxy никогда не ходит к OCSP-ответчику сам — берёт ответ из кеша signer'а (свой или у peer'а по 5577,
//              AuthTrustVerifier.getOcspResponses), а signer обновляет ответы раз в ocspFetchInterval (мин. 60 с, по умолчанию
//              1200 с, OcspClientExecuteScheduler). При freshness < fetchInterval ответ «слишком старый» (OcspVerifier.isExpired)
//              → TLS handshake failed на каждом запросе. OCSP в X-Road по построению не в пути запроса; его цена —
//              фоновые обращения раз в 1200 с + проверка подписи кешированного ответа при TLS-рукопожатии.
'use strict';
const L = require('./lib');

const CONFIGS = ['full', 'nobody', 'notsa', 'synctsa', 'reuse', 'ocsp'];
// ключи [proxy] конфигурации reuse
const REUSE = { 'pool-enable-connection-reuse': 'true', 'server-support-clients-pooled-connections': 'true', 'server-connector-max-idle-time': '120000' };
const SS = L.MEASURED_SS;

async function resetToFull() {
  for (const c of SS) {
    L.iniDel(c, 'message-log', 'message-body-logging');
    L.iniDel(c, 'message-log', 'acceptable-timestamp-failure-period');
    L.iniDel(c, 'message-log', 'timestamp-immediately');
    for (const k of Object.keys(REUSE)) L.iniDel(c, 'proxy', k);
  }
  // TSA обратно, если убран (tsa-add.hurl принимает 201 и 409 — идемпотентно)
  for (const c of SS) L.hurl('tsa-add.hurl', { ss_host: c });
  L.csParamDel('ocspFreshnessSeconds');
  L.csParamDel('timeStampingIntervalSeconds');
}

async function apply(name) {
  if (!CONFIGS.includes(name)) throw new Error(`unknown config ${name}; one of ${CONFIGS.join(', ')}`);
  L.log(`config → ${name}: reset to full`);
  await resetToFull();
  let waitGconf = false;
  switch (name) {
    case 'nobody':
      for (const c of SS) L.iniSet(c, 'message-log', 'message-body-logging', 'false');
      break;
    case 'notsa':
      L.csParamSet('timeStampingIntervalSeconds', '86400');
      waitGconf = true;
      break;
    case 'synctsa':
      for (const c of SS) L.iniSet(c, 'message-log', 'timestamp-immediately', 'true');
      break;
    case 'reuse':
      for (const c of SS) for (const [k, v] of Object.entries(REUSE)) L.iniSet(c, 'proxy', k, v);
      break;
    case 'ocsp':
      L.csParamSet('ocspFreshnessSeconds', '10');
      waitGconf = true;
      break;
    default: break;
  }
  L.log('restart xroad-proxy on', SS.join(', '));
  await L.restartProxy(SS);
  if (waitGconf || name === 'full') {
    // параметр CS доезжает до SS через gconf: генерация ≤60 с + скачивание ≤60 с
    L.log('waiting 130 s for global configuration to propagate');
    await L.sleep(130000);
    await L.waitSmoke();
  }
  L.log(`config ${name} applied`);
}

function show() {
  for (const c of SS) {
    console.log(`--- ${c} local.ini`);
    console.log(L.iniDump(c) || '(empty)');
  }
  console.log('--- cs system_parameters');
  console.log(L.csParamDump() || '(defaults)');
}

module.exports = { CONFIGS, apply, show };

if (require.main === module) {
  const name = process.argv[2];
  if (!name) { console.error('usage: node bench/config.js <' + CONFIGS.join('|') + '|show>'); process.exit(2); }
  (name === 'show' ? Promise.resolve(show()) : apply(name)).catch((e) => { console.error(e.message); process.exit(1); });
}

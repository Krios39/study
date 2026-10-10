// Общие помощники: docker, ожидания, конфигурации. Без зависимостей, Node >= 18.
'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const STAND = path.resolve(__dirname, '..');
// путь стенда для других машин: в Fedora Atomic (Aurora) /opt — ссылка на /var/opt, и Node видит /var/opt/study/…,
// а на Debian/Ubuntu есть только /opt/study/…
const REMOTE_STAND = STAND.replace(/^\/var\/opt\//, '/opt/');
const NET = 'xroad-network';
const CLIENT = 'DEV/MEMBER/SS1-CODE/CLIENT';
const PROVIDERS = { ss2: 'DEV/MEMBER/SS2-CODE/ECHO', ss3: 'DEV/MEMBER/SS3-CODE/ECHO' };
const MEASURED_SS = ['ss1', 'ss2'];        // consumer и provider A — измеряемый путь

// журнал: всё, что печатается (log, вывод hurl/compose/k6), дублируется в файл — run.js ставит results/<дата>/run.log
let LOGFILE = null;
let lastStatus = 0;
function setLogFile(p) { fs.mkdirSync(path.dirname(p), { recursive: true }); LOGFILE = p; tee(`--- ${new Date().toISOString()} ${process.argv.slice(1).join(' ')}`); }
function tee(text) { if (LOGFILE && text) fs.appendFileSync(LOGFILE, text.endsWith('\n') ? text : text + '\n'); }

function sh(cmd, args, opts = {}) {
  const { inherit, ok, ...rest } = opts;
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...rest });
  lastStatus = r.status;
  if (inherit) {                       // показать и записать (настоящий inherit минует журнал)
    const out = (r.stdout || '') + (r.stderr || '');
    process.stdout.write(out);
    tee(out);
  }
  if (r.status !== 0 && !ok) {
    const shown = args.map((a) => a.replace(/(admin_password|token_pin)=[^\s']*/g, '$1=***'));   // не светить секреты в run.log
    throw new Error(`${cmd} ${shown.join(' ')} → exit ${r.status}\n${r.stderr || ''}`);
  }
  return (r.stdout || '').trim();
}
// .env стенда (не в git, шаблон .env.example): секреты, а на нескольких машинах — STAND_HOST и раскладка compose
function readEnv() {
  const file = path.join(STAND, '.env');
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}
const ENV = readEnv();

// Несколько машин (multihost/, среда B): STAND_HOST=l1|l2|l3 в .env — эта машина; bench запускается на l2.
// Контейнеры других машин — через docker context (созданы multihost/setup.sh: ssh по подсети свитча),
// compose на них — через ssh в тот же каталог (у каждой машины свой .env с профилем и интерфейсом).
// Без STAND_HOST всё как раньше, на одной машине.
const THIS_HOST = (process.env.STAND_HOST ?? ENV.STAND_HOST) || null;   // env перекрывает .env (разбор старых прогонов)
const HOSTS = ['l1', 'l2', 'l3'];
const HOST_OF = { cs: 'l1', ca: 'l1', ss0: 'l1', ss3: 'l1', 'is-provider-b': 'l1', hurl: 'l1', ss1: 'l2', ss2: 'l3', 'is-provider': 'l3' };
const hostOf = (c) => (THIS_HOST ? HOST_OF[c] || THIS_HOST : null);
const ctx = (c) => (THIS_HOST && hostOf(c) !== THIS_HOST ? ['--context', hostOf(c)] : []);
const hostCtx = (h) => (THIS_HOST && h !== THIS_HOST ? ['--context', h] : []);
// временные контейнеры (k6, curl) в xroad-network: на нескольких машинах docker DNS знает только свои контейнеры —
// имена остальных берём из extra_hosts в multihost/compose.yml (один источник адресов)
const LAN_HOSTS = THIS_HOST
  ? [...fs.readFileSync(path.join(STAND, 'multihost', 'compose.yml'), 'utf8').matchAll(/^\s*- "([a-z0-9-]+):(10\.10\.0\.\d+)"/gm)].map((m) => `${m[1]}:${m[2]}`)
  : [];
const NETARGS = ['--network', NET, ...LAN_HOSTS.flatMap((h) => ['--add-host', h])];

const docker = (...args) => sh('docker', args);
// docker-команда над контейнером c — на его машине
const dctl = (c, ...args) => sh('docker', [...ctx(c), ...args, c]);
const dexec = (c, ...args) => sh('docker', [...ctx(c), 'exec', c, ...args]);
const dexecOk = (c, ...args) => sh('docker', [...ctx(c), 'exec', c, ...args], { ok: true });
// код возврата, без исключений
const shCode = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...opts }).status;
// аргумент для удалённой оболочки (ssh)
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
// docker compose из каталога стенда, вывод в консоль. На нескольких машинах — на каждой (или на host), со своим .env
function compose(...args) {
  if (!THIS_HOST) return sh('docker', ['compose', ...args], { cwd: STAND, inherit: true });
  for (const h of HOSTS) composeOn(h, ...args);
  return '';
}
function composeOn(h, ...args) {
  if (!THIS_HOST || h === THIS_HOST) return sh('docker', ['compose', ...args], { cwd: STAND, inherit: true });
  return sh('ssh', [h, `cd ${shq(REMOTE_STAND)} && docker compose ${args.map(shq).join(' ')}`], { inherit: true });
}
// статус healthcheck контейнера: healthy | starting | unhealthy | none | missing
function health(c) {
  const r = spawnSync('docker', [...ctx(c), 'inspect', '-f', '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}', c], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'missing';
}
// контейнер запущен (остановленный ss3 — нормально во время сетки)
const running = (c) => (spawnSync('docker', [...ctx(c), 'inspect', '-f', '{{.State.Running}}', c], { encoding: 'utf8' }).stdout || '').trim() === 'true';
// docker stats по машинам: [{ args: [...context], names: [...] }] — для сводки CPU и stats.csv
function statsTargets(names) {
  if (!THIS_HOST) return [{ args: [], names }];
  return HOSTS.map((h) => ({ args: hostCtx(h), names: names.filter((c) => hostOf(c) === h) })).filter((t) => t.names.length);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => { const line = `${new Date().toISOString().slice(11, 19)} ${a.join(' ')}`; console.log(line); tee(line); };

// один запрос через X-Road из контейнера curl; вернёт HTTP-код строкой
function smoke(provider = PROVIDERS.ss2) {
  return sh('docker', ['run', '--rm', ...NETARGS, 'curlimages/curl', '-s', '-o', '/dev/null', '-m', '20',
    '-w', '%{http_code}', '-H', `X-Road-Client: ${CLIENT}`,
    `http://ss1:8080/r1/${provider}/echo?size=16`], { ok: true });
}
// то же, но с телом ответа (первые 300 символов) — чтобы видеть текст ошибки X-Road при не-200
function smokeErr(provider = PROVIDERS.ss2) {
  const out = sh('docker', ['run', '--rm', ...NETARGS, 'curlimages/curl', '-s', '-m', '20',
    '-w', '\\n%{http_code}', '-H', `X-Road-Client: ${CLIENT}`,
    `http://ss1:8080/r1/${provider}/echo?size=16`], { ok: true });
  const i = out.lastIndexOf('\n');
  return { code: out.slice(i + 1), body: out.slice(0, i).replace(/\s+/g, ' ').slice(0, 300) };
}
// настоящий запрос метки времени к testca (запрос делает openssl на ss1): "200" = TSA жив
function tsaProbe() {
  const q = dexecOk('ss1', 'sh', '-c', 'openssl ts -query -data /etc/hostname -sha256 | base64 -w0');
  if (!q) return 'noquery';
  return sh('docker', ['run', '--rm', ...NETARGS, 'curlimages/curl', 'sh', '-c',
    `echo ${q} | base64 -d > /tmp/q && curl -s -m 10 -o /dev/null -w '%{http_code}' -H 'Content-Type: application/timestamp-query' --data-binary @/tmp/q http://ca:8899/`], { ok: true });
}
// TSA не отвечает → перезапустить контейнер ca и дождаться ответа; вернёт true, если пришлось перезапускать
async function ensureTsa() {
  if (tsaProbe() === '200') return false;
  log('TSA not answering — docker compose restart ca');
  composeOn(hostOf('ca'), 'restart', 'ca');
  for (let i = 0; i < 20; i++) { await sleep(3000); if (tsaProbe() === '200') return true; }
  throw new Error('TSA still not answering after restart of ca');
}
// прямой запрос к эхо-сервису мимо X-Road: "<код> <байт>"
function smokeDirect(size = 16) {
  return sh('docker', ['run', '--rm', ...NETARGS, 'curlimages/curl', '-s', '-o', '/dev/null', '-m', '10',
    '-w', '%{http_code} %{size_download}', `http://is-provider:8080/echo?size=${size}&fill=random`], { ok: true });
}

async function waitSmoke(timeoutS = 120) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < timeoutS * 1000) {
    last = smokeErr();
    if (last.code === '200') return true;
    await sleep(3000);
  }
  throw new Error(`smoke request did not succeed in ${timeoutS}s: HTTP ${last.code} ${last.body}`);
}

async function restartProxy(containers = MEASURED_SS) {
  for (const c of containers) dexec(c, 'supervisorctl', 'restart', 'xroad-proxy');
  await sleep(8000);
  try {
    await waitSmoke(300);                       // холодный старт proxy иногда дольше 2 мин
  } catch (e) {
    // диагностика в журнал: состояние процессов и хвост proxy.log на измеряемых SS
    for (const c of containers) {
      log(`--- ${c} supervisorctl status:\n` + dexecOk(c, 'supervisorctl', 'status'));
      log(`--- ${c} proxy.log tail:\n` + dexecOk(c, 'tail', '-n', '40', '/var/log/xroad/proxy.log'));
    }
    throw e;
  }
}

// local.ini: crudini --set / --del
function iniSet(c, section, key, value) { dexec(c, 'crudini', '--set', '/etc/xroad/conf.d/local.ini', section, key, String(value)); }
function iniDel(c, section, key) { dexecOk(c, 'crudini', '--del', '/etc/xroad/conf.d/local.ini', section, key); }
function iniDump(c) { return dexecOk(c, 'cat', '/etc/xroad/conf.d/local.ini'); }

// логин/пароль/PIN стенда — из .env (не в git, шаблон .env.example); тот же файл читает docker compose
function secrets() {
  if (!ENV.XROAD_ADMIN_PASSWORD) throw new Error(`${path.join(STAND, '.env')}: no XROAD_* — copy .env.example to .env and fill it in`);
  return { admin_user: ENV.XROAD_ADMIN_USER, admin_password: ENV.XROAD_ADMIN_PASSWORD, token_pin: ENV.XROAD_TOKEN_PIN };
}

// hurl-файл против стенда (для API SS/CS). На нескольких машинах — на l1: там volume ca-data с сертификатами testca
function hurl(file, vars = {}, opts = {}) {
  const args = ['run', '--rm', '--no-deps', 'hurl', '--insecure', '--variables-file', '/hurl-src/vars.env',
    '--file-root', '/hurl-files', '--retry', String(opts.retry ?? 10), '--retry-interval', String(opts.interval ?? 5000), '--test'];
  for (const [k, v] of Object.entries({ ...secrets(), ...vars })) args.push('--variable', `${k}=${v}`);
  args.push(`/hurl-src/${file}`);
  const h = hostOf('hurl');
  const [cmd, cargs] = !THIS_HOST || h === THIS_HOST ? ['docker', ['compose', ...args]]
    : ['ssh', [h, `cd ${shq(REMOTE_STAND)} && docker compose ${args.map(shq).join(' ')}`]];
  if (opts.ok) return sh(cmd, cargs, { cwd: STAND, inherit: !opts.quiet, ok: true }) !== null && lastStatus === 0;
  sh(cmd, cargs, { cwd: STAND, inherit: true });
  return true;
}

// psql от postgres внутри контейнера. Таблицы X-Road лежат не в public (CS: схема = db-пользователь,
// messagelog: схема messagelog), и у postgres их схемы нет в search_path. Поэтому схему ищем один раз
// и ставим search_path на время сессии: без него на CS падает history-триггер (тип changed_field_type в той же схеме).
function psql(c, db, sql, opts = {}) {
  const fn = opts.ok ? dexecOk : dexec;
  const pre = opts.schema ? `SET search_path TO ${opts.schema},public; ` : '';
  return fn(c, 'su', 'postgres', '-c', `psql -qtA -d ${db} -c "${pre}${sql}"`);
}
const schemaCache = new Map();
function pgSchema(c, db, table) {
  const k = `${c}|${db}|${table}`;
  if (!schemaCache.has(k)) {
    const s = psql(c, db, `select table_schema from information_schema.tables where table_name='${table}' and table_schema not in ('pg_catalog','information_schema') limit 1`);
    if (!s) throw new Error(`${c}: table ${table} not found in db ${db}`);
    schemaCache.set(k, s);
  }
  return schemaCache.get(k);
}
const pgTable = (c, db, table) => `${pgSchema(c, db, table)}.${table}`;

// CS: system_parameters (в REST API его нет)
const CS_DB = 'centerui_production';
const csSql = (sql, opts = {}) => psql('cs', CS_DB, sql, { schema: pgSchema('cs', CS_DB, 'system_parameters'), ...opts });
function csParamSet(key, value) {
  csSql(`DELETE FROM system_parameters WHERE key='${key}'; INSERT INTO system_parameters(key,value,created_at,updated_at) VALUES('${key}','${value}',now(),now());`);
}
function csParamDel(key) { csSql(`DELETE FROM system_parameters WHERE key='${key}'`); }
function csParamDump() { return csSql(`SELECT key||'='||value FROM system_parameters ORDER BY key`, { ok: true }); }

// счётчики интерфейса контейнера, байты
function netBytes(c) {
  const rx = Number(dexec(c, 'cat', '/sys/class/net/eth0/statistics/rx_bytes'));
  const tx = Number(dexec(c, 'cat', '/sys/class/net/eth0/statistics/tx_bytes'));
  return { rx, tx };
}

// байты на канале consumer SS <-> provider SS: iptables-счётчики в namespace ss1 (образ stand-netcount, ss1 не меняется).
// IP-уровень (с заголовками IP/TCP). xroad — только обмен сообщениями (ss2:5500), link — весь трафик ss1 <-> ss2
// (плюс 5577: OCSP-ответы между SS). Правила ставятся при первом вызове и живут до рестарта контейнера ss1.
const LINK_RULES = [
  ['OUTPUT', '-d', 'IP', '-p', 'tcp', '--dport', '5500', 'xroad_tx'],
  ['INPUT', '-s', 'IP', '-p', 'tcp', '--sport', '5500', 'xroad_rx'],
  ['OUTPUT', '-d', 'IP', 'link_tx'],
  ['INPUT', '-s', 'IP', 'link_rx'],
];
function linkBytes(from = 'ss1', to = 'ss2') {
  if (shCode('docker', [...ctx(from), 'image', 'inspect', 'stand-netcount']) !== 0) composeOn(hostOf(from), '--profile', 'tools', 'build', 'netcount');
  const ip = dexec(from, 'getent', 'hosts', to).split(/\s+/)[0];
  // свои правила на каждого провайдера: ss2 — xroad_tx…, ss3 — ss3_xroad_tx… (ключи в ответе — без префикса)
  const pre = to === 'ss2' ? '' : `${to}_`;
  const ensure = LINK_RULES.map((r) => {
    const [chain, ...rest] = r;
    const spec = [...rest.slice(0, -1).map((x) => (x === 'IP' ? ip : x)), '-m', 'comment', '--comment', pre + r[r.length - 1]].join(' ');
    return `iptables -C ${chain} ${spec} 2>/dev/null || iptables -A ${chain} ${spec}`;
  }).join('; ');
  const out = sh('docker', [...ctx(from), 'run', '--rm', '--net', `container:${from}`, '--cap-add', 'NET_ADMIN', 'stand-netcount', 'sh', '-c',
    `${ensure}; iptables -L INPUT -v -x -n; iptables -L OUTPUT -v -x -n`]);
  const res = {};
  for (const line of out.split('\n')) {
    const m = /^\s*\d+\s+(\d+)\s.*\/\* (\w+) \*\//.exec(line);
    if (m && (pre ? m[2].startsWith(pre) : /^(xroad|link)_/.test(m[2]))) res[m[2].slice(pre.length)] = Number(m[1]);
  }
  return res;
}

// режим процессора машины: governor, EPP, частоты. На Windows (Docker Desktop) sysfs недоступен — null.
// Режим питания меняет задержки в разы (05.10: 79.7 мс в balanced против 28.7 в performance) — пишется в env.json
// Windows 11: режим «Максимальная производительность» = overlay ded574b5-… поверх схемы (Параметры → Питание),
// либо схема «Высокая»/«Максимальная производительность»
const WIN_PERF = ['ded574b5-45a0-4f42-8737-46345c09c238', '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', 'e9a42b02-d5df-448d-aa00-03f14749eb61'];
function cpuModeWindows() {
  const reg = (key, v) => ((sh('reg', ['query', key, '/v', v], { ok: true }) || '').match(/REG_\w+\s+(.+)$/m) || [])[1]?.trim() || '';
  const pk = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Power\\User\\PowerSchemes';
  const scheme = reg(pk, 'ActivePowerScheme'), overlay = reg(pk, 'ActiveOverlayAcPowerScheme');
  const perf = WIN_PERF.includes(overlay.toLowerCase()) || WIN_PERF.includes(scheme.toLowerCase());
  return { host: 'local', governor: perf ? 'performance' : 'balanced', epp: null, scheme, overlay: overlay || null,
    cpu: reg('HKLM\\HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0', 'ProcessorNameString') };
}
function cpuMode(h = THIS_HOST) {
  if (!THIS_HOST && process.platform === 'win32') return cpuModeWindows();
  const cmd = 'cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor /sys/devices/system/cpu/cpu0/cpufreq/energy_performance_preference 2>/dev/null | tr "\\n" " "; echo; grep -m1 "model name" /proc/cpuinfo | cut -d: -f2';
  const out = !THIS_HOST || h === THIS_HOST ? sh('sh', ['-c', cmd], { ok: true }) : sh('ssh', [h, cmd], { ok: true });
  if (!out) return null;
  const [modes, model] = out.split('\n');
  const [governor, epp] = modes.trim().split(/\s+/);
  return { host: h || 'local', governor: governor || null, epp: epp || null, cpu: (model || '').trim() };
}

// поднять остановленный SS (ss3 для прогонов с двумя провайдерами) и дождаться ответа через него. После старта
// контейнера токен закрыт, а после простоя ещё и OCSP-ответы просрочены — то же, что делает up.js
async function ensureProvider(c, provider, timeoutS = 600) {
  if (running(c) && smoke(provider) === '200') return false;
  log(`${c}: starting for two-provider runs`);
  if (!running(c)) dctl(c, 'start');
  const t0 = Date.now();
  while (health(c) !== 'healthy') { if (Date.now() - t0 > timeoutS * 1000) throw new Error(`${c} not healthy`); await sleep(10000); }
  hurl('token-login.hurl', { ss_host: c }, { retry: 3, ok: true, quiet: true });
  for (let i = 0; i < 18; i++) { if (smoke(provider) === '200') return true; await sleep(10000); }
  log(`${c}: no answer after token login — restarting xroad-signer, xroad-proxy (stale OCSP)`);
  dexec(c, 'supervisorctl', 'restart', 'xroad-signer', 'xroad-proxy');
  for (let i = 0; i < 30; i++) { if (smoke(provider) === '200') return true; await sleep(10000); }
  throw new Error(`${c}: X-Road via ${provider} not answering: ${JSON.stringify(smokeErr(provider))}`);
}

// сообщения в messagelog без метки времени (пакетное проставление ещё не дошло до них)
function unstamped(c) {
  return Number(psql(c, 'messagelog', `select count(*) from ${pgTable(c, 'messagelog', 'logrecord')} where discriminator='m' and timestamprecord is null`));
}

// дождаться, пока пакетное проставление меток закроет все сообщения прогона (до чистки messagelog).
// timeStampingIntervalSeconds по умолчанию 60 → обычно ≤ 1–2 интервала. Вернёт по SS: сколько было и за сколько дождались.
async function waitStamped(containers = MEASURED_SS, timeoutS = 300) {
  const t0 = Date.now();
  const res = Object.fromEntries(containers.map((c) => [c, { unstamped_after_run: unstamped(c), unstamped_final: null }]));
  for (;;) {
    for (const c of containers) res[c].unstamped_final = unstamped(c);
    const done = containers.every((c) => res[c].unstamped_final === 0);
    const waited = (Date.now() - t0) / 1000;
    if (done || waited > timeoutS) return { completed: done, wait_s: Math.round(waited), ...res };
    await sleep(5000);
  }
}

// размер БД messagelog, байты
function messagelogBytes(c) {
  return Number(psql(c, 'messagelog', `select pg_database_size('messagelog')`, { ok: true }) || 0);
}

// обращения к testca за интервал по доп. access-логу nginx (формат: "<port> <ip> [iso] \"REQ\" status bytes rt")
function caCalls(sinceIso, untilIso) {
  const r = spawnSync('docker', [...ctx('ca'), 'logs', '--since', sinceIso, '--until', untilIso, 'ca'], { encoding: 'utf8' });
  const all = (r.stdout || '') + '\n' + (r.stderr || '');
  let ocsp = 0, tsa = 0, sign = 0, ocsp_rt = [], tsa_rt = [];
  for (const line of all.split('\n')) {
    const m = /^(8888|8899) \S+ \[[^\]]+\] "(\w+) ([^ ]+) [^"]*" (\d+) (\d+) ([\d.]+)/.exec(line);
    if (!m || m[2] !== 'POST') continue;
    const rt = Number(m[6]);
    if (m[1] === '8899') { tsa++; tsa_rt.push(rt); }
    else if (m[3].startsWith('/testca/sign')) sign++;
    else { ocsp++; ocsp_rt.push(rt); }
  }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  return { ocsp, tsa, sign, ocsp_rt_mean_s: mean(ocsp_rt), tsa_rt_mean_s: mean(tsa_rt) };
}

function imageDigests() {
  const out = docker('images', '--digests', '--format', '{{.Repository}}:{{.Tag}} {{.Digest}}');
  return out.split('\n').filter((l) => /xroad|testca|k6|stand-is-provider|echo/.test(l));
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }

module.exports = {
  STAND, NET, NETARGS, CLIENT, PROVIDERS, MEASURED_SS, ENV, THIS_HOST, HOSTS, hostOf, ctx, hostCtx, shq,
  setLogFile, tee, sh, shCode, docker, dctl, dexec, dexecOk, compose, composeOn, health, running, statsTargets, sleep, log, smoke, smokeErr, smokeDirect, tsaProbe, ensureTsa, waitSmoke, restartProxy,
  iniSet, iniDel, iniDump, hurl, psql, pgSchema, pgTable, csParamSet, csParamDel, csParamDump,
  netBytes, linkBytes, ensureProvider, cpuMode, unstamped, waitStamped, messagelogBytes, caCalls, imageDigests, readJson, writeJson,
};

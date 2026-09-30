// Общие помощники: docker, ожидания, конфигурации. Без зависимостей, Node >= 18.
'use strict';
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const STAND = path.resolve(__dirname, '..');
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
    const shown = args.map((a) => a.replace(/^(admin_password|token_pin)=.*/, '$1=***'));   // не светить секреты в run.log
    throw new Error(`${cmd} ${shown.join(' ')} → exit ${r.status}\n${r.stderr || ''}`);
  }
  return (r.stdout || '').trim();
}
const docker = (...args) => sh('docker', args);
const dexec = (c, ...args) => docker('exec', c, ...args);
const dexecOk = (c, ...args) => sh('docker', ['exec', c, ...args], { ok: true });
// код возврата, без исключений
const shCode = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...opts }).status;
// docker compose из каталога стенда, вывод в консоль
const compose = (...args) => sh('docker', ['compose', ...args], { cwd: STAND, inherit: true });
// статус healthcheck контейнера: healthy | starting | unhealthy | none | missing
function health(c) {
  const r = spawnSync('docker', ['inspect', '-f', '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}', c], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'missing';
}
// контейнер запущен (остановленный ss3 — нормально во время сетки)
const running = (c) => spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', c], { encoding: 'utf8' }).stdout.trim() === 'true';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => { const line = `${new Date().toISOString().slice(11, 19)} ${a.join(' ')}`; console.log(line); tee(line); };

// один запрос через X-Road из контейнера curl; вернёт HTTP-код строкой
function smoke(provider = PROVIDERS.ss2) {
  return sh('docker', ['run', '--rm', '--network', NET, 'curlimages/curl', '-s', '-o', '/dev/null', '-m', '20',
    '-w', '%{http_code}', '-H', `X-Road-Client: ${CLIENT}`,
    `http://ss1:8080/r1/${provider}/echo?size=16`], { ok: true });
}
// то же, но с телом ответа (первые 300 символов) — чтобы видеть текст ошибки X-Road при не-200
function smokeErr(provider = PROVIDERS.ss2) {
  const out = sh('docker', ['run', '--rm', '--network', NET, 'curlimages/curl', '-s', '-m', '20',
    '-w', '\\n%{http_code}', '-H', `X-Road-Client: ${CLIENT}`,
    `http://ss1:8080/r1/${provider}/echo?size=16`], { ok: true });
  const i = out.lastIndexOf('\n');
  return { code: out.slice(i + 1), body: out.slice(0, i).replace(/\s+/g, ' ').slice(0, 300) };
}
// настоящий запрос метки времени к testca (запрос делает openssl на ss1): "200" = TSA жив
function tsaProbe() {
  const q = dexecOk('ss1', 'sh', '-c', 'openssl ts -query -data /etc/hostname -sha256 | base64 -w0');
  if (!q) return 'noquery';
  return sh('docker', ['run', '--rm', '--network', NET, 'curlimages/curl', 'sh', '-c',
    `echo ${q} | base64 -d > /tmp/q && curl -s -m 10 -o /dev/null -w '%{http_code}' -H 'Content-Type: application/timestamp-query' --data-binary @/tmp/q http://ca:8899/`], { ok: true });
}
// TSA не отвечает → перезапустить контейнер ca и дождаться ответа; вернёт true, если пришлось перезапускать
async function ensureTsa() {
  if (tsaProbe() === '200') return false;
  log('TSA not answering — docker compose restart ca');
  compose('restart', 'ca');
  for (let i = 0; i < 20; i++) { await sleep(3000); if (tsaProbe() === '200') return true; }
  throw new Error('TSA still not answering after restart of ca');
}
// прямой запрос к эхо-сервису мимо X-Road: "<код> <байт>"
function smokeDirect(size = 16) {
  return sh('docker', ['run', '--rm', '--network', NET, 'curlimages/curl', '-s', '-o', '/dev/null', '-m', '10',
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
  const file = path.join(STAND, '.env');
  if (!fs.existsSync(file)) throw new Error(`${file} not found — copy .env.example to .env and fill it in`);
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return { admin_user: env.XROAD_ADMIN_USER, admin_password: env.XROAD_ADMIN_PASSWORD, token_pin: env.XROAD_TOKEN_PIN };
}

// hurl-файл против стенда (для API SS/CS)
function hurl(file, vars = {}, opts = {}) {
  const args = ['compose', 'run', '--rm', '--no-deps', 'hurl', '--insecure', '--variables-file', '/hurl-src/vars.env',
    '--file-root', '/hurl-files', '--retry', String(opts.retry ?? 10), '--retry-interval', String(opts.interval ?? 5000), '--test'];
  for (const [k, v] of Object.entries({ ...secrets(), ...vars })) args.push('--variable', `${k}=${v}`);
  args.push(`/hurl-src/${file}`);
  if (opts.ok) return sh('docker', args, { cwd: STAND, inherit: !opts.quiet, ok: true }) !== null && lastStatus === 0;
  sh('docker', args, { cwd: STAND, inherit: true });
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
  if (shCode('docker', ['image', 'inspect', 'stand-netcount']) !== 0) {
    sh('docker', ['compose', '--profile', 'tools', 'build', 'netcount'], { cwd: STAND, inherit: true });
  }
  const ip = dexec(from, 'getent', 'hosts', to).split(/\s+/)[0];
  const ensure = LINK_RULES.map((r) => {
    const [chain, ...rest] = r;
    const spec = [...rest.slice(0, -1).map((x) => (x === 'IP' ? ip : x)), '-m', 'comment', '--comment', r[r.length - 1]].join(' ');
    return `iptables -C ${chain} ${spec} 2>/dev/null || iptables -A ${chain} ${spec}`;
  }).join('; ');
  const out = sh('docker', ['run', '--rm', '--net', `container:${from}`, '--cap-add', 'NET_ADMIN', 'stand-netcount', 'sh', '-c',
    `${ensure}; iptables -L INPUT -v -x -n; iptables -L OUTPUT -v -x -n`]);
  const res = {};
  for (const line of out.split('\n')) {
    const m = /^\s*\d+\s+(\d+)\s.*\/\* (\w+) \*\//.exec(line);
    if (m) res[m[2]] = Number(m[1]);
  }
  return res;
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
  const r = spawnSync('docker', ['logs', '--since', sinceIso, '--until', untilIso, 'ca'], { encoding: 'utf8' });
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
  STAND, NET, CLIENT, PROVIDERS, MEASURED_SS,
  setLogFile, tee, sh, shCode, docker, dexec, dexecOk, compose, health, running, sleep, log, smoke, smokeErr, smokeDirect, tsaProbe, ensureTsa, waitSmoke, restartProxy,
  iniSet, iniDel, iniDump, hurl, psql, pgSchema, pgTable, csParamSet, csParamDel, csParamDump,
  netBytes, linkBytes, unstamped, waitStamped, messagelogBytes, caCalls, imageDigests, readJson, writeJson,
};

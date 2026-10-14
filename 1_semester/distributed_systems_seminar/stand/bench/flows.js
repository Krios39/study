#!/usr/bin/env node
// Пилот к WAN-сетке: запись обменов ss1 ↔ ss2 и разбор по запросам — какое соединение (новое TCP + полное TLS,
// новое TCP + возобновлённая TLS-сессия, переиспользованное), сколько раз одна сторона ждёт другую, фактический RTT.
// На каждую пару конфигурация × RTT: netem → 30 запросов прогрева → tcpdump в namespace ss1 (весь трафик с ss2,
// не только 5500 — видно и OCSP между SS) → N последовательных запросов curl из namespace ss1 (клиент ss1 по lo,
// в запись не попадает) → разбор tshark. Запускать на машине с ss1 (на трёх машинах — l2).
//   node bench/flows.js                                   # full,reuse × RTT 0,20 × 20 запросов по 10 КБ
//   node bench/flows.js --rtt 0,5,20,50 --n 30 --size 10240 --configs full,reuse --out results/flows-X
// Результат: <out>/<config>_rtt<R>.pcap (заголовки, snaplen 256), flows.json, flows.md (сводка + хронология
// медианного запроса с паузами). В конце задержка снимается, конфигурация возвращается к full.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const L = require('./lib');
const { apply: applyConfig } = require('./config');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const RTTS = opt('--rtt', '0,20').split(',').map(Number);
const CONFIGS = opt('--configs', 'full,reuse').split(',');
const N = Number(opt('--n', '20'));
const SIZE = Number(opt('--size', '10240'));
const OUT = path.resolve(opt('--out', path.join(L.STAND, 'results', `flows-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`)));
if (L.THIS_HOST && L.hostOf('ss1') !== L.THIS_HOST) { console.error('run on the ss1 host'); process.exit(2); }

const URL = `http://127.0.0.1:8080/r1/${L.PROVIDERS.ss2}/echo?size=${SIZE}&fill=random`;
const curlLoop = (n) => ['run', '--rm', '--net', 'container:ss1', 'curlimages/curl', 'sh', '-c',
  `for i in $(seq 1 ${n}); do curl -s -o /dev/null -w '%{time_total}\\n' -H 'X-Road-Client: ${L.CLIENT}' '${URL}'; done`];

// ---------- разбор pcap ----------
const FIELDS = ['frame.time_epoch', 'tcp.stream', 'ip.src', 'tcp.srcport', 'tcp.dstport', 'tcp.len', 'tcp.flags.syn', 'tcp.flags.ack',
  'tcp.flags.fin', 'tls.handshake.type', 'tls.record.content_type'];
function packets(pcapName, ss1ip) {
  const out = L.sh('docker', ['run', '--rm', '-v', `${OUT}:/cap`, 'stand-netcount', 'tshark', '-r', `/cap/${pcapName}`,
    '-d', 'tcp.port==5500,tls', '-d', 'tcp.port==5577,tls', '-T', 'fields', '-E', 'separator=|', ...FIELDS.flatMap((f) => ['-e', f])]);
  return out.split('\n').filter(Boolean).map((l) => {
    const [t, stream, src, sport, dport, len, syn, ack, fin, hs, ct] = l.split('|');
    return { t: Number(t) * 1000, stream: Number(stream), dir: src === ss1ip ? 'C' : 'S', port: src === ss1ip ? Number(dport) : Number(sport),
      len: Number(len) || 0, syn: syn === '1' || syn === 'True', ack: ack === '1' || ack === 'True', fin: fin === '1' || fin === 'True',
      hs: hs ? hs.split(',').map(Number) : [], ct: ct ? ct.split(',').map(Number) : [] };
  });
}
// запрос начинается с SYN клиента (новое соединение) или с данных клиента после того, как сервер уже отдал данные ответа
function splitRequests(pk) {
  const reqs = [];
  let cur = null;
  for (const p of pk.filter((x) => x.port === 5500)) {
    // новые данные приложения от ss1 после данных ответа и паузы > 3 мс (запросы curl идут с паузой на запуск процесса);
    // хвост запроса, задержанный Nagle до прихода ответа (34 Б конца chunked), close_notify, ACK и рукопожатие запрос не начинают
    const idle = cur ? p.t - cur.pk[cur.pk.length - 1].t : Infinity;
    const startNew = (p.dir === 'C' && p.syn && !p.ack) || (p.dir === 'C' && p.ct.includes(23) && cur && cur.serverData && idle > 3);
    if (startNew || !cur) { cur = { pk: [], serverData: false }; reqs.push(cur); }
    cur.pk.push(p);
    if (p.dir === 'S' && p.ct.includes(23)) cur.serverData = true;
  }
  return reqs;
}
const med = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); const k = b.length; return k % 2 ? b[(k - 1) / 2] : (b[k / 2 - 1] + b[k / 2]) / 2; };
function label(p) {
  const what = p.syn ? (p.ack ? 'SYN-ACK' : 'SYN') : p.fin ? 'FIN' : p.hs.includes(1) ? 'ClientHello' : p.hs.length ? `TLS hs ${p.hs.join('+')}`
    : p.ct.includes(20) ? 'ChangeCipherSpec' : p.ct.includes(22) ? 'Finished (enc.)' : p.ct.includes(23) ? 'data' : p.len ? 'data (cont.)' : 'ACK';
  return `${p.dir === 'C' ? 'ss1 →' : '← ss2'} ${what}${p.len ? ` ${p.len} B` : ''}`;
}
// паузы: промежуток между соседними пакетами запроса ≥ max(0.4·RTT, 1 мс) — одна сторона ждала другую
function analyse(req, rtt) {
  const pk = req.pk;
  const t0 = pk[0].t;
  const last = [...pk].reverse().find((p) => p.len > 0 && p.dir === 'S') || pk[pk.length - 1];
  const synP = pk.find((p) => p.syn && !p.ack && p.dir === 'C'), synAck = pk.find((p) => p.syn && p.ack && p.dir === 'S');
  const hs = new Set(pk.flatMap((p) => p.hs));
  const conn = synP ? (hs.has(11) ? 'new TCP + full TLS' : hs.has(1) ? 'new TCP + resumed TLS' : 'new TCP, no TLS') : 'reused connection';
  const thr = Math.max(0.4 * rtt, 1);
  const gaps = [];
  for (let i = 1; i < pk.length && pk[i - 1] !== last; i++) {
    const g = pk[i].t - pk[i - 1].t;
    if (g >= thr) gaps.push({ ms: g, after: label(pk[i - 1]), before: label(pk[i]) });
  }
  return { conn, total_ms: last.t - t0, syn_rtt_ms: synP && synAck ? synAck.t - synP.t : null, gaps, timeline: pk.slice(0, pk.indexOf(last) + 1).map((p) => ({ ms: p.t - t0, what: label(p) })) };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  L.setLogFile(path.join(OUT, 'run.log'));
  const ss1ip = L.dexec('ss1', 'getent', 'hosts', 'ss1').split(/\s+/)[0];
  const ss2ip = L.dexec('ss1', 'getent', 'hosts', 'ss2').split(/\s+/)[0];
  L.log(`flows → ${OUT}; ss1 ${ss1ip}, ss2 ${ss2ip}; configs ${CONFIGS}, RTT ${RTTS}, n ${N}, size ${SIZE}`);
  const result = { size: SIZE, n: N, ss1: ss1ip, ss2: ss2ip, cases: [] };
  try {
    for (const config of CONFIGS) {
      await applyConfig(config);
      for (const rtt of RTTS) {
        const netem = L.netem(rtt);
        L.sh('docker', curlLoop(30));                                   // прогрев: пул соединений, кеши, JIT
        const name = `${config}_rtt${rtt}.pcap`;
        L.sh('docker', ['rm', '-f', 'flowcap'], { ok: true });
        L.sh('docker', ['run', '-d', '--name', 'flowcap', '--net', 'container:ss1', '--cap-add', 'NET_ADMIN', '--cap-add', 'NET_RAW',
          '-v', `${OUT}:/cap`, 'stand-netcount', 'tcpdump', '-i', 'any', '-s', '256', '-U', '-w', `/cap/${name}`, `host ${ss2ip}`]);
        await L.sleep(2000);
        // RTT потока по ядру (minrtt сокетов ss1 → ss2:5500) — параллельно с запросами. RTT по записи не годится:
        // tcpdump в ss1 видит свои исходящие пакеты уже после очереди netem, т. е. со сдвигом на RTT/2
        const [pc, pa] = L.flowRttCmd('ss1', 'ss2', { samples: 4, afterS: 1 });
        const probe = new Promise((res) => { const p = spawn(pc, pa); let o = ''; p.stdout.on('data', (d) => { o += d; }); p.on('close', () => res(o)); });
        const times = L.sh('docker', curlLoop(N)).split('\n').filter(Boolean).map((x) => Number(x) * 1000);
        const kernelRtt = L.parseFlowRtt(await probe);
        await L.sleep(1500);
        L.sh('docker', ['stop', '-t', '2', 'flowcap'], { ok: true });
        L.sh('docker', ['rm', '-f', 'flowcap'], { ok: true });
        const pk = packets(name, ss1ip);
        const reqs = splitRequests(pk).map((r) => analyse(r, rtt));
        const otherPorts = [...new Set(pk.filter((p) => p.port !== 5500).map((p) => p.port))];
        const flowRtt = med(reqs.map((r) => r.syn_rtt_ms).filter((x) => x != null));
        const c = {
          config, rtt, netem, requests: reqs.length, curl_ms_median: med(times),
          total_ms_median: med(reqs.map((r) => r.total_ms)), syn_rtt_ms_median: flowRtt, flow_rtt: kernelRtt,
          conn: reqs.reduce((a, r) => { a[r.conn] = (a[r.conn] || 0) + 1; return a; }, {}),
          gaps_median: med(reqs.map((r) => r.gaps.length)),
          gap_ms_sum_median: med(reqs.map((r) => r.gaps.reduce((s, g) => s + g.ms, 0))),
          other_ports: otherPorts,
          example: reqs.slice().sort((a, b) => a.total_ms - b.total_ms)[Math.floor(reqs.length / 2)],
        };
        result.cases.push(c);
        L.log(`${config} rtt ${rtt}: ${reqs.length} requests, ${JSON.stringify(c.conn)}, flow srtt ${c.flow_rtt.srtt_ms ?? '—'} ms, `
          + `total ${c.total_ms_median?.toFixed(1)} ms, waits ${c.gaps_median}, other ports ${otherPorts.join(',') || '—'}`);
      }
    }
  } finally {
    L.netem(0);
    await applyConfig('full');
    L.sh('docker', ['rm', '-f', 'flowcap'], { ok: true });
  }
  L.writeJson(path.join(OUT, 'flows.json'), result);

  // ---------- flows.md ----------
  const f = (v, d = 1) => (v == null ? '—' : v.toFixed(d));
  let md = `# Обмены ss1 ↔ ss2: ${CONFIGS.join(', ')} × RTT ${RTTS.join(' / ')} мс, ${N} запросов по ${SIZE} Б\n\n`
    + `| config | RTT задан | RTT потока (ядро) | соединения | запрос по записи, мс | curl, мс | паузы ≥0.4·RTT | сумма пауз, мс | др. порты |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const c of result.cases) {
    md += `| ${c.config} | ${c.rtt} | ${f(c.flow_rtt.srtt_ms, 2)} (min ${f(c.flow_rtt.minrtt_ms, 2)}) | ${Object.entries(c.conn).map(([k, v]) => `${k}: ${v}`).join(', ')} | ${f(c.total_ms_median)} | ${f(c.curl_ms_median)} | ${c.gaps_median} | ${f(c.gap_ms_sum_median)} | ${c.other_ports.join(', ') || '—'} |\n`;
  }
  md += '\nRTT потока — сглаженный rtt сокетов ss1 → ss2:5500 по ядру (ss -tin) во время запросов, в скобках minrtt (у соединений пула — минимум с момента открытия, в т. ч. до смены задержки). В хронологии исходящие пакеты ss1 видны уже после очереди netem (сдвиг на RTT/2), входящие — по приходу. '
    + 'Запрос по записи — от первого пакета запроса до последних данных ответа на канале ss1 ↔ ss2. Пауза — промежуток между соседними пакетами запроса не меньше max(0.4·RTT, 1 мс).\n';
  for (const c of result.cases) {
    md += `\n## ${c.config}, RTT ${c.rtt} мс — медианный запрос (${c.example.conn}, ${f(c.example.total_ms)} мс)\n\nПаузы:\n`;
    md += c.example.gaps.length ? c.example.gaps.map((g) => `- ${f(g.ms)} мс: после «${g.after}» до «${g.before}»`).join('\n') + '\n' : '- нет\n';
    md += '\n```\n' + c.example.timeline.map((x) => `${x.ms.toFixed(2).padStart(8)}  ${x.what}`).join('\n') + '\n```\n';
  }
  fs.writeFileSync(path.join(OUT, 'flows.md'), md);
  console.log(md.split('\n## ')[0]);
  L.log(`→ ${path.join(OUT, 'flows.md')}`);
})().catch((e) => { L.log('ERROR', e.stack || e.message); try { L.netem(0); } catch { /* */ } process.exit(1); });

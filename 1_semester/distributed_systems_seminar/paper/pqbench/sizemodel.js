#!/usr/bin/env node
// Size model: how much the signature-dependent parts of an X-Road message grow with ML-DSA.
// Measured base (testbed, messagelog of ss1, see sigparts.js): signature XML 7969 B (request) and 8002 B (response),
// containing SignatureValue (RSA-2048, 256 B), the signing certificate (1097 B DER: RSA-2048 key, signed by
// the RSA-4096 test CA) and the OCSP response for it (2052 B DER: RSA-4096 OCSP signature and the responder
// certificate with an RSA-4096 key, signed by the CA). The request also carries the OCSP response for the
// authentication certificate as a raw MIME part (assumed the same 2052 B: one certificate in the chain).
'use strict';

// encoded sizes from pqbench/results/2026-11-17-21-23/sizes.csv (variable-length signatures: maximum of 100);
// RSA-4096 as in the testbed certificates
const SCHEME = {
  'RSA-2048': { spki: 294, sig: 256 },
  'RSA-4096': { spki: 550, sig: 512 },
  'ECDSA-P256': { spki: 91, sig: 72 },
  'ECDSA-P384': { spki: 120, sig: 104 },
  'ML-DSA-44': { spki: 1334, sig: 2420 },
  'ML-DSA-65': { spki: 1974, sig: 3309 },
  'ML-DSA-87': { spki: 2614, sig: 4627 },
  'FALCON-512': { spki: 915, sig: 662 },
  'FALCON-1024': { spki: 1811, sig: 1277 },
  'SLH-DSA-128S': { spki: 50, sig: 7856 },
  'SLH-DSA-128F': { spki: 50, sig: 17088 },
  'SLH-DSA-256S': { spki: 82, sig: 29792 },
  'MLDSA44-RSA2048': { spki: 1603, sig: 2676 },
  'MLDSA44-P256': { spki: 1398, sig: 2492 },
  'MLDSA65-RSA3072': { spki: 2371, sig: 3693 },
  'MLDSA65-P256': { spki: 2038, sig: 3381 },
  'MLDSA87-RSA4096': { spki: 3139, sig: 5139 },
  'MLDSA87-P384': { spki: 2710, sig: 4731 },
};
// base64 with a &#13; entity and a line feed every 76 characters, as in the stored signatures
const B64 = (4 / 3) * (1 + 6 / 76);

const BASE = { reqSigXml: 7969, respSigXml: 8002, ocspPart: 2052 };

function delta(member, infra) {
  const m0 = SCHEME['RSA-2048'], i0 = SCHEME['RSA-4096'];
  const m = SCHEME[member], i = SCHEME[infra];
  // DER growth of each embedded object
  const sigValue = m.sig - m0.sig;
  const signCert = (m.spki - m0.spki) + (i.sig - i0.sig);          // member key + CA signature
  const ocsp = (i.sig - i0.sig) + (i.spki - i0.spki) + (i.sig - i0.sig); // OCSP signature + responder key + CA signature on responder cert
  const inXml = Math.round((sigValue + signCert + ocsp) * B64);
  return { sigXml: inXml, ocspPart: ocsp };
}

const rows = [];
function add(scenario, member, infra) {
  const d = delta(member, infra);
  rows.push({
    scenario, member, infra,
    request_extra: d.sigXml + d.ocspPart,
    response_extra: d.sigXml,
    request_sig_parts: BASE.reqSigXml + BASE.ocspPart + d.sigXml + d.ocspPart,
    response_sig_parts: BASE.respSigXml + d.sigXml,
  });
}
// A: only member keys change (CA and OCSP stay RSA-4096); B: members, CA and OCSP use the same scheme
const MEMBERS = ['ECDSA-P256', 'ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87', 'FALCON-512', 'FALCON-1024',
  'MLDSA44-RSA2048', 'MLDSA44-P256', 'MLDSA65-RSA3072', 'MLDSA65-P256', 'MLDSA87-RSA4096', 'MLDSA87-P384'];
for (const m of MEMBERS) { add('member keys only', m, 'RSA-4096'); add('members+CA+OCSP', m, m); }
// C: SLH-DSA only for CA and OCSP (signing takes 0.03-1.1 s, too slow per message), members on ML-DSA
for (const infra of ['SLH-DSA-128S', 'SLH-DSA-128F', 'SLH-DSA-256S']) {
  for (const m of ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87']) add('members ML-DSA + CA/OCSP SLH-DSA', m, infra);
}
// D: only the CA and the OCSP responder change, members stay on RSA-2048
for (const infra of [...MEMBERS, 'SLH-DSA-128S', 'SLH-DSA-128F', 'SLH-DSA-256S']) add('CA+OCSP only', 'RSA-2048', infra);
// ---------- round trips: count TCP flights (packets), not bytes ----------
// From the captures paper/stand-results/flows-pq (full, new TCP + resumed TLS, RTT 50 ms), MSS 1448 B, initial window 10 segments:
// - request ss1 -> ss2, TLS bytes on the wire: 12562 B at base (1-byte body); the first flight after the handshake
//   carried at most 8 full segments plus ChangeCipherSpec (base: 11584 B, the 978 B tail waited for an ACK), then 20 segments;
// - response ss2 -> ss1: the first flight is ~1 KB of small TLS records (MIME start, chunk delimiters), one packet each,
//   which takes the whole initial window; the rest (20700 B at base with a 10 KB body) follows in flights of 20 and 40 segments.
// The grid (paper/grids/matrix-pq.json) emulates the growth by padding: request body = request_extra, response body = 10 KB + response_extra.
const MSS = 1448;
const WIRE = { req: 12562, respBody: 20700 };
// From flight 4 on, the request is limited by the receive window of ss2, not by cwnd (flows-pq/C256S, 19.11: flight 4
// ends exactly at the advertised right edge, ~95 KB window, 36 segments; flight 5 had 41 segments to the edge).
// Receive-window autotuning depends on the receiver and the RTT, so 36/41 hold for this testbed; beyond 5 flights untested.
const REQ_FLIGHTS = [8, 20, 40, 36, 41];             // segments per flight
const RESP_BODY_FLIGHTS = [20, 40, 80, 160];
function flights(bytes, caps) {
  let left = bytes, n = 0;
  for (const c of caps) { n++; left -= c * MSS; if (left <= 0) return n; }
  return n + 1;
}
const reqFl = (extra) => flights(WIRE.req + extra, REQ_FLIGHTS);
const respFl = (extra) => 1 + flights(WIRE.respBody + extra, RESP_BODY_FLIGHTS);
const base = reqFl(0) + respFl(0);
for (const r of rows) {
  r.request_flights = reqFl(r.request_extra);
  r.response_flights = respFl(r.response_extra);
  r.extra_round_trips_full = r.request_flights + r.response_flights - base;
  r.extra_round_trips_reuse = 0;               // window already open on a pooled connection (grid: no step in any scenario)
  // the grids (matrix-pq.json, matrix-pq-large*.json) checked the model up to the C ML-DSA-65 + SLH-DSA-256s point: 190594 B extra in the request, 132502 B in the response
  r.within_checked_range = r.request_extra <= 190594 && r.response_extra <= 132502;
}

console.log(Object.keys(rows[0]).join(','));
for (const r of rows) console.log(Object.values(r).join(','));

// optional check against the grid: node sizemodel.js ../stand-results/pq-sizes/slopes.csv [more slopes.csv of the same RTT ...]
// grid points are matched by size/req (response = 10 KB + response_extra, request body = request_extra)
if (process.argv[2]) {
  const fs = require('fs');
  const t50 = {};
  for (const f of process.argv.slice(2)) {
    for (const l of fs.readFileSync(f, 'utf8').trim().split('\n').slice(1)) {
      const [config, , size, req, , , p50, , , rtt] = l.split(',');
      t50[`${config}|${size}/${req}`] = Number(p50);
      t50.rtt = Number(rtt || 50);   // old slopes.csv (pq-sizes) has no rtt column: 50 ms
    }
  }
  console.error('\nconfig,scenario,member,infra,measured_ms_vs_base_post,measured_rtt,predicted_rtt');
  for (const config of ['full', 'reuse']) {
    for (const r of rows) {
      const m = t50[`${config}|${10240 + r.response_extra}/${r.request_extra}`];
      if (m === undefined) continue;
      const d = m - t50[`${config}|10240/1`];
      const pred = config === 'full' ? r.extra_round_trips_full : r.extra_round_trips_reuse;
      console.error([config, r.scenario, r.member, r.infra, d.toFixed(1), (d / t50.rtt).toFixed(2), pred].join(','));
    }
  }
}

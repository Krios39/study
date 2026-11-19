#!/usr/bin/env node
// Signature computation per message on the critical path (1 synchronous SOAP request), per scenario of sizemodel.js.
// Operation counts from the X-Road 7.8.3 source:
// - ss1 signs the request, ss2 signs the response (member key): 2 sign;
// - ss2 verifies the request signature, ss1 the response signature (SignatureVerifier.verifySignatureValue): 2 verify, member key;
// - certificate chains, PKIX build+validate on every message, no cache (CertChainVerifier.verifyImpl), one CA signature each:
//   signing cert of the request (ss2) and of the response (ss1), ss1 auth cert at ss2 (ServerMessageProcessor.verifySslClientCert,
//   every message), ss2 auth cert at ss1 (AuthTrustVerifier, only when a new connection is opened: full yes, reuse no);
// - OCSP responses: signature and responder certificate are verified once per 60 s (OcspVerifier.RESPONSE_VALIDITY_CACHE,
//   proxy.ocsp-verifier-cache-period, max 180 s) — off the per-message cost; OCSP and CA signing are off the message path.
// Assumes the auth certificates use the member scheme and are issued by the same CA as the signing certificates.
// Usage: node compute.js results/2026-11-17-21-23/jmh.csv results/2026-11-19-18-47-rsa4096/jmh.csv > results/compute.csv
'use strict';
const fs = require('fs');

const t = {};   // `${sign|verify}|${alg}` -> us
for (const file of process.argv.slice(2)) {
  for (const l of fs.readFileSync(file, 'utf8').trim().split('\n').slice(1)) {
    const c = l.split(',').map((x) => x.replace(/"/g, ''));
    const m = c[0].match(/(?:Slow)?SignBench\.(sign|verify)$/);
    if (m) t[`${m[1]}|${c[7]}`] = Number(c[4]);
  }
}

const BENCH = {
  'RSA-2048': 'RSA-2048-SHA512-BC', 'RSA-4096': 'RSA-4096-SHA512-BC', 'ECDSA-P256': 'ECDSA-P256-SHA512-BC',
  'ML-DSA-44': 'ML-DSA-44-BC', 'ML-DSA-65': 'ML-DSA-65-BC', 'ML-DSA-87': 'ML-DSA-87-BC',
  'FALCON-512': 'FALCON-512-BC', 'FALCON-1024': 'FALCON-1024-BC',
  'SLH-DSA-128S': 'SLH-DSA-SHA2-128S-BC', 'SLH-DSA-128F': 'SLH-DSA-SHA2-128F-BC', 'SLH-DSA-256S': 'SLH-DSA-SHA2-256S-BC',
  'MLDSA44-RSA2048': 'MLDSA44-RSA2048-PSS-SHA256-BC', 'MLDSA44-P256': 'MLDSA44-ECDSA-P256-SHA256-BC',
  'MLDSA65-RSA3072': 'MLDSA65-RSA3072-PSS-SHA512-BC', 'MLDSA65-P256': 'MLDSA65-ECDSA-P256-SHA512-BC',
  'MLDSA87-RSA4096': 'MLDSA87-RSA4096-PSS-SHA512-BC', 'MLDSA87-P384': 'MLDSA87-ECDSA-P384-SHA512-BC',
};
const get = (op, alg) => {
  const v = t[`${op}|${BENCH[alg]}`];
  if (v === undefined) throw new Error(`no ${op} for ${alg}`);
  return v;
};
const cost = (member, infra, chains) => 2 * get('sign', member) + 2 * get('verify', member) + chains * get('verify', infra);

const MEMBERS = ['ECDSA-P256', 'ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87', 'FALCON-512', 'FALCON-1024',
  'MLDSA44-RSA2048', 'MLDSA44-P256', 'MLDSA65-RSA3072', 'MLDSA65-P256', 'MLDSA87-RSA4096', 'MLDSA87-P384'];
const rows = [['base', 'RSA-2048', 'RSA-4096']];
for (const m of MEMBERS) rows.push(['member keys only', m, 'RSA-4096'], ['members+CA+OCSP', m, m]);
for (const i of ['SLH-DSA-128S', 'SLH-DSA-128F', 'SLH-DSA-256S']) {
  for (const m of ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87']) rows.push(['members ML-DSA + CA/OCSP SLH-DSA', m, i]);
}
// D: only the CA and the OCSP responder change, members stay on RSA-2048
for (const i of [...MEMBERS, 'SLH-DSA-128S', 'SLH-DSA-128F', 'SLH-DSA-256S']) rows.push(['CA+OCSP only', 'RSA-2048', i]);
const b = { full: cost('RSA-2048', 'RSA-4096', 4), reuse: cost('RSA-2048', 'RSA-4096', 3) };
console.log('scenario,member,infra,sign_us,verify_us,ca_verify_us,full_us,reuse_us,full_vs_base_us,reuse_vs_base_us');
for (const [s, m, i] of rows) {
  const full = cost(m, i, 4), reuse = cost(m, i, 3);
  console.log([s, m, i, get('sign', m).toFixed(0), get('verify', m).toFixed(0), get('verify', i).toFixed(0),
    full.toFixed(0), reuse.toFixed(0), (full - b.full).toFixed(0), (reuse - b.reuse).toFixed(0)].join(','));
}

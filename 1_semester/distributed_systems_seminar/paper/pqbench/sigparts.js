#!/usr/bin/env node
// Breaks an X-Road signature XML (from messagelog.logrecord.signature) into its parts, sizes in bytes.
// Usage: node sigparts.js <signature.xml> [...]
'use strict';
const fs = require('fs');
const crypto = require('crypto');

// base64 in the XML is wrapped with &#13; entities
const clean = (s) => s.replace(/&#13;|&#xD;/gi, '').replace(/\s+/g, '');
const b64len = (s) => Buffer.from(clean(s), 'base64').length;
const dump = process.env.DUMP;

for (const f of process.argv.slice(2)) {
  const x = fs.readFileSync(f, 'utf8');
  const parts = [];
  const each = (re, name, decode = true) => {
    for (const m of x.matchAll(re)) {
      const text = m[2] !== undefined ? m[2] : m[1];
      parts.push({ name, xml: m[0].length, der: decode ? b64len(text) : null, text });
    }
  };
  each(/<(?:\w+:)?SignatureValue[^>]*>([\s\S]*?)<\/(?:\w+:)?SignatureValue>/g, 'SignatureValue');
  each(/<(?:\w+:)?X509Certificate[^>]*>([\s\S]*?)<\/(?:\w+:)?X509Certificate>/g, 'X509Certificate');
  each(/<(?:\w+:)?EncapsulatedX509Certificate[^>]*>([\s\S]*?)<\/(?:\w+:)?EncapsulatedX509Certificate>/g, 'EncapsulatedX509Certificate');
  each(/<(?:\w+:)?EncapsulatedOCSPValue[^>]*>([\s\S]*?)<\/(?:\w+:)?EncapsulatedOCSPValue>/g, 'EncapsulatedOCSPValue');
  each(/<(?:\w+:)?EncapsulatedTimeStamp[^>]*>([\s\S]*?)<\/(?:\w+:)?EncapsulatedTimeStamp>/g, 'EncapsulatedTimeStamp');
  each(/<(?:\w+:)?DigestValue[^>]*>([\s\S]*?)<\/(?:\w+:)?DigestValue>/g, 'DigestValue');
  const si = x.match(/<(?:\w+:)?SignedInfo[\s\S]*?<\/(?:\w+:)?SignedInfo>/);
  const sp = x.match(/<(?:\w+:)?SignedProperties[\s\S]*?<\/(?:\w+:)?SignedProperties>/);
  const up = x.match(/<(?:\w+:)?UnsignedProperties[\s\S]*?<\/(?:\w+:)?UnsignedProperties>/);
  const algs = [...new Set([...x.matchAll(/Algorithm="([^"]+)"/g)].map((m) => m[1]))];
  const refs = [...x.matchAll(/<(?:\w+:)?Reference\b[^>]*>/g)].map((m) => (m[0].match(/URI="([^"]*)"/) || [])[1]);

  console.log(`== ${f}: ${x.length} bytes of XML`);
  console.log(`SignedInfo ${si ? si[0].length : 0}, SignedProperties ${sp ? sp[0].length : 0}, UnsignedProperties ${up ? up[0].length : 0}`);
  console.log(`references: ${refs.join(' | ')}`);
  console.log(`algorithms: ${algs.join(' | ')}`);
  const byName = {};
  for (const p of parts) {
    const k = p.name;
    byName[k] = byName[k] || { n: 0, xml: 0, der: 0 };
    byName[k].n++;
    byName[k].xml += p.xml;
    byName[k].der += p.der || 0;
  }
  for (const [k, v] of Object.entries(byName)) console.log(`${k}: ${v.n} item(s), ${v.xml} bytes in XML, ${v.der} bytes decoded`);
  // certificates: subject, key, signature algorithm
  if (dump) {
    parts.filter((q) => /Certificate$|OCSP/.test(q.name)).forEach((p, i) =>
      fs.writeFileSync(`${dump}/${require('path').basename(f, '.xml')}_${p.name}_${i}.der`, Buffer.from(clean(p.text), 'base64')));
  }
  for (const p of parts.filter((q) => /Certificate$/.test(q.name))) {
    try {
      const c = new crypto.X509Certificate(Buffer.from(clean(p.text), 'base64'));
      console.log(`  cert ${p.der} B: subject=${c.subject.replace(/\n/g, ', ')} issuer=${c.issuer.replace(/\n/g, ', ')} key=${c.publicKey.asymmetricKeyType}/${c.publicKey.asymmetricKeyDetails.modulusLength || c.publicKey.asymmetricKeyDetails.namedCurve}`);
    } catch (e) {
      console.log(`  cert ${p.der} B: not parsed (${e.message})`);
    }
  }
  const covered = parts.reduce((s, p) => s + p.xml, 0);
  console.log(`rest of the XML (structure, properties, digests' markup): ${x.length - covered}`);
}

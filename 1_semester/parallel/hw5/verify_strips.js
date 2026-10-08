const fs = require('fs');
const htmlPath = process.argv[2] || 'index.html', outJs = process.argv[3] || require('os').tmpdir() + '/extracted_script.js';
const html = fs.readFileSync(htmlPath, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
fs.writeFileSync(outJs, script);

const pure = script.match(/\/\/ <PURE>([\s\S]*?)\/\/ <\/PURE>/)[1];
const {makeInitialAB, gsKernel, stripBounds, makeStripJob} =
  new Function(pure + '; return {makeInitialAB, gsKernel, stripBounds, makeStripJob};')();

function refStep(a, b, W, H, f, k, da, db) {
  const a2 = new Float32Array(a.length), b2 = new Float32Array(b.length);
  const id = (x, y) => ((y + H) % H) * W + ((x + W) % W);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, A = a[i], B = b[i];
    const lapA = -A + 0.2*(a[id(x-1,y)]+a[id(x+1,y)]+a[id(x,y-1)]+a[id(x,y+1)]) + 0.05*(a[id(x-1,y-1)]+a[id(x+1,y-1)]+a[id(x-1,y+1)]+a[id(x+1,y+1)]);
    const lapB = -B + 0.2*(b[id(x-1,y)]+b[id(x+1,y)]+b[id(x,y-1)]+b[id(x,y+1)]) + 0.05*(b[id(x-1,y-1)]+b[id(x+1,y-1)]+b[id(x-1,y+1)]+b[id(x+1,y+1)]);
    const r = A*B*B, na = A+da*lapA-r+f*(1-A), nb = B+db*lapB+r-(k+f)*B;
    a2[i] = na<0?0:na>1?1:na; b2[i] = nb<0?0:nb>1?1:nb;
  }
  return [a2, b2];
}

const W = 64, H = 64, S = 10, rounds = 3, f = 0.0545, k = 0.062, da = 1, db = 0.5;
const init = makeInitialAB(W, H, 1);
let ra = init.a.slice(), rb = init.b.slice();
for (let s = 0; s < S * rounds; s++) [ra, rb] = refStep(ra, rb, W, H, f, k, da, db);

for (const n of [1, 3, 4, 7]) {
  const A = init.a.slice(), B = init.b.slice();
  for (let r = 0; r < rounds; r++) {
    const jobs = [];
    for (let i = 0; i < n; i++) { const [y0, y1] = stripBounds(H, n, i); jobs.push({y0, job: makeStripJob(A, B, W, H, y0, y1, S)}); }
    const outs = jobs.map(({y0, job}) => {
      const [oa, ob] = gsKernel(job.a, job.b, W, job.R, S, f, k, da, db);
      return {y0, a: oa.slice(S*W, (S+job.core)*W), b: ob.slice(S*W, (S+job.core)*W)};
    });
    for (const o of outs) { A.set(o.a, o.y0*W); B.set(o.b, o.y0*W); }
  }
  let md = 0; for (let i = 0; i < A.length; i++) md = Math.max(md, Math.abs(A[i]-ra[i]), Math.abs(B[i]-rb[i]));
  console.log('strips n=' + n + ': max |diff| vs periodic reference =', md);
}

{
  const W2 = 256, init2 = makeInitialAB(W2, W2, 1);
  let a = init2.a, b = init2.b;
  for (let c = 0; c < 30; c++) {
    const job = makeStripJob(a, b, W2, W2, 0, W2, 100);
    const [oa, ob] = gsKernel(job.a, job.b, W2, job.R, 100, 0.0545, 0.062, 1, 0.5);
    a = oa.slice(100*W2, 100*W2 + W2*W2); b = ob.slice(100*W2, 100*W2 + W2*W2);
  }
  let sum = 0, hi = 0; for (const v of b) { sum += v; if (v > 0.15) hi++; }
  console.log('coral after 3000 steps: mean B =', (sum/b.length).toFixed(4), ', cells with B>0.15:', (100*hi/b.length).toFixed(1) + '%');
}

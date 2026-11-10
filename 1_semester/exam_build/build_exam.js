const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const baseCss = fs.readFileSync(path.join(ROOT, 'parallel/styles.css'), 'utf8');

const COURSES = [
    { dir: 'parallel', out: 'parallel_exam.html', title: 'Parallel Computing (MTAT.08.020) — подготовка к экзамену', homeworks: true },
    { dir: 'concurrent', out: 'concurrent_exam.html', title: 'Concurrent Programming Languages (LTAT.06.022) — подготовка к экзамену', homeworks: false },
];

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function protectMath(md, store) {
    const parts = md.split(/(```[\s\S]*?```)/g);
    return parts.map((p, i) => {
        if (i % 2 === 1) return p;
        return p.split(/(`[^`\n]*`)/g).map((q, j) => {
            if (j % 2 === 1) return q;
            return q
                .replace(/\$\$([\s\S]+?)\$\$/g, m => { store.push(m); return `MATHPH${store.length - 1}X`; })
                .replace(/\$([^\$\n]+?)\$/g, m => { store.push(m); return `MATHPH${store.length - 1}X`; });
        }).join('');
    }).join('');
}

function render(md) {
    const store = [];
    let s = protectMath(md, store);
    s = s.replace(/<summary>([\s\S]*?)<\/summary>/g, (m, inner) => `<summary><span>${marked.parseInline(inner.trim())}</span></summary>`);
    let html = marked.parse(s);
    html = html.replace(/MATHPH(\d+)X/g, (m, n) => esc(store[+n]));
    return html;
}

function splitTitle(md) {
    const lines = md.replace(/\r/g, '').split('\n');
    const i = lines.findIndex(l => /^# /.test(l));
    const title = i >= 0 ? lines[i].replace(/^# /, '').trim() : '';
    if (i >= 0) lines.splice(i, 1);
    return { title, body: lines.join('\n') };
}

const countCards = md => (md.match(/<details>/g) || []).length;

function block(summary, inner, cls = '') {
    return `<details${cls ? ` class="${cls}"` : ''}>\n<summary><h2>${summary}</h2></summary>\n<div class="details-content">\n${inner}\n</div>\n</details>\n`;
}

function buildCourse(c) {
    const ex = path.join(ROOT, c.dir, 'exam');
    const files = fs.readdirSync(path.join(ex, 'lectures')).filter(f => f.endsWith('.md')).sort();
    let total = 0;
    let body = '';
    for (const f of files) {
        const lec = splitTitle(fs.readFileSync(path.join(ex, 'lectures', f), 'utf8'));
        const cardsPath = path.join(ex, 'cards', f);
        const cardsMd = fs.existsSync(cardsPath) ? splitTitle(fs.readFileSync(cardsPath, 'utf8')).body : '';
        const n = countCards(cardsMd);
        total += n;
        let inner = block('Выжимка', render(lec.body), 'sub');
        if (n) inner += block(`Карточки (${n})`, `<div class="cards">${render(cardsMd)}</div>`, 'sub');
        body += block(esc(lec.title), inner, 'lecture');
    }
    if (c.homeworks) {
        const hw = splitTitle(fs.readFileSync(path.join(ex, 'homeworks.md'), 'utf8')).body;
        const sections = hw.split(/^(?=## )/m);
        let intro = '', inner = '';
        for (const sec of sections) {
            if (!sec.startsWith('## ')) { intro += sec; continue; }
            const nl = sec.indexOf('\n');
            const head = sec.slice(3, nl).trim();
            const rest = sec.slice(nl + 1).replace(/\n---\s*$/m, '');
            const isCards = /^Карточки/.test(head);
            const n = isCards ? countCards(rest) : 0;
            total += n;
            inner += block(esc(isCards ? `${head} (${n})` : head), isCards ? `<div class="cards">${render(rest)}</div>` : render(rest), 'sub');
        }
        body += block('Домашние задания', render(intro.replace(/\n---\s*$/m, '')) + inner, 'lecture');
    }
    const extraCss = `
.toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; font-size: 14px; color: #4b5563; align-items: center; }
.toolbar button { font: inherit; padding: 4px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; cursor: pointer; }
.toolbar button:hover { background: #eef2f7; }
details.lecture > summary h2 { font-size: 17px; }
details.sub { margin: 10px 0; }
details.sub > summary h2 { font-size: 15px; }
.cards details { margin: 8px 0; }
.cards summary { font-weight: 400; display: block; }
.cards summary span > p { display: inline; }
.cards details > *:not(summary) { padding-left: 16px; padding-right: 16px; }
.cards details[open] > summary { border-bottom: 1px solid #f1f5f9; background: #f8fafc; }
pre { background: #1e1e1e; color: #d4d4d4; padding: 12px; border-radius: 6px; overflow-x: auto; font-family: Consolas, monospace; font-size: 13px; line-height: 1.4; }
code { font-family: Consolas, monospace; font-size: 0.92em; background: #f1f5f9; padding: 1px 4px; border-radius: 4px; }
pre code { background: none; padding: 0; font-size: inherit; }
table { border-collapse: collapse; margin: 12px 0; font-size: 14px; display: block; overflow-x: auto; }
th, td { border: 1px solid #ddd; padding: 5px 9px; text-align: left; vertical-align: top; }
th { background: #2d2d2d; color: #fff; border-color: #444; }
tr:nth-child(even) td { background: #f9f9f9; }
blockquote { margin: 10px 0; padding: 4px 14px; border-left: 3px solid #cbd5e1; color: #4b5563; }
h1 { font-size: 22px; } h2 { font-size: 18px; } h3 { font-size: 16px; margin: 18px 0 6px; } h4 { font-size: 15px; margin: 14px 0 4px; }
.katex-display { overflow-x: auto; overflow-y: hidden; }
`;
    const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(c.title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
<style>
${baseCss}
${extraCss}
</style>
</head>
<body>
<h1>${esc(c.title)}</h1>
<div class="toolbar">
<button onclick="toggle('details.lecture, details.sub', true)">Развернуть разделы</button>
<button onclick="toggle('details', false)">Свернуть всё</button>
<button onclick="toggle('.cards details', true)">Показать все ответы</button>
<button onclick="toggle('.cards details', false)">Скрыть ответы</button>
<span>${files.length} лекций · ${total} карточек</span>
</div>
${body}
<script>
function toggle(sel, open) { document.querySelectorAll(sel).forEach(d => d.open = open); }
</script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
 onload="renderMathInElement(document.body, { delimiters: [ { left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false } ], throwOnError: false });"></script>
</body>
</html>
`;
    const outPath = path.join(ex, c.out);
    fs.writeFileSync(outPath, html);
    console.log(outPath, files.length, 'lectures', total, 'cards', Math.round(html.length / 1024) + ' KB');
}

COURSES.forEach(buildCourse);

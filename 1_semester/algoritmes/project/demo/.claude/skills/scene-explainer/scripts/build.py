#!/usr/bin/env python3
"""Build a scene-explainer page: pull code snippets out of git, inject them into the template, check the result.

Usage: python3 build.py explainer.json

explainer.json (paths may be absolute or relative to the json file):
{
  "repo": "/path/to/git/worktree",
  "base": "<commit before the change>", "head": "<commit with the change>",
  "template": "template.html", "out": "2026-01-31-my-explainer.html",
  "vars": {"TITLE": "Cache Expiry Explainer", "BRAND": "Cache expiry fix"},   # fills __TITLE__ and __BRAND__
  "snippets": {
    "loop": {"file": "src/Cache.java",
             "start": {"find": "for (Entry e : entries)", "nth": 1, "offset": -2},
             "end":   {"lines": 8},        # or {"find": "...", "offset": 0} | {"until": "    }"} | {"until_blank": true}
             "marks": [["isExpired(e, now)", "new"]],   # substring -> css class (new, c1, c2, c3, ink)
             "must_add": true}             # default true: the range must contain a line added by the change
  }
}
Every code line in the page comes from `git show head:file`; lines added since base are flagged.
"""
import html, json, os, re, shutil, subprocess, sys

def die(msg):
    sys.exit(f'build.py: {msg}')

def main(cfg_path):
    cfg = json.load(open(cfg_path)); here = os.path.dirname(os.path.abspath(cfg_path))
    rel = lambda p: p if os.path.isabs(p) else os.path.join(here, p)
    repo, base, head = cfg.get('repo'), cfg.get('base'), cfg.get('head')
    snippets = cfg.get('snippets', {})

    def git(*a):
        r = subprocess.run(['git', '-C', repo, *a], capture_output=True, text=True)
        if r.returncode: die(f"git {' '.join(a)} failed: {r.stderr.strip()}")
        return r.stdout

    src, added, stats = {}, {}, {}
    for f in sorted({s['file'] for s in snippets.values()}):
        src[f] = git('show', f'{head}:{f}').split('\n')
        added[f] = set()
        for m in re.finditer(r'^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@', git('diff', '-U0', base, head, '--', f), re.M):
            a, n = int(m.group(1)), int(m.group(2) or 1); added[f].update(range(a, a + n))
        ns = git('diff', '--numstat', base, head, '--', f).split()
        stats[os.path.basename(f)] = [int(ns[0]), int(ns[1])] if len(ns) >= 2 else [0, 0]

    def find(f, needle, nth=1, after=0):
        hits = [i + 1 for i, l in enumerate(src[f]) if needle in l and i + 1 > after]
        if len(hits) < nth: die(f'{needle!r} not found {nth}x in {f}')
        return hits[nth - 1]

    out = {}
    for sid, s in snippets.items():
        f, st, en = s['file'], s['start'], s.get('end', {'lines': 1})
        anchor = find(f, st['find'], st.get('nth', 1)); a = anchor + st.get('offset', 0)
        if 'lines' in en: b = a + en['lines'] - 1
        elif 'find' in en: b = find(f, en['find'], en.get('nth', 1), after=a - 1) + en.get('offset', 0)
        elif 'until' in en: b = next((i for i in range(anchor + 1, len(src[f]) + 1) if src[f][i - 1] == en['until']), None) or die(f'{sid}: no line {en["until"]!r} after {anchor}')
        elif en.get('until_blank'): b = next((i - 1 for i in range(anchor + 1, len(src[f]) + 1) if not src[f][i - 1].strip()), len(src[f]))
        else: die(f'{sid}: bad "end"')
        lines = src[f][a - 1:b]
        if not lines: die(f'{sid}: empty range {a}-{b}')
        indent = min((len(l) - len(l.lstrip()) for l in lines if l.strip()), default=0)
        rows = []
        for n, l in zip(range(a, b + 1), lines):
            t = html.escape(l[indent:])
            for needle, cls in s.get('marks', []):
                e = html.escape(needle)
                if e in t: t = t.replace(e, f'<mark class="{cls}">{e}</mark>')
            rows.append({'n': n, 'add': n in added[f], 'h': t})
        for needle, _ in s.get('marks', []):
            if not any(html.escape(needle) in r['h'] for r in rows): die(f'{sid}: mark {needle!r} is not in {f}:{a}-{b}')
        if s.get('must_add', True) and not any(r['add'] for r in rows): die(f'{sid}: no added line in {f}:{a}-{b} (set "must_add": false if intended)')
        out[sid] = {'file': os.path.basename(f), 'a': a, 'b': b, 'rows': rows}
        print(f"  {sid:12} {os.path.basename(f)}:{a}-{b}  lines={len(rows)} added={sum(r['add'] for r in rows)}")

    tpl = open(rel(cfg.get('template', 'template.html'))).read()
    for ph, val in [('/*__SNIPS__*/', json.dumps(out)), ('/*__STATS__*/', json.dumps(stats))] + [(f'__{k}__', str(v)) for k, v in cfg.get('vars', {}).items()]:
        if ph not in tpl: die(f'placeholder {ph} is not in the template')
        tpl = tpl.replace(ph, val)

    problems = []
    left = sorted(set(re.findall(r'__[A-Z][A-Z0-9_]*__', tpl)))
    if left: problems.append(f'unfilled placeholders: {left}')
    ext = re.findall(r'(?:src|href)\s*=\s*"(https?://[^"]+)"', tpl) + re.findall(r'url\((https?://[^)]+)\)', tpl)
    if ext: problems.append(f'external resources (page must be self-contained): {ext[:3]}')
    bad_rx = re.findall(r'<rect[^>]*\srx="[^"]*\s[^"]*"', tpl)
    if bad_rx: problems.append('an SVG <rect> has several rx values; SVG takes one (draw a <path> instead)')
    js = re.search(r'<script>(.*)</script>', tpl, re.S)
    if js:
        used = {i.strip().strip('\'"') for m in re.finditer(r'code:\s*\[([^\]]*)\]', js.group(1)) for i in m.group(1).split(',') if i.strip()}
        if used - set(out): problems.append(f'beats reference unknown snippets: {sorted(used - set(out))}')
        if set(out) - used: print(f'  note: snippets never shown: {sorted(set(out) - used)}')
        if shutil.which('node'):
            tmp = rel('.page-check.js'); open(tmp, 'w').write(js.group(1))
            r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True); os.remove(tmp)
            if r.returncode: problems.append('JavaScript syntax error:\n' + r.stderr.strip()[:600])
    if problems: die('\n - ' + '\n - '.join(problems))
    dest = rel(cfg['out']); open(dest, 'w').write(tpl)
    print(f'wrote {dest} ({len(tpl):,} bytes); line stats {stats}')

if __name__ == '__main__':
    if len(sys.argv) != 2: die('usage: python3 build.py explainer.json')
    main(sys.argv[1])

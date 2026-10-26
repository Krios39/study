import base64
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

HW = Path(__file__).resolve().parents[2]
BIN = HW / "src" / "bin"
PREVIEW_WIDTH = 768
VERSIONS = ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"]

TD = 'style="padding: 10px; border: 1px solid #cbd5e1;"'


def table(headers, rows):
    head = "".join(f"<th {TD}>{h}</th>" for h in headers)
    body = ""
    for i, row in enumerate(rows):
        bg = ' style="background: #f8fafc;"' if i % 2 else ""
        body += f"<tr{bg}>" + "".join(f"<td {TD}>{c}</td>" for c in row) + "</tr>\n"
    return ('<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px; text-align: left;">\n'
            f'<thead><tr style="background: #e2e8f0; color: #333;">{head}</tr></thead>\n<tbody>\n{body}</tbody>\n</table></div>')


def data_uri(img, fmt="PNG", **kw):
    buf = io.BytesIO()
    img.save(buf, fmt, **kw)
    mime = "image/png" if fmt == "PNG" else "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(buf.getvalue()).decode()}"


def figure(path, alt, width=768):
    img = Image.open(path).convert("RGB")
    img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    return (f'<img src="{data_uri(img, "JPEG", quality=88)}" alt="{alt}" '
            f'style="width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px; margin-top: 10px;">')


def preview(path):
    img = Image.open(path).convert("RGB")
    return data_uri(img.resize((PREVIEW_WIDTH, img.height), Image.BOX)), img.height, img.width


def order(path):
    return [int(x) for x in Path(path).read_text().split()]


res = {v: {k: json.loads((BIN / k / f"HW9_T1_{k}_{v}_results.json").read_text()) for k in ("test", "challenge")} for v in VERSIONS}
images = {
    "test": {"label": "Worked example", "file": HW / "HW9_rows_test_shuffled.png"},
    "challenge": {"label": "Mystery image", "file": HW / "HW9_rows_challenge_shuffled.png"},
}
widget_data = {}
for key, info in images.items():
    uri, height, width = preview(info["file"])
    orders = {v: order(BIN / key / f"HW9_T1_{key}_{v}_order.txt") for v in VERSIONS}
    widget_data[key] = {"label": info["label"], "src": uri, "height": height, "width": width, "orders": orders,
                        "cost": {v: res[v][key]["best_cost"] for v in VERSIONS}}
    start = res["v7"][key]["best_start"]
    pairs = {v: {frozenset(p) for p in zip(orders[v], orders[v][1:])} for v in ("v7", "v8")}
    other = {"v7": "v8", "v8": "v7"}
    marks = {v: [i for i, p in enumerate(zip(orders[v], orders[v][1:])) if frozenset(p) not in pairs[other[v]]] for v in ("v7", "v8")}
    pixels = np.asarray(Image.open(info["file"]).convert("RGB"), dtype=np.int64)
    dist = lambda a, b: int(np.abs(pixels[a] - pixels[b]).sum())
    fwd = orders["v1"]
    s8 = res["v8"][key]["best_start"]
    added8 = order(BIN / key / f"HW9_T1_{key}_v8_insertion_start{s8}.txt")
    pos8 = {r: i for i, r in enumerate(orders["v8"])}
    lo = hi = pos8[added8[0]]
    steps8 = []
    for r in added8[1:]:
        p = pos8[r]
        if p < lo:
            steps8.append(["top", dist(r, orders["v8"][lo])])
            lo = p
        else:
            steps8.append(["bottom", dist(r, orders["v8"][hi])])
            hi = p
    gap_key = {"v3": "first_pixel_gap", "v4": "first_and_last_pixel_gap", "v5": "first_middle_last_pixel_gap", "v6": "three_pixel_gap", "v7": "full_row_gap"}
    post = {}
    for v in ("v2", "v3", "v4", "v5", "v6", "v7"):
        t = next(t for t in res[v][key]["trials"] if t["start"] == res[v][key]["best_start"])
        if v == "v2":
            post[v] = {"cut": t["cut_after_position"], "value": t["first_pixel_gap"]}
        else:
            pl = t["piles"]
            post[v] = {"cut": pl["cut_after_position"], "value": pl[gap_key[v]], "big": pl["big_pile"], "small": pl["small_pile"],
                       "above": pl["small_pile_was_above"], "reversed": pl["small_pile_reversed"],
                       "a": pl.get("diff_to_big_top", pl.get("small_top_to_big")), "b": pl.get("diff_to_big_bottom", pl.get("small_bottom_to_big"))}
    widget_data[key]["steps"] = {"forward": fwd, "fstart": res["v1"][key]["best_start"],
                                 "fdist": [dist(a, b) for a, b in zip(fwd, fwd[1:])],
                                 "v8start": s8, "v8added": added8, "v8steps": steps8, "post": post}
    widget_data[key]["cmp"] = {
        "start": start,
        "added": {"v7": orders["v1"], "v8": order(BIN / key / f"HW9_T1_{key}_v8_insertion_start{start}.txt")},
        "marks": marks,
    }


def trial_rows(v, key):
    rows = []
    for t in res[v][key]["trials"]:
        rec = t.get("recovered")
        cut = f"after position {t['cut_after_position']} (first-pixel gap {t['first_pixel_gap']})" if "cut_after_position" in t else "—"
        if "piles" in t and "big_row_at_seam" in t["piles"]:
            pl = t["piles"]
            cut = (f"after position {pl['cut_after_position']}: big pile {pl['big_pile']}, small pile {pl['small_pile']} ({'above' if pl['small_pile_was_above'] else 'below'}); "
                   f"big-pile row at seam {pl['big_row_at_seam']} vs small top {pl['small_top_to_big']}, small bottom {pl['small_bottom_to_big']} → small pile {'reversed' if pl['small_pile_reversed'] else 'kept'} in place")
        elif "piles" in t:
            pl = t["piles"]
            cut = (f"after position {pl['cut_after_position']}: big pile {pl['big_pile']}, small pile {pl['small_pile']} ({'above' if pl['small_pile_was_above'] else 'below'} the seam); "
                   f"seam row {pl['seam_row']} vs big-pile top {pl['diff_to_big_top']}, bottom {pl['diff_to_big_bottom']} → small pile {'reversed' if pl['small_pile_reversed'] else 'kept'} below")
        rows.append([str(t["start"]), f"{t['cost']:,}", f"{rec['pairs']}/{rec['of']} = {100 * rec['fraction']:.2f}%" if rec else "—", cut])
    return rows


def cost_at(v, key, start):
    return next(t["cost"] for t in res[v][key]["trials"] if t["start"] == start)


t1 = res["v1"]["test"]
info = {
    "v1": ("Greedy forward",
           "Start from one row; compare it with every unused row; append the one with the smallest distance; continue from that row until all rows are used (ties: smaller shuffled index). "
           "Three starting rows were tried for each image: the first, the middle and the last shuffled row.",
           f"The supplied correct order has cost {t1['correct_order_cost']:,}, lower than the best greedy result {t1['best_cost']:,}: the greedy order is not optimal. "
           "For start row 512 the order consists of three correct fragments: 134 rows (original rows 890 → 1023), 2 rows (888 → 889) and 888 rows (887 → 0). "
           "So two neighbouring pairs are wrong: after position 133, where the full-row distance is the largest of all (220,273, 5.2 × the median), and after position 135, which is only the 39th largest. "
           "The 134-row pavement strip on top is the visible seam; the 2-row fragment is invisible."),
    "v2": ("Swap at the largest first-pixel jump",
           "After v1, the first pixel of every pair of neighbouring rows is compared; the position with the largest difference is taken as the seam, and the parts below and above it are swapped.",
           "Worse than v1 for every start. The real seam of the example is only the 27th largest first-pixel jump; the largest one lies between two rows that are correct neighbours "
           "(a sharp edge at the left border). Cutting there split a correct fragment, kept the old seam and produced three visible parts."),
    "v3": ("Big pile and small pile",
           "The seam is found as in v2. The two parts are called the big pile and the small pile by their sizes. The row of the small pile that touched the seam is compared (first pixel only) "
           "with the top and the bottom row of the big pile. The big pile always goes on top and the small pile below it; if the seam row is closer to the top of the big pile, the small pile is reversed first.",
           f"Also worse than v1 (best worked-example cost {res['v3']['test']['best_cost']:,}). It starts from the same wrong seam as v2. For start row 512 the small pile was reversed, "
           "so the bird's lower half is the right way up while the buildings stay upside down, and the old seam at the pavement remains."),
    "v4": ("Seam by first and last pixel",
           "Same as v3, but the seam is the neighbouring pair with the largest sum of the first-pixel and last-pixel differences. The comparison with the big pile is unchanged (first pixel).",
           f"The real seam moves from 27th to 2nd place (first + last difference 444), but the largest value (464) again belongs to correct neighbours, so v4 still cuts in the wrong place "
           f"(best worked-example cost {res['v4']['test']['best_cost']:,}, mystery {res['v4']['challenge']['best_cost']:,})."),
    "v5": ("Seam by first, middle and last pixel",
           "Same as v3, but the seam is the neighbouring pair with the largest sum of the differences of three pixels: the first, the middle (x = width / 2) and the last.",
           f"The real seam becomes the largest three-pixel jump (506) and for start row 512 v5 cuts exactly there: the small pile is the 134-row pavement strip. "
           f"By the v3 rule it is reversed and put below the big pile, which is the wrong place here: the strip hangs under the sky. Cost {cost_at('v5', 'test', 512):,}, pairs still 1021/1023. "
           "The cut cannot fix everything: v1 has three fragments, and one cut separates only two of them."),
    "v6": ("Flip the small pile in place",
           "The seam is found as in v5 (largest three-pixel jump). The small pile stays where it is. Its top row and its bottom row are compared (three pixels) with the big-pile row at the seam; "
           "if the end that is currently away from the seam is closer, the small pile is reversed in place.",
           f"<strong>Worked example: first version better than v1.</strong> For start row 512 the cut is at the real seam, the far end of the strip is much closer to the big pile (110 against 506), "
           f"so the strip is reversed in place. Cost {cost_at('v6', 'test', 512):,} (v1 {res['v1']['test']['best_cost']:,}, correct order {t1['correct_order_cost']:,}); no visible seam. "
           "The 2-row fragment is still reversed (890, 888, 889, 887 instead of 890, 889, 888, 887), so the score stays 1021/1023. "
           f"<strong>Mystery: worse than v1</strong> ({res['v6']['challenge']['best_cost']:,}): the largest three-pixel jump is after position 250, not at the misplaced strip near position 40, "
           "so a correct block of 251 rows was reversed."),
    "v7": ("As v6, with full rows",
           "Same as v6, but both the seam search and the comparison of the small pile's ends with the big-pile row use the full row distance, the same measure as the greedy pass.",
           f"<strong>Better than v1 on both images.</strong> The worked example is identical to v6 ({res['v7']['test']['best_cost']:,}). On the mystery image the largest full-row jump for start row 470 "
           "is after position 40, exactly the misplaced strip of v1: its far end is much closer to the big pile (40,601 against 119,582), so the 41 rows are reversed in place. "
           f"The mystery cost drops from {res['v1']['challenge']['best_cost']:,} to <strong>{res['v7']['challenge']['best_cost']:,}</strong> and the picture has no visible seam "
           "(it is upside down, which the open-path score cannot tell). Three pixels missed this seam; the full row finds it. Other starts still cut inside correct blocks, so several starts are needed."),
    "v8": ("Grow the chain at both ends (course hint)",
           "Start from one row. At every step find the best unused row for the top end and the best unused row for the bottom end, and attach the one with the smaller distance "
           "(prepend or append). The chain is never closed. Ties: smaller shuffled row index; if both ends tie, prepend. No post-processing.",
           f"<strong>Best result of all versions.</strong> Worked example: starts 512 and 1023 recover <strong>all 1023/1023</strong> neighbouring pairs, the path cost equals the supplied correct order ({t1['correct_order_cost']:,}), and the reconstructed pixels are exactly the original turned upside down (checked against the supplied SHA-256 after a vertical flip). Start 0 is slightly worse ({cost_at('v8', 'test', 0):,}, 1020/1023), so the starting row still matters. Mystery image: all three starts give the same order, cost <strong>{res['v8']['challenge']['best_cost']:,}</strong>, the lowest of all versions, and the scene comes out the right way up with no visible seam. Why it works: a one-directional chain that starts in the middle of the picture can only grow downwards; when it reaches the bottom edge it must jump to the rows above its start. Growing at both ends lets the chain extend upwards as well, so no forced jump is needed. This is what v2–v7 tried to repair afterwards."),
}

summary = table(["Version", "Best cost, worked example", "Recovered pairs (best start)", "Best cost, mystery"], [
    [f"{v}: {info[v][0]}", f"{res[v]['test']['best_cost']:,}",
     next(f"{t['recovered']['pairs']}/{t['recovered']['of']}" for t in res[v]["test"]["trials"] if t["start"] == res[v]["test"]["best_start"]),
     f"{res[v]['challenge']['best_cost']:,}"] for v in VERSIONS] + [["supplied correct order", f"{t1['correct_order_cost']:,}", "1023/1023", "—"]])

compare = ('<h4>v7 and v8 side by side</h4><p style="font-size: 13px; color: #475569;">The final pictures of v7 and v8 look alike, so this widget shows the difference: '
           'how each chain was built (same starting row, same layout) and where the remaining jumps are.</p><div class="cmp-widget"></div>')
tabs = "".join(f'<button class="trace-tab{" active" if i == 0 else ""}" data-ver="{v}">{v}</button>' for i, v in enumerate(VERSIONS))
panels = ""
for i, v in enumerate(VERSIONS):
    title, desc, note = info[v]
    head = "Piles" if v not in ("v1", "v2") else "Cut"
    panels += f'''
        <div class="ver-panel" data-ver="{v}" style="display: {'block' if i == 0 else 'none'};">
            <h3>{v}: {title}</h3>
            <p>{desc}</p>
            <div class="row-widget" data-ver="{v}"></div>
            <p>{note}</p>
            {compare if v == "v8" else ""}
            <h4>Worked example</h4>
            {table(["Start row", "Path cost", "Recovered neighbouring pairs", head], trial_rows(v, "test"))}
            {figure(BIN / "test" / f"HW9_T1_test_{v}.png", f"Worked example reconstructed by {v}")}
            <h4>Mystery image</h4>
            {table(["Start row", "Path cost", "Recovered neighbouring pairs", head], trial_rows(v, "challenge"))}
            {figure(BIN / "challenge" / f"HW9_T1_challenge_{v}.png", f"Mystery image reconstructed by {v}")}
        </div>'''

script = '''
<script>
window.addEventListener('load', () => {
    const D = __DATA__;
    const sources = {};
    const widgets = [];
    Object.keys(D).forEach(k => {
        const img = new Image();
        img.onload = () => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').drawImage(img, 0, 0); sources[k] = c; widgets.forEach(w => w.render()); };
        img.src = D[k].src;
    });
    const MEASURE = {v2: 'first pixel', v3: 'first pixel', v4: 'first + last pixel', v5: 'first + middle + last pixel', v6: 'three pixels (first, middle, last)', v7: 'full row'};
    const CODE_GROW = ['let mut chain = vec![start];', 'while chain.len() < n {', '    let next = unused row with min d(chain.last(), row);', '    chain.push(next);', '}'];
    const CODE_V8 = ['let mut chain = VecDeque::from([start]);', 'while chain.len() < n {', '    let up = best unused row for chain.front();', '    let down = best unused row for chain.back();', '    if d(front, up) <= d(back, down) { chain.push_front(up) }', '    else { chain.push_back(down) }', '}'];
    const codePost = v => {
        const m = MEASURE[v];
        if (v === 'v2') return [`let k = argmax over i of ${m} jump(chain[i], chain[i + 1]);`, 'chain = chain[k + 1..] + chain[..=k];'];
        if (v === 'v6' || v === 'v7') return [`let k = argmax over i of ${m} jump(chain[i], chain[i + 1]);`, 'let (big, small) = split chain after k, by size;', `compare small.top and small.bottom with the big-pile row at the seam (${m});`, 'if the far end is closer { reverse small in place }'];
        return [`let k = argmax over i of ${m} jump(chain[i], chain[i + 1]);`, 'let (big, small) = split chain after k, by size;', 'compare the small seam row with big.top and big.bottom (first pixel);', 'chain = big + (closer to top ? reversed(small) : small);'];
    };
    const STG = 60;
    const ease = t => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    function mount(root) {
        const ver = root.dataset.ver;
        const hasPost = !['v1', 'v8'].includes(ver);
        const code = ver === 'v8' ? CODE_V8 : CODE_GROW.concat(hasPost ? codePost(ver) : []);
        root.className = 'trace-widget';
        root.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <select class="trace-btn rw-image">${Object.keys(D).map(k => `<option value="${k}">${D[k].label}</option>`).join('')}</select>
                <button class="trace-btn rw-full">⛶ Full screen</button>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin: 10px 0 6px; flex-wrap: wrap; font-size: 14px;">
                <button class="trace-btn rw-back" title="previous step">◀ Step</button>
                <button class="trace-btn rw-play">▶ Play</button>
                <button class="trace-btn rw-next" title="next step">Step ▶</button>
                <button class="trace-btn rw-skip">${hasPost ? '⏭ Skip growth' : '⏭ To the end'}</button>
                <button class="trace-btn rw-reset">↺ Start</button>
                <input type="range" class="rw-step" min="0" value="0" style="width: 220px;">
                <span class="rw-status" style="font-weight: bold;"></span>
            </div>
            <div style="display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 14px; align-items: start;">
                <canvas class="rw-canvas" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 6px;"></canvas>
                <div>
                    <pre class="rw-code" style="margin: 0; padding: 10px; background: #0f172a; color: #cbd5e1; border-radius: 6px; font-size: 12px; line-height: 1.6; white-space: pre-wrap;">${code.map((l, i) => `<div class="rw-line" data-i="${i}" style="padding: 0 4px; border-radius: 3px;">${l.replace(/</g, '&lt;')}</div>`).join('')}</pre>
                    <div class="rw-info" style="font-size: 13px; color: #334155; margin-top: 10px; line-height: 1.55;"></div>
                </div>
            </div>`;
        const q = s => root.querySelector(s);
        let key = 'test', t = 0, timer = null;
        const total = () => D[key].height - 1 + (hasPost ? 4 * STG : 0);
        function light(i) { root.querySelectorAll('.rw-line').forEach(el => { const on = +el.dataset.i === i; el.style.background = on ? '#facc15' : 'transparent'; el.style.color = on ? '#0f172a' : '#cbd5e1'; }); }
        function render() {
            const src = sources[key]; if (!src) return;
            const P = D[key], S = P.steps, H = P.height, W = src.width;
            q('.rw-step').max = total(); q('.rw-step').value = t;
            const c = q('.rw-canvas');
            if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
            c.style.aspectRatio = `${P.width} / ${H}`;
            const g = c.getContext('2d');
            g.fillStyle = '#0f172a'; g.fillRect(0, 0, W, H);
            const line = (y, col, h) => { g.fillStyle = col; g.fillRect(0, y - h / 2, W, h); };
            if (t < H - 1 || !hasPost) {
                const k = Math.min(t, H - 1) + 1;
                if (ver === 'v8') {
                    const fin = P.orders.v8, pos = {}; fin.forEach((r, i) => pos[r] = i);
                    for (let i = 0; i < k; i++) g.drawImage(src, 0, S.v8added[i], W, 1, 0, pos[S.v8added[i]], W, 1);
                    line(pos[S.v8added[0]], '#facc15', 4);
                    if (k > 1) line(pos[S.v8added[k - 1]], '#ef4444', 6);
                    const st = S.v8steps[k - 2];
                    q('.rw-status').textContent = `step ${k} / ${H}`;
                    q('.rw-info').innerHTML = k === 1 ? `Start: chain = [${S.v8start}] (yellow line).` :
                        `Row <b>${S.v8added[k - 1]}</b> attached at the <b>${st[0]}</b> of the chain (red line), distance ${st[1].toLocaleString()}. The chain now has ${k} rows and grows in both directions from the yellow start row.`;
                    light(k === 1 ? 0 : (st[0] === 'top' ? 4 : 5));
                } else {
                    const ch = S.forward;
                    for (let i = 0; i < k; i++) g.drawImage(src, 0, ch[i], W, 1, 0, i, W, 1);
                    if (k > 1) line(k - 1, '#ef4444', 6);
                    q('.rw-status').textContent = `step ${k} / ${H}`;
                    q('.rw-info').innerHTML = k === 1 ? `Start: chain = [${S.fstart}].` :
                        `Last row of the chain was <b>${ch[k - 2]}</b>; the nearest unused row is <b>${ch[k - 1]}</b> (distance ${S.fdist[k - 2].toLocaleString()}), appended at the bottom (red line). Chain length ${k}.`;
                    light(k === 1 ? 0 : 2 + (k % 2));
                }
                if (t >= H - 1) { q('.rw-status').textContent = 'done'; q('.rw-info').innerHTML += ` Path cost <b>${P.cost[ver].toLocaleString()}</b>.`; light(-1); }
                return;
            }
            const u = t - (H - 1), stage = Math.min(3, Math.floor(u / STG)), f = Math.min(1, (u - stage * STG) / STG);
            const ch = S.forward, pp = S.post[ver], fin = P.orders[ver], fpos = {}; fin.forEach((r, i) => fpos[r] = i);
            const aboveLen = pp.cut + 1, bigAbove = ver === 'v2' ? null : !pp.above;
            const tint = i => {
                if (ver === 'v2') return i <= pp.cut ? 'rgba(249, 115, 22, 0.5)' : 'rgba(59, 130, 246, 0.3)';
                const inAbove = i <= pp.cut, isSmall = inAbove === pp.above;
                return isSmall ? 'rgba(249, 115, 22, 0.5)' : 'rgba(59, 130, 246, 0.3)';
            };
            const base = 3 * 0 + (hasPost ? CODE_GROW.length : 0);
            if (stage < 2) {
                for (let i = 0; i < H; i++) g.drawImage(src, 0, ch[i], W, 1, 0, i, W, 1);
                if (stage === 1) for (let i = 0; i < H; i++) { g.fillStyle = tint(i); g.fillRect(0, i, W, 1); }
                line(aboveLen, '#ef4444', 6);
            } else if (stage === 2) {
                const e = ease(f);
                for (let i = 0; i < H; i++) { const y = Math.round(i + (fpos[ch[i]] - i) * e); g.drawImage(src, 0, ch[i], W, 1, 0, y, W, 1); g.fillStyle = tint(i); g.fillRect(0, y, W, 1); }
            } else {
                for (let i = 0; i < H; i++) g.drawImage(src, 0, fin[i], W, 1, 0, i, W, 1);
            }
            const lab = ['1. find the seam', '2. split', '3. rearrange', 'done'][stage];
            q('.rw-status').textContent = `after growth: ${lab}`;
            let info;
            if (stage === 0) {
                info = `The chain is complete (${H} rows). Largest ${MEASURE[ver]} jump between neighbours: after position <b>${pp.cut}</b> (value ${pp.value.toLocaleString()}), red line.`;
                light(base);
            } else if (stage === 1) {
                if (ver === 'v2') info = `Part above the line: ${aboveLen} rows (orange); part below: ${H - aboveLen} rows (blue). They will swap places.`;
                else info = `Big pile ${pp.big} rows (blue), small pile ${pp.small} rows (orange), the small pile is <b>${pp.above ? 'above' : 'below'}</b> the seam.`;
                light(base + 1);
            } else if (stage === 2) {
                if (ver === 'v2') { info = 'The two parts swap places.'; light(base + 1); }
                else if (ver === 'v6' || ver === 'v7') {
                    info = `Small pile top → big-pile row at the seam: ${pp.a.toLocaleString()}; small pile bottom → same row: ${pp.b.toLocaleString()}. `
                        + (pp.reversed ? '<b>The far end is closer, so the small pile is reversed in place.</b>' : 'The near end is closer, so nothing changes.');
                    light(base + (f < 0.5 ? 2 : 3));
                } else {
                    info = `Small seam row → top of big pile: ${pp.a.toLocaleString()}, → bottom of big pile: ${pp.b.toLocaleString()}. The big pile goes on top, the small pile below it`
                        + (pp.reversed ? ', <b>reversed</b>.' : ', kept as it is.');
                    light(base + (f < 0.5 ? 2 : 3));
                }
            } else {
                info = `Final ${ver} order, path cost <b>${P.cost[ver].toLocaleString()}</b>.`;
                light(-1);
            }
            q('.rw-info').innerHTML = info;
        }
        function stop() { if (timer) clearInterval(timer); timer = null; q('.rw-play').textContent = '▶ Play'; }
        const H0 = () => D[key].height - 1;
        const next = () => { if (t < H0()) t += 1; else t = Math.min(total(), H0() + (Math.floor((t - H0()) / STG) + 1) * STG); };
        const back = () => { if (t <= H0()) t = Math.max(0, t - 1); else { const u = t - H0(); t = H0() + Math.max(0, (Math.ceil(u / STG) - 1) * STG); } };
        q('.rw-play').onclick = () => {
            if (timer) { stop(); return; }
            if (t >= total()) t = 0;
            q('.rw-play').textContent = '❚❚ Pause';
            timer = setInterval(() => { t = Math.min(total(), t + (t < H0() ? 6 : 2)); render(); if (t >= total()) stop(); }, 30);
        };
        q('.rw-next').onclick = () => { stop(); next(); render(); };
        q('.rw-back').onclick = () => { stop(); back(); render(); };
        q('.rw-skip').onclick = () => { stop(); t = hasPost ? H0() : total(); render(); };
        q('.rw-reset').onclick = () => { stop(); t = 0; render(); };
        q('.rw-step').oninput = () => { stop(); t = +q('.rw-step').value; render(); };
        q('.rw-image').onchange = () => { stop(); key = q('.rw-image').value; t = 0; render(); };
        q('.rw-full').onclick = () => { const on = root.classList.toggle('expanded'); q('.rw-full').textContent = on ? '✕ Close' : '⛶ Full screen'; };
        const w = {render, stop, root};
        widgets.push(w);
        render();
        return w;
    }
    document.querySelectorAll('.row-widget').forEach(mount);
    function mountCompare(root) {
        root.className = 'trace-widget';
        root.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <select class="trace-btn cw-image">${Object.keys(D).map(k => `<option value="${k}">${D[k].label}</option>`).join('')}</select>
                <button class="trace-btn cw-full">⛶ Full screen</button>
            </div>
            <div style="display: flex; gap: 4px; border-bottom: 1px solid #e2e8f0; margin-top: 10px;">
                <button class="trace-tab active cw-mode" data-mode="build">How the chain is built</button>
                <button class="trace-tab cw-mode" data-mode="final">Final orders and jumps</button>
            </div>
            <div class="cw-controls" style="display: flex; align-items: center; gap: 8px; margin: 10px 0 6px; flex-wrap: wrap; font-size: 14px;">
                <button class="trace-btn cw-play">▶ Play</button>
                <input type="range" class="cw-step" min="0" max="1000" value="0" style="width: 260px;">
                <span class="cw-status" style="font-weight: bold;"></span>
            </div>
            <div class="cw-info" style="font-size: 13px; color: #334155; min-height: 36px; line-height: 1.5;"></div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div><div style="font-weight: bold; font-size: 13px; text-align: center;">v7 (grows one way, then flips the small pile)</div><canvas class="cw-a" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 6px;"></canvas></div>
                <div><div style="font-weight: bold; font-size: 13px; text-align: center;">v8 (grows at both ends)</div><canvas class="cw-b" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 6px;"></canvas></div>
            </div>
            <div class="cw-zoom" style="display: none; margin-top: 10px;">
                <div class="cw-ztitle" style="font-size: 13px; color: #334155; margin-bottom: 4px;"></div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <canvas class="cw-za" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 6px; image-rendering: pixelated;"></canvas>
                    <canvas class="cw-zb" style="width: 100%; border: 1px solid #e2e8f0; border-radius: 6px; image-rendering: pixelated;"></canvas>
                </div>
            </div>`;
        const q = s => root.querySelector(s);
        let key = 'test', mode = 'build', step = 0, timer = null;
        const STRIP = 28;
        function draw(c, ver) {
            const src = sources[key]; if (!src) return;
            const P = D[key], C = P.cmp, H = P.height, W = src.width, ref = P.orders.v8;
            const pos = new Array(H); ref.forEach((r, i) => pos[r] = i);
            const full = mode === 'final';
            const CW = W + (full ? STRIP : 0);
            if (c.width !== CW || c.height !== H) { c.width = CW; c.height = H; }
            c.style.aspectRatio = `${(P.width * CW / W).toFixed(1)} / ${H}`;
            const g = c.getContext('2d');
            g.fillStyle = '#0f172a'; g.fillRect(0, 0, CW, H);
            if (!full) {
                const added = C.added[ver], k = Math.round(step / 1000 * H);
                for (let i = 0; i < k; i++) { const r = added[i]; g.drawImage(src, 0, r, W, 1, 0, pos[r], W, 1); }
                g.fillStyle = '#facc15'; g.fillRect(0, pos[added[0]] - 2, W, 4);
                if (k > 0) { g.fillStyle = '#ef4444'; g.fillRect(0, pos[added[k - 1]] - 3, W, 6); }
            } else {
                const o = P.orders[ver];
                for (let y = 0; y < H; y++) g.drawImage(src, 0, o[y], W, 1, 0, y, W, 1);
                g.fillStyle = '#e2e8f0'; g.fillRect(W, 0, STRIP, H);
                C.marks[ver].forEach(y => { g.fillStyle = '#dc2626'; g.fillRect(W, y - 3, STRIP, 7); g.fillRect(0, y, W, 1); });
            }
        }
        const ZR = 16, ZS = 8;
        function zoom(c, ver, centre) {
            const src = sources[key]; if (!src) return;
            const P = D[key], o = P.orders[ver], W = src.width, H = P.height;
            const a = Math.max(0, Math.min(H - 2 * ZR, centre - ZR + 1));
            c.width = W; c.height = 2 * ZR * ZS;
            const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
            for (let i = 0; i < 2 * ZR; i++) g.drawImage(src, 0, o[a + i], W, 1, 0, i * ZS, W, ZS);
            g.font = '22px system-ui, sans-serif'; g.textBaseline = 'middle';
            P.cmp.marks[ver].forEach(y => { if (y >= a && y < a + 2 * ZR - 1) { const yy = (y - a + 1) * ZS; g.fillStyle = '#dc2626'; g.fillRect(0, yy - 2, W, 4); } });
            for (let i = 0; i < 2 * ZR; i += 4) { g.fillStyle = 'rgba(15, 23, 42, 0.75)'; g.fillRect(0, i * ZS, 64, ZS); g.fillStyle = '#fff'; g.fillText(a + i, 4, i * ZS + ZS / 2); }
            return a;
        }
        function render() {
            draw(q('.cw-a'), 'v7'); draw(q('.cw-b'), 'v8');
            const P = D[key], H = P.height, k = Math.round(step / 1000 * H);
            q('.cw-controls').style.display = mode === 'build' ? 'flex' : 'none';
            q('.cw-zoom').style.display = mode === 'final' && P.cmp.marks.v7.length ? 'block' : 'none';
            if (mode === 'final' && P.cmp.marks.v7.length) {
                const m = P.cmp.marks.v7[0], row = P.orders.v7[m], m8 = P.orders.v8.indexOf(row);
                const a7 = zoom(q('.cw-za'), 'v7', m), a8 = zoom(q('.cw-zb'), 'v8', m8);
                q('.cw-ztitle').innerHTML = `Magnified ×${ZS}: 32 rows around the first difference (v7 positions ${a7}–${a7 + 31}; the same rows in v8, positions ${a8}–${a8 + 31}). Red lines mark neighbouring pairs that the other version does not have.`;
            }
            if (mode === 'build') {
                q('.cw-status').textContent = `${k} / ${H} rows added`;
                q('.cw-info').innerHTML = `Both panels use the same layout (the final v8 picture), so every row is drawn where it really belongs. Rows appear in the order each algorithm added them, `
                    + `both starting from shuffled row ${P.cmp.start} (yellow line); the red line is the newest row. v7 can only extend downwards, reaches the edge and then has to jump; `
                    + `v8 extends upwards and downwards. v7's flip of the small pile happens after the last row.`;
            } else {
                const n7 = P.cmp.marks.v7.length;
                q('.cw-info').innerHTML = `The final orders. Red marks on the right strip: neighbouring pairs that exist in this version but not in the other one (${n7} in v7, ${P.cmp.marks.v8.length} in v8)`
                    + (key === 'test' ? '; on the worked example these are exactly the wrong pairs of v7, because v8 is the correct order. ' : '. ')
                    + `They are only 2–3 rows long, too thin to see in the whole picture, so the magnifier below shows them. Path cost v7 <b>${P.cost.v7.toLocaleString()}</b>, v8 <b>${P.cost.v8.toLocaleString()}</b>.`;
            }
        }
        function stop() { if (timer) clearInterval(timer); timer = null; q('.cw-play').textContent = '▶ Play'; }
        q('.cw-play').onclick = () => {
            if (timer) { stop(); return; }
            if (step >= 1000) step = 0;
            q('.cw-play').textContent = '❚❚ Pause';
            timer = setInterval(() => { step = Math.min(1000, step + 4); q('.cw-step').value = step; render(); if (step >= 1000) stop(); }, 30);
        };
        q('.cw-step').oninput = () => { stop(); step = +q('.cw-step').value; render(); };
        q('.cw-image').onchange = () => { key = q('.cw-image').value; stop(); step = 0; q('.cw-step').value = 0; render(); };
        root.querySelectorAll('.cw-mode').forEach(b => b.onclick = () => {
            mode = b.dataset.mode;
            root.querySelectorAll('.cw-mode').forEach(x => x.classList.toggle('active', x === b));
            stop(); render();
        });
        q('.cw-full').onclick = () => { const on = root.classList.toggle('expanded'); q('.cw-full').textContent = on ? '✕ Close' : '⛶ Full screen'; };
        const w = {render, stop, root};
        widgets.push(w);
        render();
    }
    document.querySelectorAll('.cmp-widget').forEach(mountCompare);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') widgets.forEach(w => { if (w.root.classList.contains('expanded')) w.root.querySelector('.rw-full').click(); }); });
    document.querySelectorAll('#verTabs .trace-tab').forEach(b => b.onclick = () => {
        document.querySelectorAll('#verTabs .trace-tab').forEach(x => x.classList.toggle('active', x === b));
        document.querySelectorAll('.ver-panel').forEach(p => p.style.display = p.dataset.ver === b.dataset.ver ? 'block' : 'none');
        widgets.forEach(w => w.stop());
    });
});
</script>
'''.replace("__DATA__", json.dumps(widget_data))

t1_html = f'''<details>
    <summary>Task T1: What is in the shuffled image?</summary>
    <div class="details-content">

        <h3>Distance and Score</h3>
        <p>
            Each row is a vector of all its RGB values. The distance between two rows is the sum over all pixels of |ΔR| + |ΔG| + |ΔB| (values converted from <code>uint8</code> before subtraction),
            so a black pixel against a white one contributes the maximum 765. The score of an order is the sum of distances between consecutive rows, as an open path.
            The worked example's supplied order was used only for evaluation, never during the search. Distance matrix: {t1["matrix_seconds"]:.1f} s for the example.
            Every version was run from three starting rows (first, middle and last shuffled row); all scores are kept.
        </p>
        {summary}

        <h3>Versions</h3>
        <p style="font-size: 13px; color: #475569;">
            Each tab has the idea of one version, its own widget, the scores of all three starts and the reconstructions. The widgets use display copies of the shuffled images narrowed to {PREVIEW_WIDTH} px (all rows kept).
        </p>
        <div id="verTabs" style="display: flex; gap: 4px; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap;">{tabs}</div>
        {panels}
    </div>
</details>
'''

head = '''<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>HW9. Reconstruct, Travel, and Cover</title>
    <meta name="reference" content="Rust | https://doc.rust-lang.ru/">
    <meta name="reference" content="png crate, decoding and writing images | https://docs.rs/png/latest/png/">
    <meta name="reference" content="Pillow, display copies in the report | https://python-pillow.org/">
    <link rel="stylesheet" href="../../styles.css">
    <script src="../../header.js" defer></script>
    <script src="../../footer.js" defer></script>
    <style>
        .trace-widget { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; max-width: 1000px; margin: 15px auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .trace-tab { padding: 6px 12px; border: none; background: none; cursor: pointer; font-size: 13px; color: #64748b; border-bottom: 3px solid transparent; }
        .trace-tab:hover { color: #0f172a; }
        .trace-tab.active { color: #0f172a; font-weight: bold; border-bottom-color: #3b82f6; }
        .trace-btn { padding: 6px 12px; border: 1px solid #cbd5e1; border-radius: 5px; background: #f8fafc; cursor: pointer; font-size: 13px; }
        .trace-btn:hover { background: #e2e8f0; }
        .trace-widget.expanded { position: fixed; inset: 0; z-index: 10000; max-width: none !important; margin: 0; border-radius: 0; overflow: auto; box-sizing: border-box; padding: 20px 32px; }
        #verTabs .trace-tab { font-size: 15px; padding: 8px 16px; }
    </style>
</head>
<body>
'''
t2res = {n: json.loads((BIN / f"tsp{n}" / f"HW9_T2_{n}_results.json").read_text()) for n in (100, 500, 2000)}
t2_rows = [[str(n), f"{t2res[n]['mst']['length']:,.3f}", f"{t2res[n]['mst']['seconds']:.3f} s",
            f"{t2res[n]['mst_tour']['length']:,.3f}", f"{t2res[n]['mst_tour']['gap_percent']:.2f}%", f"{1000 * t2res[n]['mst_tour']['seconds']:.2f} ms",
            f"{t2res[n]['nn_tour']['length']:,.3f}", f"{t2res[n]['nn_tour']['gap_percent']:.2f}%", f"{1000 * t2res[n]['nn_tour']['seconds']:.2f} ms"] for n in (100, 500, 2000)]
baseline = json.loads((HW / "HW9_TSP_baseline_score.json").read_text())
T2D = BIN / "tsp100"
t2_html = f"""<details>
    <summary>Task T2: One tree, two baseline tours</summary>
    <div class="details-content">

        <h3>Method</h3>
        <ul>
            <li><strong>Distances:</strong> ordinary Euclidean distances, no rounding; the full distance matrix is computed once before timing the tours.</li>
            <li><strong>MST:</strong> library routine <code>petgraph::algo::min_spanning_tree</code> (Kruskal) on the complete graph of all point pairs. The trees are saved and reused in T3.</li>
            <li><strong>MST tour (own code):</strong> the tree is rooted at ID 1 and traversed depth-first, children in increasing ID order; every vertex is recorded at its first visit, and the order is closed into a cycle.</li>
            <li><strong>NN tour (own code):</strong> start at ID 1, always go to the nearest unvisited point (ties: smaller ID), finally return to the start.</li>
            <li>Gap above the MST lower bound: 100 · (tour length / MST length − 1). This is not the gap to the unknown optimal tour.</li>
        </ul>

        <h3>Results</h3>
        {table(["Points", "MST length", "MST time", "MST tour", "Gap", "Time", "NN tour", "Gap", "Time"], t2_rows)}
        <p>
            All six tours pass the course validator (<code>HW9_helpers.py validate</code>), and the lengths above are the validator's.
            The 2000-point NN tour is identical to the supplied baseline (length {baseline["length"]:.6f}, same <code>cycle_sha256</code>), which confirms the NN rule and the tie-breaking.
            NN is about 12–13% shorter than the MST tour on every dataset, and both stay far below the factor-2 guarantee. The gaps grow slightly with N.
        </p>

        <h3>100 Points: Tree and Both Tours</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
            <div>{figure(T2D / "HW9_T2_100_mst.png", "Minimum spanning tree of the 100 points", 900)}<p style="font-size: 13px; text-align: center;">MST, length {t2res[100]['mst']['length']:,.3f}</p></div>
            <div>{figure(T2D / "HW9_T2_100_mst_tour.png", "Tour from the depth-first traversal of the MST", 900)}<p style="font-size: 13px; text-align: center;">MST tour (DFS from ID 1)</p></div>
            <div>{figure(T2D / "HW9_T2_100_nn_tour.png", "Nearest-neighbour tour from ID 1", 900)}<p style="font-size: 13px; text-align: center;">NN tour from ID 1</p></div>
        </div>
        <p>
            The MST tour follows the branches of the tree and then makes long diagonal shortcuts when a branch ends and the traversal jumps to the next unvisited branch.
            The NN tour is mostly built from short steps, but near the end it has a few very long edges: the remaining unvisited points are scattered, and the walk must fly back to them.
        </p>

        <h3>Why MST Length Is a Lower Bound</h3>
        <p>
            Remove any one edge from a tour: what remains is a path through all points, and a path is a spanning tree. The MST is the shortest spanning tree, so
            MST ≤ that path ≤ the tour (all edges are non-negative). This holds for every tour, including the optimal one.
        </p>
        <h3>Why the Shortcut Tour Is at Most Twice the MST</h3>
        <p>
            A full depth-first walk of the tree goes down and back up every edge, so it has length exactly 2 · MST and visits every point. The tour is this walk with repeated points skipped:
            each skipped stretch is replaced by one straight segment. In Euclidean space the triangle inequality holds, so a straight segment is never longer than the walk it replaces.
            Therefore the tour is at most 2 · MST.
        </p>
    </div>
</details>
"""
(HW / "report.html").write_text(head + t1_html + t2_html + script + "</body>\n</html>\n", encoding="utf-8")
print("report written", (HW / "report.html").stat().st_size)

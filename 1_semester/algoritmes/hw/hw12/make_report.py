import base64
import html
import io
import json
import re
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image

HW = Path(__file__).resolve().parent
TD = 'style="padding: 8px 10px; border: 1px solid #cbd5e1;"'
NOTE = 'style="font-size: 13px; color: #475569;"'
METHODS = ["naive", "KMP", "Horspool"]


def load(path):
    return json.loads((HW / path).read_text(encoding="utf-8"))


def table(headers, rows, mono=False):
    head = "".join(f"<th {TD}>{x}</th>" for x in headers)
    body = ""
    for i, row in enumerate(rows):
        bg = ' style="background: #f8fafc;"' if i % 2 else ""
        body += f"<tr{bg}>" + "".join(f"<td {TD}>{c}</td>" for c in row) + "</tr>\n"
    font = "font-family: monospace; " if mono else ""
    return ('<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; margin: 15px 0; ' + font + 'font-size: 14px; text-align: left;">\n'
            f'<thead><tr style="background: #e2e8f0; color: #333;">{head}</tr></thead>\n<tbody>\n{body}</tbody>\n</table></div>')


def pre(text):
    return f'<pre style="overflow-x: auto; font-size: 13px;">{html.escape(text)}</pre>'


def svg(path, caption):
    s = (HW / path).read_text(encoding="utf-8")
    s = re.sub(r'(<svg[^>]*?) width="[^"]*" height="[^"]*"', r'\1 style="width: 100%; height: auto; display: block;"', s, count=1)
    return (f'<div style="border: 1px solid #ccc; border-radius: 4px; margin-top: 10px; padding: 4px; background: white;">{s}</div>'
            f'<p style="font-size: 13px; text-align: center; margin-top: 4px;">{caption}</p>')


def figure(path, alt, caption):
    img = Image.open(path).convert("RGB")
    if img.width > 1100:
        img = img.resize((1100, round(img.height * 1100 / img.width)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    uri = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    return (f'<div><img src="{uri}" alt="{alt}" style="width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px; margin-top: 10px;">'
            f'<p style="font-size: 13px; text-align: center; margin-top: 4px;">{caption}</p></div>')


def widget(name):
    return (HW / "widgets" / f"{name}_widget.html").read_text(encoding="utf-8")



def g(x):
    return f"{x:,.0f}"


def section(title, body, open_=False):
    return f'<details{" open" if open_ else ""}>\n    <summary>{title}</summary>\n    <div class="details-content">\n{body}\n    </div>\n</details>\n'


def t1():
    d = load("t1/T1.json")
    tests = table(["case", "text", "pattern", "expected positions"],
                  [[x["case"], f'<code>{x["text"]}</code>', f'<code>{x["pattern"]}</code>', str(x["expected"])] for x in d["tests"]])
    rows = []
    for r in d["rows"]:
        rows.append([r["method"], r["m"], f'<code>{r["pattern"]}</code>', r["matches"], r["prep_comparisons"], f'{r["prep_ns"]:.0f} ns',
                     g(r["search_comparisons"]), f'{r["search_comparisons"] / d["size"]:.3f}', f'{r["search_ms"]:.2f}'])
    res = table(["method", "m", "pattern", "matches", "prep cmp", "prep time", "search cmp", "cmp / char", "search ms"], rows)
    return f"""
        <h3>Method</h3>
        <ul>
            <li><strong>Naive:</strong> for every start position compare left to right until the first mismatch.</li>
            <li><strong>KMP:</strong> the failure table <code>fail[i]</code> is the length of the longest proper border of <code>P[0..i]</code>. The text is read once; after a mismatch the pattern state falls back to <code>fail[k−1]</code>, after a full match to <code>fail[m−1]</code>, so overlapping matches are found.</li>
            <li><strong>Boyer–Moore–Horspool</strong> (the chosen variant): the window is compared right to left. Whatever happens, the window moves by <code>shift[c]</code> where <code>c</code> is the text letter under the last pattern position; <code>shift[c] = m−1−i</code> for the last occurrence <code>i &lt; m−1</code> of <code>c</code> in the pattern, and <code>m</code> if <code>c</code> does not occur there. There is no good-suffix rule.</li>
            <li><strong>Counting:</strong> one generic function compares two letters and increments a counter; the timed runs use a no-op counter, so the same code is measured. Table lookups and index tests are not counted. Preprocessing comparisons (KMP failure table) are counted separately; Horspool's table needs none.</li>
            <li><strong>Timing:</strong> median of {d["runs"]} runs, matches only counted. Preprocessing time is the median of {d["runs"]} runs of {d["prep_repeat"]:,} preparations divided by {d["prep_repeat"]:,}.</li>
        </ul>
        <h3>Small tests</h3>
        <p>All three methods return exactly these positions; an empty pattern is rejected by all three. In addition, 3,000 random texts and patterns over <code>{{a, b}}</code> agree with a direct check of every window.</p>
        {tests}
        <p>Horspool trace for <code>abra</code> in <code>abracadabra</code> (shift table: a→3, b→2, r→1, others→4):</p>
        {pre(chr(10).join(d["trace"]))}
        <p {NOTE}>At position 1 the window ends with <code>c</code>, which is not in the pattern, so the whole pattern jumps past it (shift 4).</p>
        <h3>Interactive: which letters each method reads</h3>
                {widget("search")}
        <h3>Results on 1,000,000 uniform letters</h3>
        <p>Text: {d["size"]:,} letters <code>a–z</code>, independent uniform sampling, splitmix64 seed {d["seed"]}. Patterns: <code>text[{d["pattern_position"]:,} .. {d["pattern_position"]:,}+m]</code>, so each has at least one match.</p>
        {res}
        <h3>Conclusion</h3>
        <ul>
            <li>Naive and KMP make almost the same number of comparisons (about 1.04 per letter): with 26 equally likely letters the first comparison already fails 25 times out of 26, so KMP's fallback is rarely needed.</li>
            <li>Horspool makes far fewer comparisons, about n/m: most windows end in a letter that is not near the end of the pattern, so it jumps almost m letters. The longer the pattern, the fewer comparisons.</li>
            <li><strong>Fewer comparisons does not mean proportionally less time.</strong> For m = 5 Horspool makes 4.6× fewer comparisons than naive but is only about 1.5× faster. Each Horspool step does more work (a right-to-left loop, a table lookup and a variable jump), while the naive loop is a tight, well-predicted scan. Comparisons count the abstract work; time also depends on memory access and branch prediction.</li>
        </ul>"""


def t2_chart(d):
    kinds = [("binary", "text", "{a,b}"), ("dna", "text", "DNA"), ("skewed", "text", "skewed e=50%"),
             ("periodic", "a^m", "a^n, a^m"), ("near-periodic", "a..ab", "near-periodic\na..ab"), ("near-periodic", "ba..a", "near-periodic\nba..a")]
    colors = {"naive": "#64748b", "KMP": "#1d4ed8", "Horspool": "#c2410c"}
    fig, axes = plt.subplots(1, 2, figsize=(13, 4.6))
    for ax, key, label in [(axes[0], "comparisons_per_char", "comparisons per text letter (log)"), (axes[1], "search_ms", "search time, ms")]:
        for k, method in enumerate(METHODS):
            values = []
            for fam, kind, _ in kinds:
                row = next(r for r in d["rows"] if r["family"] == fam and r["pattern_kind"] == kind and r["m"] == 20 and r["method"] == method
                           and (r["seed"] in (2026, None)))
                values.append(row[key])
            ax.bar([i + (k - 1) * 0.27 for i in range(len(kinds))], values, 0.27, label=method, color=colors[method])
        ax.set_xticks(range(len(kinds)), [x[2] for x in kinds], fontsize=9)
        ax.set_ylabel(label)
        if key == "comparisons_per_char":
            ax.set_yscale("log")
        ax.grid(axis="y", alpha=0.3)
    axes[0].legend()
    fig.suptitle("T2: pattern length m = 20, seed 2026")
    fig.tight_layout()
    fig.savefig(HW / "t2/T2_chart.png", dpi=130)
    plt.close(fig)


def t2():
    d = load("t2/T2.json")
    t2_chart(d)
    rows = []
    order = [("binary", "text"), ("dna", "text"), ("skewed", "text"), ("periodic", "a^m"), ("near-periodic", "a..ab"), ("near-periodic", "ba..a")]
    for fam, kind in order:
        for m in (5, 10, 20):
            sel = {r["method"]: r for r in d["rows"] if r["family"] == fam and r["pattern_kind"] == kind and r["m"] == m and r["seed"] in (2026, None)}
            best_c = min(sel[x]["search_comparisons"] for x in METHODS)
            best_t = min(sel[x]["search_ms"] for x in METHODS)
            cells = []
            for x in METHODS:
                r = sel[x]
                c = f'{r["comparisons_per_char"]:.2f}'
                t = f'{r["search_ms"]:.2f}'
                if r["search_comparisons"] == best_c:
                    c = f"<strong>{c}</strong>"
                if r["search_ms"] == best_t:
                    t = f"<strong>{t}</strong>"
                cells.append(f"{c} / {t}")
            rows.append([fam, f'<code>{sel["naive"]["pattern"]}</code>', m, g(sel["naive"]["matches"])] + cells)
    main = table(["family", "pattern", "m", "matches", "naive cmp/char / ms", "KMP", "Horspool"], rows)
    seed_rows = []
    for fam, kind in [("binary", "text"), ("dna", "text"), ("skewed", "text"), ("near-periodic", "a..ab"), ("near-periodic", "ba..a")]:
        for seed in d["seeds"]:
            sel = {r["method"]: r for r in d["rows"] if r["family"] == fam and r["pattern_kind"] == kind and r["m"] == 20 and r["seed"] == seed}
            seed_rows.append([fam, seed, f'<code>{sel["naive"]["pattern"]}</code>'] +
                             [f'{sel[x]["comparisons_per_char"]:.2f} / {sel[x]["search_ms"]:.2f}' for x in METHODS])
    seeds = table(["family", "seed", "pattern (m = 20)", "naive cmp/char / ms", "KMP", "Horspool"], seed_rows)
    s5 = []
    for seed in d["seeds"]:
        sel = {r["method"]: r for r in d["rows"] if r["family"] == "skewed" and r["m"] == 5 and r["seed"] == seed}
        s5.append([seed, f'<code>{sel["naive"]["pattern"]}</code>'] + [f'{sel[x]["comparisons_per_char"]:.2f} / {sel[x]["search_ms"]:.2f}' for x in METHODS])
    skew5 = table(["seed", "pattern (skewed, m = 5)", "naive cmp/char / ms", "KMP", "Horspool"], s5)

    gr = load("t2/T2_grep.json")
    grows = [[r["text"], f'<code>{r["pattern"]}</code>', r["kind"], "–" if r["first_match"] is None else g(r["first_match"]),
              "yes" if r["found"] else "no", f'{r["naive_ms"]:.3f}', f'{r["kmp_ms"]:.3f}', f'{r["horspool_ms"]:.3f}', f'{r["file_read_ms"]:.2f}', f'{r["grep_ms"]:.1f}']
             for r in gr["rows"]]
    grep = table(["text", "pattern", "kind", "first match", "exists", "naive ms", "KMP ms", "Horspool ms", "read file ms", "grep ms"], grows)
    fragment = """near-periodic text ... a a a a a a a a b a a a ...      pattern a a a a b (m = 5)

naive at one window:     a=a a=a a=a a=a a≠b      5 comparisons, then move by 1
Horspool at one window:  last letter first: a≠b   1 comparison, window ends in 'a', shift[a] = 1
KMP:                     after 'aaaa' state k = 4; next text 'a' ≠ 'b' -> k = fail[3] = 3, 'a' = 'a' -> k = 4
                         2 comparisons per text letter, never more

mirror pattern b a a a a: naive fails at once on 'b' (1 comparison), Horspool walks right to left
through four matching 'a' before failing on 'b' (5 comparisons) and still moves by only 1."""
    return f"""
        <h3>Generators (text size 1,000,000, patterns of length 5, 10, 20)</h3>
        <p>All random texts use splitmix64. The main seed is 2026; every random family was also run with seeds 2027 and 2028. Patterns taken from the text start at position 500,000.</p>
        <ul>
            <li><strong>Small alphabet:</strong> uniform letters over <code>{{a, b}}</code>, and as an intermediate case over DNA <code>{{a, c, g, t}}</code>; patterns from the text.</li>
            <li><strong>Unequal frequencies:</strong> 26 letters; each position is <code>e</code> with probability 0.5, otherwise one of the other 25 letters uniformly; patterns from the text.</li>
            <li><strong>Periodic:</strong> text <code>a<sup>n</sup></code>, pattern <code>a<sup>m</sup></code> (no randomness; 1,000,000 − m + 1 overlapping matches).</li>
            <li><strong>Nearly periodic with long partial matches:</strong> each position is <code>b</code> with probability 0.01, otherwise <code>a</code>. Two patterns: <code>a<sup>m−1</sup>b</code> and the mirror <code>b a<sup>m−1</sup></code>.</li>
        </ul>
        <h3>Predictions (written before the runs)</h3>
        <ul>
            <li><strong>Small alphabet:</strong> naive about 2 comparisons per letter (the first letter matches half the time), KMP not worse than naive. Horspool loses its long shifts (both letters occur near the end of the pattern), so it should be close to the others in comparisons and probably slower in time. DNA in between.</li>
            <li><strong>Unequal frequencies:</strong> naive and KMP a little worse than uniform (about 1.3) when the pattern starts with <code>e</code>; Horspool still best but with shorter shifts when the window often ends in <code>e</code>. The first and last letters of the pattern decide.</li>
            <li><strong>Periodic:</strong> naive and Horspool compare all m letters at every position, about m·n; KMP exactly one comparison per letter. KMP wins by far.</li>
            <li><strong>Nearly periodic:</strong> for <code>a…ab</code> naive about m·n, KMP at most 2n, Horspool about n (it checks the last letter first). For <code>b a…a</code> the roles swap: naive about n, Horspool about m·n.</li>
        </ul>
        <h3>Results (seed 2026; each cell: comparisons per text letter / search ms; bold = best in the row)</h3>
        {main}
        {figure(HW / "t2/T2_chart.png", "T2 comparisons and time", "Comparisons per letter (log scale) and time for m = 20. The ranking by comparisons and the ranking by time are not always the same.")}
        <h3>Check with two further seeds</h3>
        {seeds}
        {skew5}
        <ul>
            <li>The nearly periodic results are the same to three digits for all seeds: the key conclusion (direction of comparison decides; KMP ≤ 2 per letter) is stable.</li>
            <li>DNA: Horspool is the best on every seed. Skewed: Horspool makes the fewest comparisons on every seed, but for seed 2028, m = 5 (<code>aeuee</code>, ending in the frequent <code>e</code>) it is about 3× slower than naive and KMP.</li>
            <li>Binary: naive (2.0) and KMP (1.37–1.40) are stable; Horspool is not. It ranges from 0.62 to 1.50 depending on the pattern, so on two letters its rank depends on where each letter last occurs in the pattern. This part of the prediction ("close to the others") was only true on average.</li>
        </ul>
        <h3>Fragment explaining the nearly periodic case</h3>
        {pre(fragment)}
        <h3>Where each method is most competitive</h3>
        <ul>
            <li><strong>Horspool:</strong> alphabets of four or more letters and longer patterns, especially when the pattern ends in a rare letter (uniform 26 letters, DNA, skewed with a rare last letter, <code>a…ab</code> in comparisons). Weakest when the window usually ends in a letter that is also near the end of the pattern: <code>b a…a</code> gave 16.7 comparisons per letter, its worst case m·n.</li>
            <li><strong>KMP:</strong> periodic text and many overlaps (<code>a<sup>n</sup></code>: 1.00 against 20.0, 18× faster), and it was the fastest in time on both nearly periodic patterns, also where Horspool made fewer comparisons. It never exceeded 2 comparisons per letter in any run, and on binary text its cost was the same for every pattern and seed.</li>
            <li><strong>Naive:</strong> it never won a test outright. Its closest results come when the first letter of the pattern is rare: <code>b a…a</code> (1.17 comparisons per letter against KMP's 1.00, 0.74 ms against 0.57 ms) and skewed seed 2028, where the pattern starts with the rare <code>a</code> (1.03 against 1.02, 0.81 ms against 0.71 ms), a near tie with KMP. There it beats Horspool by far: the first comparison almost always fails, so its simple loop does about one comparison per letter.</li>
            <li><strong>Comparisons versus time:</strong> branch prediction matters. Naive on skewed text costs 3.9 ms at 1.75 comparisons per letter but 0.8 ms at 1.03: when the first comparison succeeds at random half the time, the processor mispredicts often. On <code>a…ab</code> Horspool makes the fewest comparisons (1.00) but KMP (1.83) is twice as fast, because Horspool always shifts by 1 and pays the table lookup at every position.</li>
            <li><strong>Observed versus guaranteed:</strong> these inputs show typical behaviour for the chosen generators. The only general worst-case guarantee among the three is KMP's: at most 2n comparisons in the search (plus at most 2m for the failure table). Naive and Horspool are O(n·m) in the worst case, and the periodic and nearly periodic families reach that bound. Horspool's good average needs a large alphabet and is not a guarantee.</li>
        </ul>
        <h3>Comparison with grep</h3>
        <ul>
            <li><strong>Rule:</strong> one continuous line, existence only: <code>{gr["command"]}</code> with {gr["grep_version"]} (from Git for Windows). Exit status 0 means a match, 1 means none. My methods use the same search code with a sink that stops at the first match.</li>
            <li><strong>Data:</strong> the T1 text (1,000,000 letters, seed 2026) written to a file without a newline, plus <code>a<sup>n</sup></code> as a hard case. Patterns: two absent ones, the last 20 letters of the text (first match at 999,980) and one near the start. The files are written before timing; grep's answer is checked against the first-match position of all three methods.</li>
            <li><strong>Timing:</strong> median of {gr["runs"]} runs. grep is timed as the whole process (start-up, reading the file, search). My methods search the text already in memory; reading the file is shown separately. Starting grep on an empty file takes {gr["grep_startup_empty_file_ms"]:.1f} ms. grep's internal comparison count is unavailable.</li>
        </ul>
        {grep}
        <ul>
            <li>All answers agree. Almost all of grep's time is process start-up: the empty file takes 9.8 ms, a match near the start 11.8 ms. The remaining 2–3 ms for a full pass are of the same order as naive and slower than Horspool, but the start-up noise is about 1 ms, so the search itself cannot be measured precisely this way.</li>
            <li>grep does not slow down on <code>a<sup>n</sup></code> (12.5 and 12.9 ms), while naive and Horspool reach about 7 ms in their worst cases. This only shows that grep's fixed-string search (a Boyer–Moore variant with extra tricks) avoids these particular bad cases; I did not inspect its internals.</li>
            <li><strong>Difference from the all-occurrences experiments:</strong> with <code>-q</code> the search stops at the first match, so a pattern near the start costs microseconds for every method, and only absent or late patterns force a full pass. Earlier all occurrences were counted, so every method always read the whole text.</li>
        </ul>"""


def t3():
    d = load("t3/T3.json")
    txt = (HW / "t3/T3.txt").read_text(encoding="utf-8")
    edges = txt.split("suffix tree edges (child: interval -> label)\n")[1].split("\n\n")[0]
    trace_rows = []
    for tr in d["traces"]:
        trace_rows.append([f'<code>{tr["pattern"]}</code>', str(tr["occurrences"]) if tr["occurrences"] else "none",
                           "<br>".join(html.escape(x) for x in tr["trie_steps"]), "<br>".join(html.escape(x) for x in tr["tree_steps"])])
    return f"""
        <h3>Construction</h3>
        <ul>
            <li><strong>Trie:</strong> insert all 21 suffixes of <code>bananabananabandanas$</code> (including <code>$</code>) one letter per edge. Because <code>$</code> is unique, every suffix ends in its own leaf, labelled with the start position (zero-based).</li>
            <li><strong>Tree:</strong> every chain of nodes with one child is merged into one edge (<code>suffix.rs</code>). The trie and tree are checked against each other: the leaves below the end of each search are exactly the positions found by a direct scan.</li>
            <li><strong>Drawing:</strong> both are drawn by my own SVG code, left to right, with one column per text letter, so a node's horizontal position is its string depth. The trie is drawn in full (no abbreviated tails). In the tree, the long rows are the real compressed edges, not drawing shortcuts; the grey number pair under each edge is its interval.</li>
        </ul>
        <h3>Counts</h3>
        {table(["structure", "nodes", "edges", "leaves", "internal / branching nodes"], [
            ["suffix trie", d["trie_nodes"], d["trie_edges"], 21, "13 branching (including the root)"],
            ["suffix tree", d["tree_nodes"], d["tree_edges"], d["tree_leaves"], f'{d["tree_internal"]} (root + v1…v12)'],
        ])}
        <p {NOTE}>Check: the trie has one node per distinct nonempty substring (174) plus the root. The tree has 21 leaves and 13 internal nodes, all branching, so at most 2·21 nodes, as expected.</p>
        {svg("t3/T3_trie.svg", "Suffix trie of bananabananabandanas$ with the three search paths.")}
        {svg("t3/T3_tree.svg", "Suffix tree of bananabananabandanas$; edges carry their text interval [start, end).")}
        <h3>Interactive: suffix tree and suffix array</h3>
                {widget("tree")}
        <h3>Search traces</h3>
        {table(["pattern", "positions", "trie", "suffix tree"], trace_rows)}
        <ul>
            <li><code>ana</code> ends exactly at node v4; its leaves are 1, 3, 7, 9, 16.</li>
            <li><code>band</code> ends inside a compressed edge: after <code>ban</code> (node v7) only the first letter <code>d</code> of the edge <code>danas$</code> is used. The locus lies inside that edge, and the only leaf below is 12.</li>
            <li><code>nabx</code> follows <code>n</code>, <code>a</code>, then the edge <code>ban</code>: <code>b</code> matches, <code>x ≠ a</code> fails inside the edge. In the trie the node <code>nab</code> has only the child <code>a</code>.</li>
        </ul>
        <h3>Storing an edge as a text interval</h3>
        <p>An edge label is always a substring of the text, so it is stored as two numbers <code>[start, end)</code> instead of letters. If a suffix starting at <code>s</code> passes through the edge and the edge goes from string depth <code>d₁</code> to <code>d₂</code>, then the label is <code>text[s+d₁ .. s+d₂)</code>. For example the edge v7 → v8 is <code>[3, 9)</code> = <code>anaban</code>. Every edge then takes constant space, so the tree needs O(n) memory, while the trie needs one node per distinct substring, O(n²) in general. All 33 edges:</p>
        {pre(edges)}"""


def t4():
    d = load("t4/T4.json")
    txt = (HW / "t4/T4.txt").read_text(encoding="utf-8")
    sa_table = txt.split("suffix array of bananabananabandanas$\n")[1].split("\n\n")[0]
    traces = "\n\n".join(block for block in txt.split("\n\n") if block.startswith("pattern "))
    small = table(["pattern", "interval [lo, hi)", "SA values", "positions", "char comparisons", "T3 tree"],
                  [[f'<code>{s["pattern"]}</code>', f'[{s["lo"]}, {s["hi"]})', str(s["positions"]), str(s["positions"]) if s["positions"] else "none",
                    s["comparisons"], "same"] for s in d["small"]["searches"]])
    big = []
    for L in d["large"]:
        for r in L["rows"]:
            big.append([L["text"], r["m"], f'{r["avg_occurrences"]:.1f}', f'{r["sa_comparisons_per_query"]:.0f}', f'{r["sa_us_per_query"]:.2f}',
                        g(r["naive_comparisons_per_query"]), f'{r["naive_us_per_query"]:.0f}', g(r["kmp_comparisons_per_query"]), f'{r["kmp_us_per_query"]:.0f}',
                        g(r["horspool_comparisons_per_query"]), f'{r["horspool_us_per_query"]:.0f}', f'{r["crossover_queries"]:.0f}'])
    build = table(["text", "construction ms", "suffix array bytes", "text bytes", "working memory during construction"],
                  [[L["text"], f'{L["construction_ms"]:.0f}', g(L["index_bytes"]), g(L["text_bytes"]), f'about {g(L["construction_working_bytes"])}'] for L in d["large"]])
    checks = table(["text", "queries (m = 10)", "build + queries ms", "Horspool scans ms", "faster"],
                   [[L["text"], c["queries"], f'{c["index_total_ms"]:.0f}', f'{c["scan_total_ms"]:.0f}', "index" if c["index_total_ms"] < c["scan_total_ms"] else "scanning"]
                    for L in d["large"] for c in L["crossover_checks"]])
    return f"""
        <h3>Suffix array of the marked text</h3>
        {pre(sa_table)}
        <h3>Interval search</h3>
        <ul>
            <li><strong>Constructor (own):</strong> prefix doubling in the style of Manber and Myers. Suffixes are sorted by the pair (rank of the first k letters, rank of the next k letters), k = 1, 2, 4, …, until all ranks differ; each round is a sort, so O(n log² n). Suffixes are never copied; only rank arrays are kept. It is checked against sorting suffix slices on 2,000 random texts and on <code>a<sup>5000</sup></code>.</li>
            <li><strong>Lower bound:</strong> the first rank whose suffix is not smaller than the pattern. <strong>Upper bound:</strong> the first rank whose first m letters are greater than the pattern. Both are binary searches over ranks; one comparison step compares the pattern with the start of a suffix letter by letter until the first difference, and every letter pair is counted. The answer is the rank interval <code>[lo, hi)</code>; the count is <code>hi − lo</code>, the positions are <code>SA[lo..hi)</code>.</li>
        </ul>
        {small}
        <details><summary style="font-size: 14px;">Binary-search traces</summary>{pre(traces)}</details>
        <h3>Large texts</h3>
        <p>The T1 text (26 letters, seed 2026) and the contrasting DNA text from T2 (seed 2026). For each length 50 patterns are taken from random positions (fixed seed) and used for all methods. All methods produce counts only: the index returns <code>hi − lo</code>, the scans count matches. The counts are checked to be equal.</p>
        {build}
        {table(["text", "m", "avg matches", "SA cmp", "SA µs", "naive cmp", "naive µs", "KMP cmp", "KMP µs", "Horspool cmp", "Horspool µs", "repays after"], big)}
        <p {NOTE}>Per query; scan times include pattern preprocessing. "Repays after" = construction time / (Horspool time − index time per query), i.e. against the fastest scan.</p>
        <h3>Measured check around the estimate</h3>
        {checks}
        <ul>
            <li>With half the estimated number of queries the scans are faster; with twice as many the index (including its construction) is faster, so the crossover lies between, as estimated.</li>
            <li>A query on the index costs about 0.2–0.4 µs, three to four orders of magnitude less than a scan: two binary searches take about 2·log₂ n ≈ 40 steps, each comparing only a few letters (110–250 comparisons per query in total), and this grows only logarithmically with the text length. Even with 981 matches (DNA, m = 5) a count costs the same, because the interval gives the count directly.</li>
            <li>The index repays sooner on DNA (fewer queries), because scans are slower on four letters while construction costs about the same. On 26 letters, longer patterns repay later because Horspool itself gets faster.</li>
            <li>Memory: the final index is 4 bytes per letter (4 MB) plus the text; construction temporarily uses about three arrays of 4 bytes per letter.</li>
        </ul>"""


def rotation_table(t):
    rows = []
    n = len(t["text"])
    for r in t["rotations"]:
        rot = r["rotation"]
        style = ' style="background: #fef3c7;"' if r["original"] else ""
        rows.append(f'<tr{style}><td {TD}>{r["row"]}</td><td {TD}>{r["start"]}</td>'
                    f'<td {TD} style="background: #dbeafe; font-weight: bold;">{rot[0]}</td><td {TD}>{rot[1:n - 1]}</td>'
                    f'<td {TD} style="background: #fee2e2; font-weight: bold;">{rot[-1]}</td><td {TD}>{r["rank"]}</td>'
                    f'<td {TD}>{"original text" if r["original"] else ""}</td></tr>')
    head = "".join(f"<th {TD}>{x}</th>" for x in ["row", "SA", "F", "middle", "L (BWT)", "copy # of L", ""])
    return ('<div style="overflow-x: auto;"><table style="border-collapse: collapse; margin: 15px 0; font-family: monospace; font-size: 14px;">'
            f'<thead><tr style="background: #e2e8f0;">{head}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>')


def runs(s):
    out = []
    for c in s:
        if out and out[-1][0] == c:
            out[-1][1] += 1
        else:
            out.append([c, 1])
    return out


def t5():
    d = load("t5/T5.json")
    m, o = d["main"], d["own"]
    steps = table(["step", "row", "L[row]", "copy #", "next row = C[letter] + copy #", "text so far"],
                  [[s["step"], s["row"], s["letter"], s["rank"], s["next"], f'<code>{s["known"]}</code>'] for s in m["decode"]], mono=True)
    own_steps = table(["step", "row", "L[row]", "copy #", "next row", "text so far"],
                      [[s["step"], s["row"], s["letter"], s["rank"], s["next"], f'<code>{s["known"]}</code>'] for s in o["decode"]], mono=True)
    fmt = lambda s: " ".join(f"{c}{k}" for c, k in runs(s))
    run_table = table(["string", "runs", "longest run", "run lengths"], [
        [f'text <code>{m["text"]}</code>', m["runs_text"], max(k for _, k in runs(m["text"])), f'<code>{fmt(m["text"])}</code>'],
        [f'BWT <code>{m["bwt"]}</code>', m["runs_bwt"], max(k for _, k in runs(m["bwt"])), f'<code>{fmt(m["bwt"])}</code>'],
        [f'own text <code>{o["text"]}</code>', o["runs_text"], max(k for _, k in runs(o["text"])), f'<code>{fmt(o["text"])}</code>'],
        [f'own BWT <code>{o["bwt"]}</code>', o["runs_bwt"], max(k for _, k in runs(o["bwt"])), f'<code>{fmt(o["bwt"])}</code>'],
    ])
    code = """encode(text):                           // text ends with the unique, smallest marker $
    SA = suffix_array(text)
    return [ text[(SA[i] - 1) mod n] for i in 0..n ]

decode(L):
    copy[i]  = number of earlier positions j < i with L[j] = L[i]
    C[c]     = number of letters in L smaller than c      // first row of c in F
    row = 0                                             // row 0 starts with $
    out = "$"
    repeat n - 1 times:
        c   = L[row]                                    // the letter before the current one
        out = c + out
        row = C[c] + copy[row]                          // LF mapping: same copy of c in F
    return out"""
    return f"""
        <h3>Sorted rotations</h3>
        <p>F (blue) is the first column, L (red) the last column; the yellow row is the original text. The rotation table is used only for this small example (n = 21); the large texts would need n² letters.</p>
        {rotation_table(m)}
        {pre("F   = " + m["first"] + chr(10) + "BWT = " + m["bwt"])}
        <ul>
            <li><strong>From the suffix array:</strong> because <code>$</code> is unique and smallest, sorting rotations is the same as sorting suffixes, so <code>BWT[i] = text[SA[i] − 1]</code>, wrapping around for <code>SA[i] = 0</code> (that row gets <code>$</code>). The suffix array from T4 gives exactly the same string. A random test of 2,000 texts confirms that both constructions agree and decode back.</li>
        </ul>
        <h3>Encoder and decoder</h3>
        {pre(code)}
        <p>Decoding the shared example (all 20 steps):</p>
        {steps}
        <p>The result is <code>{m["text"]}</code>, identical to the original.</p>
        <h3>Interactive: rotation matrix, decoding links and backward search</h3>
                {widget("bwt")}
        <ul>
            <li><strong>Repeated letters:</strong> the rows that start with a letter c are sorted by what follows c. The rows that end with c are sorted by the same continuation (it is at the front of those rows). So the k-th <code>a</code> in L is the k-th <code>a</code> in F; the copy number tells the copies apart. For example, step 2 reads the copy #8 of <code>a</code> in row 20 and jumps to <code>C[a] + 8 = 1 + 8 = 9</code>.</li>
            <li><strong>The end marker:</strong> it is unique and smallest, so the decoder knows the start row (row 0, the rotation beginning with <code>$</code>) without storing the index of the original row, and it ensures that all rotations are different, which is what links the BWT to the suffix array. Without it the transform is not reversible: <code>BWT(banana) = BWT(ananab) = {d["without_end_marker"]["banana"]}</code>, so rotations of the same text cannot be told apart.</li>
        </ul>
        <h3>Runs</h3>
        {run_table}
        <p>The shared text has no two equal neighbours (21 runs of length 1). In the BWT the same letters form 10 runs, the longest being seven <code>a</code>: almost every <code>a</code> in the text is followed by <code>n</code> or <code>b</code>, so the rows starting with <code>na…</code>, <code>ba…</code> are next to each other and their last letters are mostly <code>a</code>. The BWT is only a permutation of the letters: it has exactly the same length and letter counts, so by itself it saves nothing. It helps compression because the grouped letters can then be coded cheaply by run-length or move-to-front coding followed by an entropy coder.</p>
        <h3>Own example: <code>{o["text"]}</code> (19 letters + $)</h3>
        {pre("text    = " + o["text"] + chr(10) + "BWT     = " + o["bwt"] + chr(10) + "decoded = " + o["decode"][-1]["known"] + "   (identical)")}
        <details><summary style="font-size: 14px;">Decoding steps of the own example</summary>{own_steps}</details>
        <p><strong>Difference from the shared example:</strong> here the text already has runs (<code>ll</code>) and the repetition is of a longer block (<code>lollipop</code>) rather than of a two-letter period. The number of runs drops from 18 to 10, but the longest run grows only from 2 to 3: the contexts are more varied (<code>l</code> is preceded by <code>o</code>, <code>l</code>, <code>p</code> or <code>$</code>), so letters are grouped into many short runs instead of one long run like the seven <code>a</code> of the shared example.</p>"""


def b1():
    d = load("b1/B1.json")
    blocks = []
    for s in d["searches"]:
        rows = [[f'<code>{x["letter"]}</code>', f'<code>{x["suffix"]}</code>', f'[{x["lo"]}, {x["hi"]})', x["hi"] - x["lo"], html.escape(x["locus"])] for x in s["steps"]]
        blocks.append(f'<p><strong><code>{s["pattern"]}</code></strong> (start with [0, 21))</p>' +
                      table(["letter read", "pattern suffix so far", "interval", "size", "locus in the suffix tree"], rows))
    return f"""
        <ul>
            <li><strong>Data:</strong> L = BWT = <code>{d["bwt"]}</code>. <code>C[c]</code> = number of letters smaller than c: <code>$:0 a:1 b:10 d:13 n:14 s:20</code>. <code>occ(c, i)</code> = copies of c in <code>L[0..i)</code> (counted directly; for a small example no sampled rank table is needed).</li>
            <li><strong>Backward search:</strong> read the pattern from right to left, starting with all rows <code>[0, 21)</code>. With letter c: <code>lo = C[c] + occ(c, lo)</code>, <code>hi = C[c] + occ(c, hi)</code>. This is the LF mapping from T5 applied to a whole block of rows: the rows whose suffix starts with the current string and whose previous letter is c become the rows that start with c + string.</li>
        </ul>
        {"".join(blocks)}
        <p>The final intervals are the same as the T4 binary searches (<code>ana</code> [3, 8), <code>band</code> [12, 13)); translated with the suffix array they give the T3 positions 1, 3, 7, 9, 16 and 12. <code>nabx</code> becomes empty at the very first step, because <code>x</code> does not occur in the text at all; the forward tree search in T3 only noticed this after matching <code>nab</code>.</p>
        {svg("b1/B1_loci.svg", "Loci of the final FM intervals in the suffix tree (diamonds) and their descendant leaves (framed).")}
        <ul>
            <li><strong>Connection:</strong> a suffix-array interval is a set of consecutive ranks; in the suffix tree the same suffixes are exactly the leaves below one locus, because the leaves of any subtree are consecutive in lexicographic order. The interval for <code>ana</code> is the 5 leaves below node v4; for <code>band</code> it is the single leaf 12 below the point one letter into the edge <code>danas$</code>.</li>
            <li>Backward search does not walk this path. It visits the loci of <code>a</code>, <code>na</code>, <code>ana</code> (v1, v10, v4), which lie in different parts of the tree, because it prepends letters. Only the final result, the set of suffixes starting with the pattern, is the same. The FM index here only answers counting and locating, not the other suffix-tree operations.</li>
        </ul>"""


def setup():
    return """
        <ul>
            <li><strong>Code:</strong> Rust 1.98 (edition 2024, release build), only dependency <code>serde_json</code> for output files. All search methods, the suffix trie and tree, the suffix array constructor and interval search, the BWT encoder/decoder and the FM backward search are my own code. The drawings are SVG produced by my own code (<code>draw.rs</code>); the T2 chart and this report are produced by <code>make_report.py</code> (Python, Matplotlib).</li>
            <li><strong>Running:</strong> <code>cargo run --release --bin t1</code> (likewise <code>t2</code>, <code>t2_grep</code>, <code>t3</code>, <code>t4</code>, <code>t5</code>, <code>b1</code>); outputs (JSON, text traces, SVG) go to <code>t1/</code>–<code>t5/</code> and <code>b1/</code>. Each program checks its answers with assertions before writing results.</li>
            <li><strong>Shared rules:</strong> all matches including overlaps, zero-based positions; empty patterns are rejected. Every inspected letter pair is counted once, mismatches included; preprocessing is counted and timed separately. Inputs are generated and answers checked outside the timed region. Timed runs only count matches. The reported time is the median of 7 runs (Windows 11, wall-clock <code>Instant</code>).</li>
            <li><strong>Assistance:</strong> an AI coding assistant (Claude) helped to write the code and the report text. The choice of methods, generator families, predictions and the grep rule were mine; I checked the code, the tests and the results.</li>
        </ul>"""


def main():
    body = (section("Setup and Notes", setup(), True)
            + section("Task T1: Three exact-search methods", t1())
            + section("Task T2: Make the data change the result", t2())
            + section("Task T3: Suffix trie and suffix tree", t3())
            + section("Task T4: Suffix array and interval search", t4())
            + section("Task T5: Burrows–Wheeler transform", t5())
            + section("Bonus B1: BWT as a search index", b1()))
    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>HW12. Text search: experiments, suffix structures and BWT</title>
    <meta name="reference" content="Rust | https://www.rust-lang.org/">
    <meta name="reference" content="serde_json | https://crates.io/crates/serde_json">
    <meta name="reference" content="GNU grep | https://www.gnu.org/software/grep/">
    <meta name="reference" content="Python, Matplotlib (chart and report) | https://matplotlib.org/">
    <meta name="reference" content="Claude (Anthropic), AI coding assistant | https://claude.ai/">
    <link rel="stylesheet" href="../../styles.css">
    <script src="../../header.js" defer></script>
    <script src="../../footer.js" defer></script>
</head>
<body>
{body}</body>
</html>
"""
    (HW / "report.html").write_text(page, encoding="utf-8")
    print(len(page))


main()

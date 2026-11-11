import base64
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

from nb import word_helpers
from words import MODELS, distance, load_levels

SRC = Path(__file__).resolve().parent
HW = SRC.parent
plt = word_helpers()["plt"]

TD = 'style="padding: 10px; border: 1px solid #cbd5e1;"'
NOTE = 'style="font-size: 13px; color: #475569;"'
FULL = 150 * 150 * 100


def table(headers, rows):
    head = "".join(f"<th {TD}>{x}</th>" for x in headers)
    body = ""
    for i, row in enumerate(rows):
        bg = ' style="background: #f8fafc;"' if i % 2 else ""
        body += f"<tr{bg}>" + "".join(f"<td {TD}>{c}</td>" for c in row) + "</tr>\n"
    return ('<div style="overflow-x: auto;"><table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px; text-align: left;">\n'
            f'<thead><tr style="background: #e2e8f0; color: #333;">{head}</tr></thead>\n<tbody>\n{body}</tbody>\n</table></div>')


def figure(path, alt, caption=None, width=1100):
    img = Image.open(path).convert("RGB")
    if img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    uri = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    text = f'<p style="font-size: 13px; text-align: center; margin-top: 4px;">{caption}</p>' if caption else ""
    return (f'<div><img src="{uri}" alt="{alt}" style="width: 100%; height: auto; border: 1px solid #ccc; '
            f'border-radius: 4px; margin-top: 10px;">{text}</div>')


def widget(name, **data):
    html = (SRC / "widgets" / name).read_text(encoding="utf-8")
    for key, value in data.items():
        html = html.replace(key, json.dumps(value, separators=(",", ":")))
    return html


def dtw_data():
    a = np.array(Image.open(HW / "HW11_pyramid_A.png")).astype(int)
    b = np.array(Image.open(HW / "HW11_pyramid_B.png")).astype(int)
    return {"query": a[55].tolist(), "B": b.tolist(), "truth": 63}


def load(name):
    return json.loads((SRC / name).read_text(encoding="utf-8"))


def g(x):
    return f"{x:g}"


def edit_rows(edits):
    return [[str(n), what.replace("->", "→"), g(cost), f"<code>{word}</code>"] for n, (what, cost, word) in enumerate(edits, 1)]


t1 = load("t1/T1.json")
unit, swap = t1["unit"], t1["swap"]
t1_html = f"""<details>
    <summary>Task T1: Build the edit-distance matrix</summary>
    <div class="details-content">

        <h3>Method</h3>
        <ul>
            <li><strong>Table:</strong> <code>DIST[i, j]</code> is the cheapest way to turn the first i letters of <code>causality</code> into the first j letters of <code>casualty</code>. Row 0 and column 0 are the empty prefixes (j insertions, i deletions), as in the starter.</li>
            <li><strong>Recurrence (unit costs):</strong> the table is a grid graph whose edges only go down, right or diagonally, so the shortest path to a cell is the best of its three predecessors:
                <pre>DIST[i, j] = min( DIST[i−1, j]   + 1,                                delete source[i]
                  DIST[i, j−1]   + 1,                                insert target[j]
                  DIST[i−1, j−1] + (0 if source[i] = target[j] else 1) )   keep / substitute</pre>
                The table is filled row by row, so all three predecessors are already known. The distance is <code>DIST[9, 8]</code>.</li>
            <li><strong>Traceback:</strong> from the bottom-right cell, step back to a predecessor whose value plus the step cost gives the current value (preference: diagonal, then deletion, then insertion). Each step is one edit. The edits are then applied to <code>causality</code> in forward order, and the script checks that the result is <code>casualty</code> and that the costs add up to the distance.</li>
            <li><strong>Changed rule: A, adjacent swap at cost 1.</strong> A fourth edge from <code>DIST[i−2, j−2]</code> with cost 1, allowed when <code>source[i−1..i]</code> equals <code>target[j−1..j]</code> reversed. All other costs are unchanged.</li>
            <li><strong>Prediction (before recomputing):</strong> the words differ by the swapped pair <code>us</code>/<code>su</code> and one extra <code>i</code>. With unit costs the swap needs two edits, with rule A one, so the distance should drop from 3 to 2, and only cells from the swapped pair on should change.</li>
        </ul>

        <h3>Interactive table</h3>
        <p>The same recurrence and traceback in JavaScript, for any pair of words and all three rules (unit, A and B). <em>Animate</em> fills the table cell by cell; hovering over a cell shows the candidates of the minimum and marks the predecessors that give it. The static results below are from the Python code.</p>
        {widget("edit_widget.html")}

        <h3>Results: unit costs, distance {g(unit["distance"])}</h3>
        {figure(SRC / "t1" / "T1_unit.png", "Unit-cost heatmap", "Unit-cost matrix drawn by the course helper, with the traceback path")}
        {table(["#", "Edit", "Cost", "Word after the edit"], edit_rows(unit["edits"]))}

        <h3>Results: rule A, distance {g(swap["distance"])}</h3>
        {figure(SRC / "t1" / "T1_swap.png", "Rule A heatmap", "Matrix with the adjacent swap; the path jumps from (ca, ca) to (caus, casu) in one swap step")}
        {table(["#", "Edit", "Cost", "Word after the edit"], edit_rows(swap["edits"]))}

        <h3>Discussion</h3>
        <ul>
            <li><strong>The prediction holds:</strong> the distance drops from 3 to 2. The changed cell is <code>DIST[caus, casu]</code>: with unit costs it is 2 (two substitutions u→s, s→u after the common <code>ca</code>), with rule A it is <code>DIST[ca, ca] + 1 = 1</code> through the swap edge.</li>
            <li>The saving propagates: the cells after the swapped pair on the path are 1 lower, while the cells before it are identical in both tables. The rest of the path (keep <code>al</code>, delete <code>i</code>, keep <code>ty</code>) is the same.</li>
            <li>The unit-cost traceback is not the only optimal one; e.g. deleting <code>u</code> and inserting it after <code>s</code> also costs 2 for the pair. The script picks one path by the fixed preference order.</li>
        </ul>
    </div>
</details>
"""

t2 = load("t2/T2.json")
levels = load_levels()
t2_rows = []
for model in MODELS:
    row = [model.replace("swap", "soft swap") if model == "weighted+swap" else model]
    for level in (1, 3, 6):
        c = t2["counts"][f"{model} L{level}"]
        row.append(" / ".join(str(c.get(k, 0)) for k in ("unique correct", "tie including original", "miss")))
    t2_rows.append(row)
q_rows = []
for q in t2["queries"]:
    cells = [str(q["level"]), str(q["row"]), f"<code>{q['query']}</code>", q["truth"]]
    for model in ("unit", "weighted", "weighted+swap"):
        r = q[model]
        mark = {"unique correct": "", "tie including original": " (tie)", "miss": " <strong>miss</strong>"}[r["outcome"]]
        win = "" if r["outcome"] == "unique correct" else ": " + ", ".join(r["winners"]) + f" ({g(round(r['cost'], 2))})"
        cells.append(f"{g(round(r['truth_cost'], 2))}{mark}{win}")
    q_rows.append(cells)
change_rows = []
for model in ("weighted+strict swap", "weighted+swap"):
    change_rows.append([model.replace("swap", "soft swap") if model == "weighted+swap" else model] + [
        str(sum(distance(levels[level][r], levels[0][r], model) != distance(levels[level][r], levels[0][r], "weighted") for r in range(100)))
        for level in range(1, 7)])

t2_html = f"""<details>
    <summary>Task T2: Compare three models</summary>
    <div class="details-content">

        <h3>Method</h3>
        <ul>
            <li><strong>Queries:</strong> rows 0, 10, …, 90 of levels 1, 3 and 6 (30 queries), each compared with all 100 originals. <code>search</code> returns <strong>all</strong> words with the minimum cost; the notebook's <code>outcome</code> and <code>evaluate</code> count the three outcomes.</li>
            <li><strong>One distance function</strong> <code>distance(source, target, model)</code> (in <code>words.py</code>, using the DP of <code>edit.py</code>) with the same recurrence as T1; only the substitution cost and the optional swap edge depend on the model. Costs are integers internally (1 = 5 units, 0.2 = 1 unit), so ties are exact.</li>
            <li><strong>Model 1, unit:</strong> insert, delete, substitute 1; equal letters 0.</li>
            <li><strong>Model 2, weighted:</strong> insert and delete 1; substitution 0.2 if the letters differ only in case (<code>a↔A</code>) or form a similar pair, otherwise 1. Similar pairs (chosen after looking at the corruptions in the data): <code>a↔ä</code>, <code>e↔ë</code>, <code>o↔ö</code>, <code>u↔ü</code> and <code>l↔i</code>. They are compared after lower-casing, so a case change inside a pair is also cheap (<code>Ä↔a</code>, <code>L↔i</code>, <code>I↔l</code> all cost 0.2).</li>
            <li><strong>Model 3, weighted + swap:</strong> model 2 plus a swap of two adjacent letters. A strict swap (letters must be exactly equal) did not change a single test score, because from level 3 on the swapped letters are usually also re-cased (<code>…riDS…</code> for <code>…rdis…</code>). I therefore use a <em>soft</em> swap: allowed when each swapped letter matches up to case or a similar pair, cost 1 plus 0.2 for each such letter. The strict version is kept as an extra row for comparison.</li>
            <li><strong>Checks:</strong> the T1 values (3 with unit costs, 2 with the swap), empty words (cost = length), a case-only change, a similar-letter substitution (also with case) and a swap give the expected costs.</li>
        </ul>

        <h3>Results</h3>
        {table(["Model", "Level 1", "Level 3", "Level 6"], t2_rows)}
        <p {NOTE}>Each cell: unique correct / tie including original / miss, out of 10 queries.</p>
        <p>Cost of the correct original for every query; where the original is not the unique winner, the winners and their cost are given:</p>
        {table(["Level", "Row", "Query", "Original", "unit", "weighted", "weighted + soft swap"], q_rows)}
        <p>Number of the 100 words per level for which a swap model lowers the cost of the correct original compared with model 2:</p>
        {table(["Model", "L1", "L2", "L3", "L4", "L5", "L6"], change_rows)}

        <h3>Discussion</h3>
        <ul>
            <li><strong>Example where the model changes the winner:</strong> <code>RecombiatRioilTY</code> (level 6, row 30). With unit costs every capital letter is a full substitution, and <code>recombinationally</code> (cost 7) beats the original <code>recombinatoriality</code> (cost 9): a miss. With the weighted model the four capitals cost 0.2 each and the <code>l/i</code> confusion 0.2, so the original costs 4.2 and wins uniquely. At level 3 the same row gives a unit-cost tie between <code>recombinatorial</code> and <code>recombinatoriality</code>, which the weighted model also resolves.</li>
            <li><strong>Example where the swap changes the score:</strong> <code>LniaxriDShipltnäRy</code> → <code>interdisciplinary</code> (level 6, row 0) costs 7.8 with model 2 and 7.0 with the soft swap: the two substitutions <code>i→d</code>, <code>D→i</code> (1 + 1) become one swap <code>iD→di</code> (1 + 0.2). The strict swap does not apply here because of the capital D, so it stays at 7.8.</li>
            <li><strong>The weighted model is enough for these queries:</strong> it finds all 30 originals uniquely, so the swap cannot improve the counts. Case changes and look-alike letters are the dominant corruption from level 3 on; they make unit-cost scores grow fast (e.g. 10 for <code>IniaxriDShipltnaRy</code>), while the weighted model treats them as minor. Swaps are rarer, and on the 30 test words they only lower the cost of the word that already wins.</li>
            <li>The weighted model is designed for exactly these corruptions. On other data (e.g. real misspellings) the cheap <code>l/i</code> pair could also make wrong words cheaper; with 100 long and dissimilar words this does not happen here.</li>
        </ul>
    </div>
</details>
"""

t3 = load("t3/T3.json")
spans, pos = [], 0
for level in range(1, 7):
    for row, word in enumerate(levels[level]):
        spans.append((pos, pos + len(word), level, row, word, levels[0][row]))
        pos += len(word)


def source_of(start):
    s = next(x for x in spans if x[0] <= start < x[1])
    return f"level {s[2]}, row {s[3]}: <code>{s[4]}</code> ({s[5]})"


t3_tables = {model: table(["Rank", "Cost", "Start", "End", "Matched text", "Inside word"],
                          [[str(n), g(round(hit["cost"], 2)), str(hit["start"]), str(hit["end"]), f"<code>{hit['text']}</code>", source_of(hit["start"])]
                           for n, hit in enumerate(t3[model], 1)]) for model in ("unit", "weighted+swap")}
t3_html = f"""<details>
    <summary>Task T3: Find the five best matches in a longer text</summary>
    <div class="details-content">

        <h3>Method</h3>
        <ul>
            <li><strong>Query</strong> <code>{t3["query"]}</code> (original row 0); <strong>text</strong>: all words of levels 1–6 joined without separators ({t3["length"]:,} characters).</li>
            <li><strong>Semi-global DP</strong> (<code>match.py</code>): the same table with the query letters as rows and the text letters as columns, with two changes. The first row is all zeros, so the path may start in any column (text before the match is free). The answer is the minimum of the last row, so the path may end in any column (text after the match is free). The first column still counts deletions of query letters, so the whole query must be aligned.</li>
            <li><strong>Start of the match:</strong> each cell stores the column where its path left row 0, copied from the chosen predecessor. The function returns <code>(cost, start, end)</code>, zero-based and end-exclusive.</li>
            <li><strong>Ties and nonempty matches:</strong> among equal predecessors the order is diagonal, insertion, deletion; among equal end cells the leftmost wins. Ends whose path consumed no text (start = end) are skipped. Checks: <code>best_match("cat", "xxcutyy") == (1, 2, 5)</code> and <code>best_match("a", "b") == (1, 0, 1)</code>.</li>
            <li>The notebook's <code>top_five</code> calls this function on the unreported parts of the text. The cost of every returned substring was recomputed with the T2 distance function and agrees.</li>
            <li><strong>Optional:</strong> the same matcher with the weighted + soft swap model from T2.</li>
        </ul>

        <h3>Results: unit costs</h3>
        {t3_tables["unit"]}
        <h3>Results: weighted + soft swap</h3>
        {t3_tables["weighted+swap"]}

        <h3>Discussion</h3>
        <ul>
            <li>The best hit is the level 1 corruption of the query itself (cost 3, the same as in T2, because the matched substring is the whole word).</li>
            <li><strong>Free ends find suffixes of other words:</strong> ranks 2 and 3 are inside <code>multcdisipliary</code> (<code>multidisciplinary</code>, levels 1 and 2). Its ending <code>…disciplinary</code> is shared with the query, the free prefix drops <code>m</code>, and only <code>inter</code> against <code>ult</code> plus the corruptions has to be paid. So a different word outranks the level 2 copy of the query (cost 7).</li>
            <li><strong>Matches can be trimmed:</strong> rank 5 (level 3 copy) starts two letters into the word, because deleting the query's first letters is cheaper than matching the corrupted <code>In</code>.</li>
            <li><strong>Weighted model:</strong> the level 2 copy of the query improves to cost 6, but the cheap case changes help the look-alike word just as much: <code>multidisciplinary</code> stays at ranks 2–3 (5.2), and its level 3 copy <code>ltcdIsIpLiaRy</code> enters at rank 5. A model of the corruptions cannot separate words that share long parts.</li>
        </ul>
    </div>
</details>
"""

t4 = load("t4/T4.json")


def top(scores, k=5):
    return sorted(range(len(scores)), key=lambda y: (scores[y], y))[:k]


t4_rows = [[name, str(t4[key + "_y"]), f"{t4[key + '_scores'][t4[key + '_y']]:,.0f}",
            ", ".join(str(y) for y in top(t4[key + "_scores"])), str(t4[key + "_rank_truth"]), f"{t4[key + '_scores'][t4['truth_y']]:,.0f}"]
           for name, key in (("Pointwise", "point"), ("DTW, unrestricted", "dtw"))]
t4_html = f"""<details>
    <summary>Task T4: One query against 100 rows</summary>
    <div class="details-content">

        <h3>Method</h3>
        <ul>
            <li><strong>Data:</strong> the supplied <code>HW11_pyramid_A.png</code> and <code>HW11_pyramid_B.png</code> (100 × 150, loaded and hash-checked by the notebook's <code>load_pair</code>, not resized). Query: row 55 of A. Candidates: all 100 rows of B.</li>
            <li><strong>Pointwise score:</strong> <code>Σ (query[x] − row[x])²</code> over the 150 columns.</li>
            <li><strong>DTW</strong> (<code>dtw.py</code>), global with squared local cost:
                <pre>D[0, 0] = 0,   D[i, 0] = D[0, j] = ∞
D[i, j] = (query[i] − row[j])² + min(D[i−1, j], D[i, j−1], D[i−1, j−1])</pre>
                score = <code>D[150, 150]</code>. Steps (1,0), (0,1), (1,1). The local cost is paid for every cell on the path, so stretching is paid by matching the same sample several times.</li>
            <li><strong>Ranking:</strong> the lowest score wins, ties go to the smaller row. Only after ranking, the known transformation (shift by 8 rows) gives the true counterpart, row {t4["truth_y"]}, for the evaluation.</li>
        </ul>

        <h3>Results</h3>
        {table(["Method", "Winner", "Winning score", "Top 5 rows", f"Rank of row {t4['truth_y']}", f"Score of row {t4['truth_y']}"], t4_rows)}
        {figure(SRC / "t4" / "T4_row_search.png", "Row search", "Course helper figure: marked rows, scores of all 100 candidates and the brightness profiles at equal columns")}

        <h3>Discussion</h3>
        <ul>
            <li><strong>Pointwise fails:</strong> it picks row 11 (plain sky) and ranks the true row only 21st. B is squeezed in the middle and stretched at the sides, so the same features are at other columns. Each misplaced dark feature is paid twice (dark against bright at its old place and bright against dark at the new one). A flat mid-grey sky row (brightness about 122) is a cheaper compromise than the true, shifted row.</li>
            <li><strong>DTW finds row 63</strong> with a clear margin (score 4,753; the next, row 62, has 12,510); the neighbouring rows 60–62 and 69 follow, as expected for nearby scanlines.</li>
            <li><strong>Brightness feature:</strong> the step from the dark pyramid base to the bright sand (above 150) is at column 119 in the query and at column 106 in B[63]; the first dark shadow (below 80) starts at column 19 in the query and at 30 in B[63]. The left side of B is stretched (features move right), the right side is compressed toward the middle (features move left). Pointwise compares these steps at the wrong columns; DTW aligns them (see the alignment in T5).</li>
        </ul>
    </div>
</details>
"""

t5 = load("t5/T5.json")
scan = t5["scan"]
fig, axes = plt.subplots(1, 3, figsize=(14, 3.8), layout="constrained")
w = [s["band"] for s in scan]
axes[0].plot(w, [s["truth_rank"] for s in scan], marker="o", ms=3)
axes[0].set(xlabel="Band width w", ylabel="Rank of row 63", title="Rank of the true row", yscale="log")
axes[1].plot(w, [s["truth_cost"] for s in scan], marker="o", ms=3, color="#147486")
axes[1].axhline(t5["score"], color="grey", ls="--", label="unrestricted")
axes[1].set(xlabel="Band width w", ylabel="DTW cost of row 63", title="Cost of the true row")
axes[1].legend()
axes[2].plot(w, [s["cells"] / FULL * 100 for s in scan], marker="o", ms=3, color="#bd6413")
axes[2].set(xlabel="Band width w", ylabel="% of unrestricted cells", title="Work over all 100 rows")
for ax in axes:
    ax.grid(alpha=0.3)
fig.savefig(SRC / "t5" / "T5_band_scan.png", dpi=110)
plt.close(fig)
narrow = next(s for s in scan if all(x["winner"] == 63 for x in scan if x["band"] >= s["band"]))
full = next(s for s in scan if all(x["truth_cost"] == t5["score"] for x in scan if x["band"] >= s["band"]))
deviation = max(abs(i - j) for i, j in t5["path"])
t5_rows = [[str(r["band"]), str(r["winner"]), str(r["truth_rank"]), f"{r['winning_cost']:,.0f}", f"{r['cells']:,}", f"{r['cells'] / FULL:.1%}"]
           for r in t5["rows"]]
t5_html = f"""<details>
    <summary>Task T5: How wide a band is enough?</summary>
    <div class="details-content">

        <h3>Method</h3>
        <ul>
            <li>Same A, B, query and DTW as in T4; the band only restricts the cells of the table: cell (i, j) is evaluated only if <code>|i − j| ≤ w</code>, all other cells stay ∞. All 100 rows are still searched.</li>
            <li>Widths 0, 4, 12 and unrestricted as required, plus a scan of every w from 0 to 40 to find the narrowest band that works. "Cells" counts the evaluated interior cells over all 100 rows (unrestricted: 150 × 150 × 100 = {FULL:,}).</li>
            <li><strong>Check:</strong> with w = 0 only the diagonal is left, and the scores equal the T4 pointwise scores exactly (asserted in the script).</li>
            <li><strong>Prediction (before running):</strong> the squeeze moves the 25% mark to 40% and the 70% mark to 58% of the width, i.e. features move by up to about 18–23 columns. I expected w = 12 to be enough to find row 63.</li>
            <li>For the unrestricted query / row 63 pair, the traceback goes from the last cell back to (0, 0) through the cheapest predecessor; the notebook's <code>show_alignment</code> checks the endpoints, the steps and the cost.</li>
        </ul>

        <h3>Results</h3>
        {table(["Band w", "Winner", "Rank of row 63", "Winning cost", "Cells evaluated", "Share of unrestricted"], t5_rows)}
        {figure(SRC / "t5" / "T5_band_scan.png", "Band scan", "All widths 0–40: rank and DTW cost of the true row 63, and the work relative to unrestricted DTW")}
<h3>Interactive band explorer</h3>
        <p>The same banded DTW in JavaScript on the real query and all 100 rows of B (recomputed in the browser when the slider moves). It shows the winner and the rank of row 63 for any w, the scores of all rows against the pointwise scores, the accumulated-cost table of a chosen row with the band and the traceback, and the two signals along the path. Try w = 5 and w = 6 (the switch from row 64 to row 63) and w = 21 / 22 (the path reaches the unrestricted optimum).</p>
        {widget("dtw_widget.html", __DTW_DATA__=dtw_data())}
                {figure(SRC / "t5" / "T5_alignment.png", "DTW alignment", f"Unrestricted DTW of the query and B[63]: accumulated cost with the traceback path (left) and both signals along the path (right); cost {t5['score']:,.0f}")}

        <h3>Discussion</h3>
        <ul>
            <li><strong>The prediction holds, with room to spare:</strong> w = 12 finds row 63. The narrowest band that works is <strong>w = {narrow["band"]}</strong> (row 63 wins for every w ≥ {narrow["band"]}); it evaluates {narrow["cells"]:,} cells, {narrow["cells"] / FULL:.1%} of the unrestricted work, a saving of {1 - narrow["cells"] / FULL:.0%}. For w = 1–5 the neighbouring row 64 wins; w = 0 is the pointwise failure.</li>
            <li><strong>Finding the row is easier than finding the optimal alignment:</strong> at w = 12 the cost of row 63 is still 20,999, four times the unrestricted 4,753, but the band hurts the other rows as well. The cost reaches the unrestricted value only from w = {full["band"]} on, because the optimal path deviates from the diagonal by at most {deviation} columns. This matches the predicted shift of the 25% mark (column 37 → 60).</li>
            <li><strong>The path shows the squeeze:</strong> it is flat at the start (query 0–37 → candidate 0–59: the stretched left side, several candidate samples per query sample), steep in the middle (query 37–104 → candidate 59–87: the squeezed part, about 2.4 query samples per candidate sample) and flat again on the right. These are the knots 25%/70% → 40%/58% of the transformation.</li>
            <li><strong>Displaced feature:</strong> the first dark shadow starts at column 19 in the query and at 30 in B[63], and the path matches them (cell (19, 30)); likewise the step to the bright sand, query 118 ↔ candidate 105. After the alignment the two signals almost coincide; the remaining cost comes mostly from the narrow dark spikes in the squeezed middle, which were partly lost when B was resampled.</li>
        </ul>
    </div>
</details>
"""

intro = """<details open>
    <summary>Setup and Notes</summary>
    <div class="details-content">
        <ul>
            <li><strong>Code:</strong> Python 3.14 with NumPy. Edit distance (<code>edit.py</code>, <code>words.py</code>), the substring matcher (<code>match.py</code>) and DTW with band and traceback (<code>dtw.py</code>) are my own dynamic programs; no library solver is used. The course helpers (table display, <code>outcome</code>/<code>evaluate</code>, <code>top_five</code>/<code>print_hits</code>, <code>load_pair</code>, <code>show_row_search</code>, <code>show_alignment</code>) are loaded unchanged from the two supplied notebooks by <code>nb.py</code>. <code>T1.py</code>–<code>T5.py</code> run the tasks; their outputs (JSON and figures) are in <code>t1/</code>–<code>t5/</code>. The word lists are the supplied <code>words.0–6.txt</code>.</li>
            <li><strong>Search and evaluation are separate:</strong> in T2 and T3 the original word is only used to label the outcome; in T4 and T5 the true row 63 is only used after ranking.</li>
            <li><strong>Assistance:</strong> an AI coding assistant helped to write the code and the report text. The recurrences and model choices were mine; I checked the code and the results.</li>
        </ul>
    </div>
</details>
"""

b1_html = """<details>
    <summary>Bonus B1: Group project pitch</summary>
    <div class="details-content">
        <p>The project pitch (school timetabling) is posted in the course Zulip, topic "Project proposals pitching and teammate search":
        <a href="https://zulip.cs.ut.ee/#narrow/channel/842-2026-fall-algorithmics/topic/Project.20proposals.20pitching.20and.20teammate.20search/near/247896">link to the post</a>.</p>
    </div>
</details>
"""

head = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>HW11. Dynamic programming: edit distance and DTW</title>
    <meta name="reference" content="Python | https://www.python.org/">
    <meta name="reference" content="NumPy, Matplotlib, Pillow (course helpers and figures) | https://numpy.org/">
    <meta name="reference" content="Claude (Anthropic), AI coding assistant | https://claude.ai/">
    <link rel="stylesheet" href="../../styles.css">
    <script src="../../header.js" defer></script>
    <script src="../../footer.js" defer></script>
</head>
<body>
"""

(HW / "report.html").write_text(head + intro + t1_html + t2_html + t3_html + t4_html + t5_html + b1_html + "</body>\n</html>\n", encoding="utf-8")
print("report written", (HW / "report.html").stat().st_size, "narrow", narrow["band"], "full", full["band"], "deviation", deviation)

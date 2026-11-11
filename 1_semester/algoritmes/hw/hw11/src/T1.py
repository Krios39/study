import json
from pathlib import Path

from edit import edit_table, path_cells, replay, traceback
from nb import word_helpers

OUT = Path(__file__).resolve().parent / "t1"
OUT.mkdir(exist_ok=True)
h = word_helpers()
plt = h["plt"]
source, target = "causality", "casualty"
summary = {}
for tag, swap, title in (("unit", None, "Unit-cost edit distance"),
                         ("swap", 1, "Rule A: adjacent swap costs 1")):
    d = edit_table(source, target, swap=swap)
    steps = traceback(d, source, target, swap=swap)
    cells = path_cells(steps)
    print(f"== {title}")
    h["show_edit_table"](source, target, d, title, cells)
    plt.gcf().savefig(OUT / f"T1_{tag}.png", dpi=110)
    plt.close("all")
    lines = replay(steps, source, target)
    word = source
    for what, cost, word in lines:
        print(f"  {what:32s} cost {cost:g}  -> {word}")
    total = sum(cost for _, cost, _ in lines)
    assert word == target and total == d[-1, -1]
    print("distance", d[-1, -1], "path", cells)
    summary[tag] = {"table": d.tolist(), "path": cells, "edits": lines, "distance": d[-1, -1]}
(OUT / "T1.json").write_text(json.dumps(summary, indent=1))

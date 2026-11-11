import json
import os
from pathlib import Path

import numpy as np

from dtw import dtw, dtw_path, rank, winner
from nb import ROOT, signal_helpers

OUT = Path(__file__).resolve().parent / "t5"
OUT.mkdir(exist_ok=True)
os.chdir(ROOT)
h = signal_helpers((1, 2, 11))
plt = h["plt"]
A, B = h["load_pair"]()
QUERY_Y = 55
query = A[QUERY_Y].copy()
truth_y = QUERY_Y + h["SHIFT_ROWS"]
point = json.loads((OUT.parent / "t4" / "T4.json").read_text())["point_scores"]


def search(band):
    scores, cells = [], 0
    for row in B:
        d, count = dtw(query, row, band)
        scores.append(float(d[-1, -1]))
        cells += count
    return scores, cells


rows, scan = [], []
for band in [0, 4, 12, None]:
    scores, cells = search(band)
    best = winner(scores)
    rows.append({"band": "unrestricted" if band is None else band, "winner": best,
                 "truth_rank": rank(scores, truth_y), "winning_cost": scores[best], "cells": cells})
    if band == 0:
        assert np.allclose(scores, point)
    print(rows[-1])
for band in range(0, 41):
    scores, cells = search(band)
    scan.append({"band": band, "winner": winner(scores), "truth_rank": rank(scores, truth_y),
                 "truth_cost": scores[truth_y], "cells": cells})
    print(scan[-1])
d, _ = dtw(query, B[truth_y])
path = dtw_path(d)
score = float(d[-1, -1])
h["show_alignment"](query, B[truth_y], d[1:, 1:], path, score)
plt.gcf().savefig(OUT / "T5_alignment.png", dpi=110)
plt.close("all")
(OUT / "T5.json").write_text(json.dumps({"rows": rows, "scan": scan, "path": path, "score": score}, indent=1))

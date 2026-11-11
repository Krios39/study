import json
import os
from pathlib import Path

import numpy as np

from dtw import dtw, pointwise, rank, winner
from nb import ROOT, signal_helpers

OUT = Path(__file__).resolve().parent / "t4"
OUT.mkdir(exist_ok=True)
os.chdir(ROOT)
h = signal_helpers((1, 2, 6))
A, B = h["load_pair"]()
QUERY_Y = 55
query = A[QUERY_Y].copy()
truth_y = QUERY_Y + h["SHIFT_ROWS"]
point_scores = [pointwise(query, row) for row in B]
dtw_scores = [float(dtw(query, row)[0][-1, -1]) for row in B]
point_y, dtw_y = winner(point_scores), winner(dtw_scores)
fig = h["show_row_search"](A, B, QUERY_Y, point_scores, dtw_scores, point_y, dtw_y)
fig.savefig(OUT / "T4_row_search.png", dpi=110)
result = {"point_y": point_y, "dtw_y": dtw_y, "truth_y": truth_y,
          "point_rank_truth": rank(point_scores, truth_y), "dtw_rank_truth": rank(dtw_scores, truth_y),
          "point_scores": point_scores, "dtw_scores": dtw_scores}
(OUT / "T4.json").write_text(json.dumps(result, indent=1))
for name, scores in (("pointwise", point_scores), ("DTW", dtw_scores)):
    order = sorted(range(100), key=lambda y: (scores[y], y))[:5]
    print(name, "top5", [(y, round(scores[y])) for y in order], "truth rank", rank(scores, truth_y), "truth score", round(scores[truth_y]))
